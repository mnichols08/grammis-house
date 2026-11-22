// The fridge on The Family Wall. Everybody shares one box of letter magnets and moves them around the
// door; nobody adds letters. The family can also draw Grammi a picture: it waits until she puts it up,
// and then it hangs on the door and moves like a magnet.
//
// The page reaches this through the fridge's own Zubra server functions
// (themes/grammis/components/magnet-fridge.zb):
//   look     the magnets and the drawings that are up, and a form token for drawing
//   move     one magnet or drawing set down somewhere else
//   draw     one drawing, waiting for Grammi
//   grammi   with Grammi's word: what's waiting, put one up or take one down, tidy the letters
// Grammi's word (OPENBLOG_FRIDGE_WORD) is the only key: the page asks for it in "Grammi's corner".
//
// The rules for what moves and what a drawing may hold are in lib/fridge.js.

import { createHash } from "node:crypto";
import { checkFormToken, makeFormToken, sameCode } from "./vendor/openblog/lib/gift-card.mjs";
import { isUuid } from "./vendor/openblog/lib/greeting-card.mjs";
import { FridgeError, LIMITS, MAGNETS, checkBy, checkDrawing, checkMagnet, checkSpot, starterLayout } from "./lib/fridge.js";
import { withinLimit } from "./lib/db.js";
import { hourOf } from "./lib/http.js";

const HOUR = 60 * 60 * 1000;
export const FRIDGE_RATES = Object.freeze({ movesPerHour: 400, movesPerSiteHour: 20000, drawingsPerHour: 4, drawingsPerDay: 60, wordTriesPerHour: 10 });

function createStore(db, settings) {
  const site = settings.site.siteId;
  const store = {
    /** The letters, the ones moved last on top; set out as Grammi starts them the first time. */
    magnets: async () => {
      let rows = await db.rows("select id, x, y, r from public.grammis_fridge_magnets where site_id = $1 order by moved_at asc, id asc", [site]);
      if (rows.length < MAGNETS.length) {
        await store.lay(starterLayout(), { onlyMissing: true });
        rows = await db.rows("select id, x, y, r from public.grammis_fridge_magnets where site_id = $1 order by moved_at asc, id asc", [site]);
      }
      return rows;
    },
    lay: async (layout, { onlyMissing = false } = {}) => {
      const ids = layout.map((spot) => spot.id);
      const xs = layout.map((spot) => spot.x);
      const ys = layout.map((spot) => spot.y);
      const rs = layout.map((spot) => spot.r);
      await db.rows(
        `insert into public.grammis_fridge_magnets (site_id, id, x, y, r, moved_at)
         select $1, t.id, t.x, t.y, t.r, now() - interval '1 day' + (t.n * interval '1 millisecond')
         from unnest($2::smallint[], $3::real[], $4::real[], $5::real[]) with ordinality as t(id, x, y, r, n)
         on conflict (site_id, id) do ${onlyMissing ? "nothing" : "update set x = excluded.x, y = excluded.y, r = excluded.r, moved_at = excluded.moved_at"}`,
        [site, ids, xs, ys, rs],
      );
    },
    moveMagnet: (id, spot, at) => db.one(
      "update public.grammis_fridge_magnets set x = $3, y = $4, r = $5, moved_at = $6 where site_id = $1 and id = $2 returning id",
      [site, id, spot.x, spot.y, spot.r, at],
    ),
    moveDrawing: (id, spot, at) => db.one(
      "update public.grammis_fridge_drawings set x = $3, y = $4, r = $5, moved_at = $6 where site_id = $1 and id = $2 and status = 'up' returning id",
      [site, id, spot.x, spot.y, spot.r, at],
    ),
    up: () => db.rows("select id, by_name, drawing, x, y, r from public.grammis_fridge_drawings where site_id = $1 and status = 'up' order by moved_at asc", [site]),
    waiting: () => db.rows("select id, by_name, drawing, created_at from public.grammis_fridge_drawings where site_id = $1 and status = 'waiting' order by created_at asc limit 40", [site]),
    add: (row) => db.one(
      "insert into public.grammis_fridge_drawings (site_id, by_name, drawing, sender_digest, created_at, moved_at) values ($1, $2, $3, $4, $5, $5) returning id",
      [site, row.by, JSON.stringify(row.drawing), row.digest, row.at],
    ),
    fromSender: async (digest, since) => Number((await db.one(
      "select count(*)::int as n from public.grammis_fridge_drawings where site_id = $1 and sender_digest = $2 and created_at >= $3", [site, digest, since],
    )).n),
    since: async (since) => Number((await db.one("select count(*)::int as n from public.grammis_fridge_drawings where site_id = $1 and created_at >= $2", [site, since])).n),
    decide: (id, status, spot, at) => db.one(
      `update public.grammis_fridge_drawings set status = $3, decided_at = $4,
         x = coalesce($5, x), y = coalesce($6, y), r = coalesce($7, r), moved_at = $4
       where site_id = $1 and id = $2 returning id`,
      [site, id, status, at, spot?.x ?? null, spot?.y ?? null, spot?.r ?? null],
    ),
    /** Past the most that hang at once, the ones up longest come down. */
    makeRoom: (keep) => db.rows(
      `update public.grammis_fridge_drawings set status = 'down' where site_id = $1 and status = 'up' and id not in (
         select id from public.grammis_fridge_drawings where site_id = $1 and status = 'up' order by decided_at desc nulls last limit $2)`,
      [site, keep],
    ),
  };
  return store;
}

const drawingOut = (row) => ({ id: row.id, by: row.by_name || "", drawing: row.drawing, x: row.x, y: row.y, r: row.r });

/** The fridge part of the service. `now` is a clock (ms). */
export function createFridge({ db, settings, now = () => Date.now() }) {
  const store = createStore(db, settings);
  const { word } = settings.fridge;
  const salt = settings.site.salt;
  const secret = createHash("sha256").update(`${salt}\0fridge-form`).digest("hex");
  const site = settings.site.siteId;
  const digestOf = (bucket, client, hour = "") => createHash("sha256").update(`${salt}\0${bucket}\0${hour}\0${client || "unknown"}`).digest("hex");
  const limit = async (bucket, address, perSubject, perSite) => {
    const hour = hourOf(now());
    return withinLimit(db, { siteId: site, bucket, hour, digest: digestOf(bucket, address, hour), perSubject, perSite });
  };

  /** Everything on the door, as anyone may see it. */
  async function look() {
    const placed = await store.magnets();
    return {
      magnets: placed.map((row) => ({ id: row.id, ch: MAGNETS[row.id].ch, color: MAGNETS[row.id].color, x: row.x, y: row.y, r: row.r })),
      drawings: (await store.up()).map(drawingOut),
      token: makeFormToken(secret, now()),
    };
  }

  /** One magnet ("magnet", its number) or drawing ("drawing", its id) set down somewhere else. */
  async function move(fields, { address = "" } = {}) {
    try {
      const kind = String(fields.get("kind") || "");
      const spot = checkSpot(fields);
      if (!(await limit("fridge-moves", address, FRIDGE_RATES.movesPerHour, FRIDGE_RATES.movesPerSiteHour))) return { error: "slow-down", status: 429 };
      const at = new Date(now()).toISOString();
      if (kind === "magnet") {
        await store.magnets();
        await store.moveMagnet(checkMagnet(fields.get("id")), spot, at);
        return { ok: true };
      }
      if (kind === "drawing" && isUuid(String(fields.get("id") || ""))) {
        if (!(await store.moveDrawing(String(fields.get("id")), spot, at))) throw new FridgeError("gone", "id", 404);
        return { ok: true };
      }
      throw new FridgeError("what", "kind");
    } catch (error) {
      if (error instanceof FridgeError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  /** One drawing for Grammi: it waits until she puts it up. */
  async function draw(fields, { address = "" } = {}) {
    try {
      if (String(fields.get("website") || "").trim()) return { ok: true };
      const at = now();
      if (!checkFormToken(String(fields.get("token") || ""), secret, at, { maxSeconds: 6 * 60 * 60 })) throw new FridgeError("token", "token", 400);
      const drawing = checkDrawing(String(fields.get("drawing") || ""));
      const by = checkBy(fields.get("by"));
      const digest = digestOf("fridge-drawings", address);
      if (await store.fromSender(digest, new Date(at - HOUR).toISOString()) >= FRIDGE_RATES.drawingsPerHour) return { error: "slow-down", status: 429 };
      if (await store.since(new Date(at - 24 * HOUR).toISOString()) >= FRIDGE_RATES.drawingsPerDay) return { error: "full", status: 429 };
      await store.add({ by, drawing, digest, at: new Date(at).toISOString() });
      return { ok: true };
    } catch (error) {
      if (error instanceof FridgeError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  /**
   * Grammi's corner, with her word. `action`: "look" (what's waiting and what's up), "up" or "down"
   * (a drawing, by `id`), "tidy" (the letters back as she starts them). Answers what's waiting and up.
   */
  async function grammi(fields, { address = "" } = {}) {
    try {
      // Every try counts before the word is compared, so guessing it stops quickly.
      if (!(await limit("fridge-word", address, FRIDGE_RATES.wordTriesPerHour, 200))) return { error: "slow-down", status: 429 };
      if (!sameCode(String(fields.get("word") || ""), word)) throw new FridgeError("word", "word", 403);
      const action = String(fields.get("action") || "look");
      const id = String(fields.get("id") || "");
      const at = new Date(now()).toISOString();
      if (action === "tidy") await store.lay(starterLayout());
      else if (action === "up" || action === "down") {
        if (!isUuid(id)) throw new FridgeError("gone", "id", 404);
        // A drawing she puts up goes just under her notes, somewhere across the middle; anyone can move it.
        const spot = action === "up" ? { x: 25 + Math.round(Math.random() * 50), y: 33 + Math.round(Math.random() * 6), r: Math.round((Math.random() - 0.5) * 8) } : null;
        if (!(await store.decide(id, action, spot, at))) throw new FridgeError("gone", "id", 404);
        if (action === "up") await store.makeRoom(LIMITS.drawingsUp);
      } else if (action !== "look") throw new FridgeError("what", "action");
      return {
        ok: true,
        waiting: (await store.waiting()).map((row) => ({ id: row.id, by: row.by_name || "", drawing: row.drawing, createdAt: row.created_at })),
        up: (await store.up()).map(drawingOut),
      };
    } catch (error) {
      if (error instanceof FridgeError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  return { look, move, draw, grammi, store };
}
