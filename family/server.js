// Grammi's family service, on Zubra: notes on recipes, greeting cards, gifts under the tree, recipes
// the family shares with her, and her built site, from one Node server on Railway with Railway's Postgres.
//
//   /_zb/action/...      the theme components' own server functions (@zubra/actions): the gift form's
//                        `look` and `leave`, the recipe form's `look` and `share`, compiled from
//                        themes/grammis/components/*.zb
//   /api/gifts/admin/... Studio's side of gifts           (family/gifts.js)
//   /api/greetings/...   Studio's side of greeting cards  (family/cards.js)
//   /api/recipes/admin/... her editor collecting recipes the family shared (family/recipes.js)
//   /api/...             notes, views and moderation      (family/notes.js)
//   /health              which parts are on
//   everything else      the built site (FAMILY_SITE_DIR), at the root
//
// The database is set up at start (family/lib/migrate.js); due cards go out every hour.
//
//   DATABASE_URL=postgres://… node family/server.js

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createActions } from "@zubra/actions";
import { connect } from "./actions.js";
import { createCards } from "./cards.js";
import { createGifts } from "./gifts.js";
import { createDatabase } from "./lib/db.js";
import { HttpError, objectOf, readText, reply, visitorAddress } from "./lib/http.js";
import { migrate } from "./lib/migrate.js";
import { readSettings } from "./lib/settings.js";
import { createSite } from "./lib/site.js";
import { createNotes } from "./notes.js";
import { createRecipes } from "./recipes.js";

const HOUR = 60 * 60 * 1000;
const MAX_JSON = 32 * 1024;
// The largest form post: a recipe with four photos (each at most 900 KB) and its words. Every form
// checks what it was sent on top of this, so a gift is still only as big as a gift may be.
export const MAX_FORM = 4 * 1024 * 1024;
export const COMPONENTS = fileURLToPath(new URL("../themes/grammis/components", import.meta.url));

const send = (res, answer) => res.writeHead(answer.status, answer.headers).end(answer.body);

/** Runs `job` every `every` ms, never two at once, and once `first` ms after start. */
export function repeat(job, { every = HOUR, first = 15000, log = () => {}, label = "job" } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (error) {
      log(`${label} failed: ${error?.message || error}`);
    } finally {
      running = false;
    }
  };
  const start = setTimeout(tick, first);
  const timer = setInterval(tick, every);
  return () => { clearTimeout(start); clearInterval(timer); };
}

/**
 * The whole service. `actions` is @zubra/actions over the theme's components; `site`, when there is
 * one, serves the built pages. The pages are served from the start; notes, cards and gifts come on
 * once there is a database (`db` here, or `attach(db)` later), so a database that is missing or
 * slow never takes her site down.
 */
export function createFamily({ settings, db = null, actions, site = null, now = () => Date.now(), transport = null, log = () => {} }) {
  const family = { gifts: null, cards: null, notes: null, recipes: null };
  connect({ gifts: null, recipes: null, trustRealIp: settings.trustRealIp });
  family.attach = (database) => {
    family.gifts = settings.gifts.enabled ? createGifts({ db: database, settings, now }) : null;
    family.cards = settings.cards.enabled ? createCards({ db: database, settings, now, transport }) : null;
    family.notes = settings.notes.enabled ? createNotes({ db: database, settings, now: () => new Date(now()) }) : null;
    family.recipes = settings.recipes.enabled ? createRecipes({ db: database, settings, now }) : null;
    connect({ gifts: family.gifts, recipes: family.recipes, trustRealIp: settings.trustRealIp });
  };
  if (db) family.attach(db);

  const server = createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url || "/", "http://family.invalid");
    } catch {
      return send(res, reply(400, { error: "bad-request" }));
    }
    let path = url.pathname;
    // open.blog's build writes a page's own addresses under the site's base path, so a form's
    // action reads e.g. /grammis-house/_zb/action/…: the same server functions as /_zb/action/….
    const base = settings.site.basePath || "/";
    if (base !== "/" && path.startsWith(`${base}_zb/`)) {
      path = path.slice(base.length - 1);
      req.url = `${path}${url.search}`;
    }
    try {
      const { gifts, cards, notes, recipes } = family;
      if (path === "/health") return send(res, reply(200, { ok: true, notes: Boolean(notes), cards: Boolean(cards), gifts: Boolean(gifts), recipes: Boolean(recipes) }));

      // A component's server function. Only pages from this same address may post to one (Zubra
      // refuses a browser's cross-site post), so the gift form works on the site this service serves.
      if (path.startsWith("/_zb/")) {
        if (await actions.handle(req, res)) return;
        return send(res, reply(404, { error: "not-found" }));
      }

      if (path === "/api" || path.startsWith("/api/")) {
        const parts = path.split("/").filter(Boolean).slice(1);
        const method = String(req.method || "GET").toUpperCase();
        const text = method === "POST" || method === "PATCH" ? await readText(req, MAX_JSON) : "";
        const body = text ? objectOf(text) : method === "POST" || method === "PATCH" ? {} : null;
        if (parts[0] === "gifts") {
          if (!gifts) return send(res, reply(404, { error: "not-enabled" }));
          if (parts[1] === "admin") return send(res, await gifts.owner({ method, parts: parts.slice(2), headers: req.headers, body }));
          if (method === "GET" && parts[1] === "tree" && parts.length === 2) return send(res, reply(200, await gifts.tree(), { "cache-control": "public, max-age=60" }));
          return send(res, reply(404, { error: "not-found" }));
        }
        if (parts[0] === "recipes") {
          if (!recipes) return send(res, reply(404, { error: "not-enabled" }));
          if (parts[1] === "admin") return send(res, await recipes.owner({ method, parts: parts.slice(2), headers: req.headers, body }));
          return send(res, reply(404, { error: "not-found" }));
        }
        if (parts[0] === "greetings") {
          if (!cards) return send(res, reply(404, { error: "not-enabled" }));
          return send(res, await cards.owner({ method, parts: parts.slice(1), headers: req.headers, body }));
        }
        if (!notes) return send(res, reply(503, { error: "Hosted engagement is not configured." }));
        return send(res, await notes({ method, path, query: url.searchParams, headers: req.headers, body, address: visitorAddress(req.headers, settings.trustRealIp) }));
      }

      if (site) return await site(req, res, url);
      return send(res, reply(404, { error: "not-found" }));
    } catch (error) {
      if (error instanceof HttpError) return send(res, reply(error.status, { error: error.code }));
      log(`request failed: ${error?.message || error}`);
      if (!res.headersSent) send(res, reply(500, { error: "failed" }));
      else res.end();
    }
  });

  family.server = server;
  return family;
}

async function main() {
  const log = (line) => console.log(`[family] ${line}`);
  const settings = readSettings(process.env);
  for (const part of ["notes", "cards", "gifts", "recipes"]) {
    if (settings[part].problems.length) log(`${part} are off: check ${settings[part].problems.join(", ")}`);
  }
  const actions = await createActions({
    components: COMPONENTS,
    secure: settings.production ? true : undefined,
    maxBytes: MAX_FORM,
    onError: (error) => log(`a server function failed: ${error?.message || error}`),
  });
  const site = settings.siteDir ? await createSite({ root: settings.siteDir, basePath: settings.site.basePath || "/", adminUrl: settings.adminUrl }) : null;
  const family = createFamily({ settings, actions, site, log });
  family.server.listen(settings.port, "0.0.0.0", () => log(`listening on ${settings.port}${site ? ", serving the site" : ""}`));

  // Her pages are up; now the database. Without one, notes, cards and gifts stay off (their
  // sections stay hidden) and the log says what to set. A database that doesn't answer yet is tried
  // again every 15 seconds, so the parts come on by themselves once it does.
  if (!settings.databaseUrl) {
    log("no DATABASE_URL: notes, cards, gifts and recipes are off. Add the Postgres reference to this service's variables.");
    return;
  }
  const db = createDatabase(settings.databaseUrl);
  for (let tries = 1; ; tries += 1) {
    try {
      await db.value("select 1 as value");
      await migrate(db, { log });
      break;
    } catch (error) {
      if (tries === 1 || tries % 20 === 0) log(`waiting for the database (${error.message}); trying every 15 seconds`);
      await new Promise((done) => setTimeout(done, 15000));
    }
  }
  family.attach(db);
  const on = ["notes", "cards", "gifts", "recipes"].filter((part) => family[part]);
  log(`database ready: ${on.length ? on.join(", ") : "nothing switched on"}`);
  if (family.cards) repeat(family.cards.sendCards, { log, label: "sending cards" });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[family] could not start: ${error?.message || error}`);
    process.exit(1);
  });
}
