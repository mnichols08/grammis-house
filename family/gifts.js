// Gifts under the tree. The family leaves a wrapped note or card under Grammi's tree; it stays
// wrapped until Christmas morning, when she opens it in Studio. Nothing anyone writes is ever public.
//
// The gift form (themes/grammis/components/gift-maker.zb) reaches this through its own Zubra server
// functions: `look` (the boxes, and a form token) and `leave` (a gift). Studio reaches the owner's
// side with the gifts key, at the addresses open.blog's gift service has always had:
//   GET  /api/gifts/admin/list                  every gift; contents only once opened
//   POST /api/gifts/admin/<id>/open             423 until its opening time; then its contents
//   POST /api/gifts/admin/<id>/hide | show      off the tree (kept, never deleted) and back
//   GET  /api/gifts/admin/settings, POST /api/gifts/admin/settings { showNames?, familyCode?, anyone?, ready? }
// and GET /api/gifts/tree gives the public boxes as JSON, for checking.
//
// The rules (what a gift may hold, when it opens, the form token, the password) are open.blog's own,
// copied at the pinned revision (vendor/openblog/lib/gift-card.mjs).

import { createHash } from "node:crypto";
import { CardError, LATE_DAYS, LIMITS, WRAPS, bowOf, checkFamilyCode, checkFormToken, makeFormToken, opensAt, sameCode, spotOf } from "./vendor/openblog/lib/gift-card.mjs";
import { checkGiftWithScene, sceneFromForm } from "./lib/gift-scene.js";
import { isUuid } from "./vendor/openblog/lib/greeting-card.mjs";
import { withinLimit } from "./lib/db.js";
import { hourOf, reply, sameSecret } from "./lib/http.js";

const DAY = 24 * 60 * 60 * 1000;

/** A gift as the owner sees it in Studio: contents only once it's open. */
export const giftOut = (row, now) => ({
  id: row.id,
  from: row.from_name,
  showName: row.show_name === true,
  kind: row.kind,
  wrap: row.wrap,
  createdAt: row.created_at,
  opensAt: row.opens_at,
  canOpen: now >= Date.parse(row.opens_at),
  opened: Boolean(row.opened_at),
  openedAt: row.opened_at || null,
  onTree: !row.hidden_at,
  ...(row.opened_at ? { note: row.kind === "note" ? row.note : null, card: row.kind === "card" ? row.card : null } : {}),
});

function createStore(db, settings) {
  const site = settings.site.siteId;
  const store = {
    onTree: () => db.rows(
      "select id, wrap, bow, spot_x, spot_y, from_name, show_name, opens_at, created_at from public.openblog_gifts where site_id = $1 and hidden_at is null order by created_at asc limit $2",
      [site, LIMITS.perSeason],
    ),
    all: () => db.rows("select * from public.openblog_gifts where site_id = $1 order by created_at asc limit 1000", [site]),
    one: (id) => db.one("select * from public.openblog_gifts where site_id = $1 and id = $2", [site, id]),
    add: (row) => db.one(
      `insert into public.openblog_gifts (site_id, from_name, show_name, kind, note, card, wrap, bow, spot_x, spot_y, opens_at, sender_digest)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning *`,
      [site, row.from_name, row.show_name, row.kind, row.note, row.card === null ? null : JSON.stringify(row.card), row.wrap, row.bow, row.spot_x, row.spot_y, row.opens_at, row.sender_digest],
    ),
    open: (id, at) => db.one("update public.openblog_gifts set opened_at = $3 where site_id = $1 and id = $2 and opened_at is null returning *", [site, id, at]),
    hide: (id, at) => db.one("update public.openblog_gifts set hidden_at = $3 where site_id = $1 and id = $2 returning *", [site, id, at]),
    fromSender: async (digest, since) => Number((await db.one(
      "select count(*)::int as n from (select 1 from public.openblog_gifts where site_id = $1 and sender_digest = $2 and created_at >= $3 limit $4) as recent",
      [site, digest, since, LIMITS.perSeason + 1],
    )).n),
    forSeason: async (opens) => Number((await db.one(
      "select count(*)::int as n from (select 1 from public.openblog_gifts where site_id = $1 and opens_at = $2 limit $3) as season",
      [site, opens, LIMITS.perSeason + 1],
    )).n),
    /** The owner's settings: whether the tree shows names, the family password she set, whether it's asked, and whether her tree is ready. */
    settings: async () => {
      const row = await db.one("select show_names, family_code, anyone, ready from public.openblog_gift_settings where site_id = $1", [site]);
      const code = settings.gifts.code;
      return {
        showNames: row ? row.show_names === true : true,
        familyCode: row?.family_code || code || null,
        // Gifts are taken without a password unless whoever set the service up gave a first one; after that it's her choice.
        anyone: row ? row.anyone !== false : !code,
        // Until she says her tree is ready, the public side shows and takes none.
        ready: row?.ready === true,
      };
    },
    saveSettings: async (change) => {
      const next = { ...(await store.settings()), ...change };
      await db.rows(
        `insert into public.openblog_gift_settings (site_id, show_names, family_code, anyone, ready, updated_at) values ($1, $2, $3, $4, $5, now())
         on conflict (site_id) do update set show_names = excluded.show_names, family_code = excluded.family_code, anyone = excluded.anyone, ready = excluded.ready, updated_at = now()`,
        [site, next.showNames, next.familyCode, next.anyone !== false, next.ready === true],
      );
      return next;
    },
  };
  return store;
}

/** A gift from the form's fields (FormData), in the shape open.blog's check reads. */
export function giftFromForm(form) {
  const field = (name) => (typeof form.get(name) === "string" ? form.get(name) : "");
  let stickers = [];
  try {
    const parsed = JSON.parse(field("stickers") || "[]");
    if (Array.isArray(parsed)) stickers = parsed;
  } catch {
    stickers = null; // checked below as a bad sticker
  }
  const number = (name) => (/^\d{1,3}$/.test(field(name)) ? Number(field(name)) : null);
  const kind = field("kind");
  return {
    from: field("from"),
    showName: field("showName") === "on" || field("showName") === "true",
    kind,
    wrap: field("wrap"),
    bow: field("bow"),
    spot: { x: number("spotX"), y: number("spotY") },
    ...(kind === "note"
      ? { note: field("note") }
      : { card: { design: field("design"), message: field("message"), signOff: field("signOff"), stickers: stickers ?? [{ kind: "" }], ...sceneFromForm(field("scene")) } }),
  };
}

/**
 * The gifts part of the service. `now` is a clock (ms). Everything it answers is rebuilt from
 * known fields; errors are fixed codes.
 */
export function createGifts({ db, settings, now = () => Date.now() }) {
  const store = createStore(db, settings);
  const { zone } = settings.site;
  const { opensOn, adminKey } = settings.gifts;
  const salt = settings.site.salt;

  /** The boxes under the tree, as anyone may see them. */
  async function tree() {
    const { showNames, anyone, ready } = await store.settings();
    const at = now();
    const opens = opensAt(at, zone, opensOn);
    // This season's: still to open, or opened within the late days (until January 6).
    const gifts = ready ? (await store.onTree())
      .filter((row) => Date.parse(row.opens_at) > at - (LATE_DAYS + 1) * DAY)
      .map((row) => ({ id: row.id, wrap: WRAPS.includes(row.wrap) ? row.wrap : "red", bow: bowOf(row.bow), spot: spotOf(row), from: showNames && row.show_name ? row.from_name : null })) : [];
    return { gifts, opensAt: opens.toISOString(), showNames, anyone, ready };
  }

  /** A form token: the form must be open a few seconds before a gift is taken. */
  const token = () => makeFormToken(adminKey, now());

  /**
   * Takes one gift. `fields` is the form (FormData); `address` the visitor's, as the proxy said.
   * Answers { ok, gift, opensAt } or { error, field, status }.
   */
  async function leave(fields, { address = "" } = {}) {
    try {
      const value = (name) => (typeof fields.get(name) === "string" ? fields.get(name) : "");
      // A robot fills every field it finds; a person never sees this one.
      if (value("website").trim()) return { ok: true };
      const at = now();
      if (!checkFormToken(value("token"), adminKey, at)) throw new CardError(400, "token", "token");
      const client = address || "unknown";
      // Every try counts, right or wrong, before the password is even compared: guessing the family's
      // word stops after a few tries an hour.
      const hour = hourOf(at);
      const tries = createHash("sha256").update(`${salt}\0gift-tries\0${hour}\0${client}`).digest("hex");
      if (!(await withinLimit(db, { siteId: settings.site.siteId, bucket: "gift-tries", hour, digest: tries, perSubject: LIMITS.triesPerHour, perSite: LIMITS.perSeason * 4 }))) {
        return { error: "slow-down", status: 429 };
      }
      const owner = await store.settings();
      if (!owner.ready) throw new CardError(403, "not-ready", "ready");
      if (!owner.anyone && !sameCode(value("code"), owner.familyCode)) throw new CardError(403, "family-code", "code");
      const gift = checkGiftWithScene(giftFromForm(fields));
      const digest = createHash("sha256").update(`${salt}\0gifts\0${client}`).digest("hex");
      if (await store.fromSender(digest, new Date(at - 60 * 60 * 1000).toISOString()) >= LIMITS.perVisitorPerHour) return { error: "slow-down", status: 429 };
      const opens = opensAt(at, zone, opensOn);
      if (await store.forSeason(opens.toISOString()) >= LIMITS.perSeason) throw new CardError(409, "tree-full");
      const row = await store.add({
        from_name: gift.from, show_name: gift.showName, kind: gift.kind, note: gift.note, card: gift.card,
        wrap: gift.wrap, bow: gift.bow, spot_x: gift.spot?.x ?? null, spot_y: gift.spot?.y ?? null, opens_at: opens.toISOString(), sender_digest: digest,
      });
      return { ok: true, gift: { id: row.id, wrap: row.wrap, bow: gift.bow, spot: gift.spot, from: gift.showName ? gift.from : null }, opensAt: opens.toISOString() };
    } catch (error) {
      if (error instanceof CardError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  /** Studio's side: `parts` are the path after /api/gifts/admin/. */
  async function owner({ method, parts, headers, body }) {
    if (!sameSecret(String(headers.authorization || "").replace(/^Bearer /i, ""), adminKey)) return reply(401, { error: "unauthorized" });
    try {
      const [first, second] = parts;
      if (method === "GET" && first === "list" && parts.length === 1) {
        const at = now();
        const mine = await store.settings();
        return reply(200, {
          gifts: (await store.all()).map((row) => giftOut(row, at)),
          showNames: mine.showNames,
          familyCode: mine.familyCode,
          anyone: mine.anyone,
          ready: mine.ready,
          opensAt: opensAt(at, zone, opensOn).toISOString(),
          limits: LIMITS,
        });
      }
      if (first === "settings" && parts.length === 1) {
        if (method === "GET") return reply(200, await store.settings());
        if (method === "POST") {
          if (!body) throw new CardError(400, "malformed");
          const change = {};
          if ("showNames" in body) {
            if (typeof body.showNames !== "boolean") throw new CardError(422, "show-names", "showNames");
            change.showNames = body.showNames;
          }
          if ("familyCode" in body) change.familyCode = checkFamilyCode(body.familyCode);
          if ("anyone" in body) {
            if (typeof body.anyone !== "boolean") throw new CardError(422, "anyone", "anyone");
            change.anyone = body.anyone;
          }
          if ("ready" in body) {
            if (typeof body.ready !== "boolean") throw new CardError(422, "ready", "ready");
            change.ready = body.ready;
          }
          // Asking for a password needs one to ask for.
          if (change.anyone === false && !(change.familyCode ?? (await store.settings()).familyCode)) throw new CardError(422, "family-code-needed", "familyCode");
          if (!Object.keys(change).length) throw new CardError(400, "malformed");
          return reply(200, await store.saveSettings(change));
        }
      }
      if (method === "POST" && parts.length === 2 && isUuid(first)) {
        const row = await store.one(first);
        if (!row) throw new CardError(404, "not-found");
        const at = now();
        const stamp = new Date(at).toISOString();
        if (second === "open") {
          if (at < Date.parse(row.opens_at)) return reply(423, { error: "not-yet", opensAt: row.opens_at });
          const opened = row.opened_at ? row : (await store.open(first, stamp)) || (await store.one(first));
          return reply(200, { gift: giftOut(opened, at) });
        }
        if (second === "hide" || second === "show") {
          const changed = await store.hide(first, second === "hide" ? stamp : null);
          return reply(200, { gift: giftOut(changed || row, at) });
        }
      }
      return reply(404, { error: "not-found" });
    } catch (error) {
      if (error instanceof CardError) return reply(error.status, { error: error.code, field: error.field });
      return reply(503, { error: "storage-unavailable" });
    }
  }

  return { tree, token, leave, owner, store };
}
