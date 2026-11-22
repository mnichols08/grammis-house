// Recipes from the family. Anyone in the family can share a recipe of their own with Grammi, with
// their name on it and, if they like, a link to their page, or ask her for one of hers (a request:
// it becomes a draft she writes, saying who asked). Nothing they send is on the site: it waits
// here until her editor collects it as a draft post (docker/recipe-inbox.mjs), and it goes on the
// site only when she publishes that draft.
//
// The form (themes/grammis/components/recipe-share.zb) reaches this through its own Zubra server
// functions: `look` (whether the form is open, and a form token) and `share` (one recipe, or with
// kind=request one request). Her editor
// reaches the owner's side with the recipes key:
//   GET  /api/recipes/admin/pending            the recipes not collected yet, oldest first, photos too
//   POST /api/recipes/admin/<id>/delivered     { path }: it is a draft now; its photos are deleted here
//
// The rules for what a recipe may hold are in lib/recipe-check.js.

import { createHash } from "node:crypto";
import { checkFormToken, makeFormToken, sameCode } from "./vendor/openblog/lib/gift-card.mjs";
import { isUuid } from "./vendor/openblog/lib/greeting-card.mjs";
import { RecipeError, checkRecipe, checkRequest, photosFromForm, recipeFromForm, requestFromForm } from "./lib/recipe-check.js";
import { withinLimit } from "./lib/db.js";
import { hourOf, reply, sameSecret } from "./lib/http.js";

const HOUR = 60 * 60 * 1000;
// A recipe takes a while to write out: the form token lasts six hours (a gift's lasts two).
const TOKEN_SECONDS = 6 * 60 * 60;
export const RECIPE_RATES = Object.freeze({ perVisitorPerHour: 3, triesPerHour: 10, perDay: 40, pendingAtOnce: 10 });

function createStore(db, settings) {
  const site = settings.site.siteId;
  return {
    add: async ({ kind = "recipe", author, recipe, photos, digest, at }) => {
      const row = await db.one(
        `insert into public.grammis_recipe_submissions (site_id, kind, author_name, author_link, recipe, photo_count, sender_digest, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, created_at`,
        [site, kind, author.name, author.link, JSON.stringify(recipe), photos.length, digest, at],
      );
      for (const [position, bytes] of photos.entries()) {
        await db.rows("insert into public.grammis_recipe_photos (submission_id, position, bytes) values ($1, $2, $3)", [row.id, position, bytes]);
      }
      return row;
    },
    fromSender: async (digest, since) => Number((await db.one(
      "select count(*)::int as n from public.grammis_recipe_submissions where site_id = $1 and sender_digest = $2 and created_at >= $3",
      [site, digest, since],
    )).n),
    since: async (since) => Number((await db.one(
      "select count(*)::int as n from public.grammis_recipe_submissions where site_id = $1 and created_at >= $2",
      [site, since],
    )).n),
    waiting: (limit) => db.rows(
      "select id, kind, created_at, author_name, author_link, recipe, photo_count from public.grammis_recipe_submissions where site_id = $1 and delivered_at is null order by created_at asc limit $2",
      [site, limit],
    ),
    photosOf: (ids) => (ids.length ? db.rows(
      "select submission_id, position, bytes from public.grammis_recipe_photos where submission_id = any($1::uuid[]) order by submission_id, position",
      [ids],
    ) : []),
    deliver: async (id, path, at) => {
      const row = await db.one(
        `update public.grammis_recipe_submissions set delivered_at = coalesce(delivered_at, $3), delivered_as = coalesce(delivered_as, $4)
         where site_id = $1 and id = $2 returning id, delivered_at, delivered_as`,
        [site, id, at, path],
      );
      if (row) await db.rows("delete from public.grammis_recipe_photos where submission_id = $1", [id]);
      return row;
    },
  };
}

/** The recipes part of the service. `now` is a clock (ms). */
export function createRecipes({ db, settings, now = () => Date.now() }) {
  const store = createStore(db, settings);
  const { adminKey, code } = settings.recipes;
  const salt = settings.site.salt;

  /** Whether the form asks for the family password, and a fresh form token. */
  const look = () => ({ open: true, asks: Boolean(code), token: makeFormToken(adminKey, now()) });

  /**
   * Takes one recipe. `fields` is the form (FormData, photos as files); `address` the visitor's, as
   * the proxy said. Answers { ok } or { error, field, status }.
   */
  async function share(fields, { address = "" } = {}) {
    try {
      const value = (name) => (typeof fields.get(name) === "string" ? fields.get(name) : "");
      // A robot fills every field it finds; a person never sees this one.
      if (value("website").trim()) return { ok: true };
      const at = now();
      if (!checkFormToken(value("token"), adminKey, at, { maxSeconds: TOKEN_SECONDS })) throw new RecipeError("token", "token", 400);
      const client = address || "unknown";
      // Every try counts, before the password is even compared, so guessing it stops quickly.
      const hour = hourOf(at);
      const tries = createHash("sha256").update(`${salt}\0recipe-tries\0${hour}\0${client}`).digest("hex");
      if (!(await withinLimit(db, { siteId: settings.site.siteId, bucket: "recipe-tries", hour, digest: tries, perSubject: RECIPE_RATES.triesPerHour, perSite: RECIPE_RATES.perDay * 4 }))) {
        return { error: "slow-down", status: 429 };
      }
      if (code && !sameCode(value("code"), code)) throw new RecipeError("family-code", "code", 403);
      // A request is someone asking for one of hers: a name, which recipe, a few words. No link or photos.
      const kind = value("kind") === "request" ? "request" : "recipe";
      let author, recipe, photos;
      if (kind === "request") {
        const asked = checkRequest(requestFromForm(fields));
        [author, recipe, photos] = [{ name: asked.asker, link: null }, asked.request, []];
      } else {
        ({ author, recipe } = checkRecipe(recipeFromForm(fields)));
        photos = await photosFromForm(fields);
      }
      const digest = createHash("sha256").update(`${salt}\0recipes\0${client}`).digest("hex");
      if (await store.fromSender(digest, new Date(at - HOUR).toISOString()) >= RECIPE_RATES.perVisitorPerHour) return { error: "slow-down", status: 429 };
      if (await store.since(new Date(at - 24 * HOUR).toISOString()) >= RECIPE_RATES.perDay) return { error: "full", status: 429 };
      await store.add({ kind, author, recipe, photos, digest, at: new Date(at).toISOString() });
      return { ok: true };
    } catch (error) {
      if (error instanceof RecipeError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  /** Her editor's side: `parts` are the path after /api/recipes/admin/. */
  async function owner({ method, parts, headers, body }) {
    if (!sameSecret(String(headers.authorization || "").replace(/^Bearer /i, ""), adminKey)) return reply(401, { error: "unauthorized" });
    try {
      const [first, second] = parts;
      if (method === "GET" && first === "pending" && parts.length === 1) {
        const rows = await store.waiting(RECIPE_RATES.pendingAtOnce);
        const photos = await store.photosOf(rows.map((row) => row.id));
        return reply(200, {
          recipes: rows.map((row) => ({
            id: row.id,
            kind: row.kind || "recipe",
            createdAt: row.created_at,
            author: { name: row.author_name, link: row.author_link || null },
            recipe: row.recipe,
            photos: photos.filter((photo) => photo.submission_id === row.id).map((photo) => Buffer.from(photo.bytes).toString("base64")),
          })),
        });
      }
      if (method === "POST" && second === "delivered" && parts.length === 2 && isUuid(first)) {
        const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";
        if (!/^content\/posts\/[a-z0-9-]+\.md$/.test(path)) return reply(422, { error: "path", field: "path" });
        const row = await store.deliver(first, path, new Date(now()).toISOString());
        if (!row) return reply(404, { error: "not-found" });
        return reply(200, { id: row.id, deliveredAt: row.delivered_at, deliveredAs: row.delivered_as });
      }
      return reply(404, { error: "not-found" });
    } catch {
      return reply(503, { error: "storage-unavailable" });
    }
  }

  return { look, share, owner, store };
}
