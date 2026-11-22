#!/usr/bin/env node
// Recipes from the family, and requests for hers, into Grammi's editor. Runs beside Studio in the editor's container
// (admin-entrypoint.sh starts it). Every minute it asks the family service for recipes the family
// has shared and writes each into the site checkout as a draft post:
//
//   content/posts/<date>-<slug>.md             draft: true, so it's never on the site until she publishes it
//   content/posts/<date>-<slug>.credits.json   who sent it, and the link they chose: "By <name>" on the page
//   static/images/family-recipes/<random>/     its photos, the first one the cover
//
// A request (someone asking for one of her recipes) becomes a draft for her to write, tagged
// `requested`, saying who asked; another request for the same recipe adds a name to that draft.
//
// Studio reads its folders fresh, so the draft is in Posts the next time she looks. She reads it,
// changes what she likes, and publishes it (or deletes it).
//
// Then it tells the service the recipe is delivered, and the service deletes its copy of the photos.
// A recipe already written (the service didn't hear back) is never written twice: the ones delivered
// are remembered in RECIPE_INBOX_STATE.
//
//   OPENBLOG_RECIPES_ENDPOINT   the family service's …/api/recipes
//   OPENBLOG_RECIPES_ADMIN_KEY  the recipes key
//   SITE                        the site checkout (/data/site)
//   RECIPE_INBOX_STATE          where the delivered ones are remembered (/data/.grammis-recipe-inbox.json)

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askedAgain, checkRecipe, checkRequest, cleanJpeg, draftFiles, requestPost, slugOf, LIMITS } from "../family/lib/recipe-check.js";

const MINUTE = 60 * 1000;

/** Writes a file whole or not at all: a reader never sees half of it. */
async function writeWhole(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temp = join(dirname(path), `.${randomBytes(6).toString("hex")}.part`);
  await writeFile(temp, data);
  await rename(temp, path);
}

/** The slugs the site's posts already have: the file name without its date, or its own `slug:`. */
export async function takenSlugs(site) {
  const posts = join(site, "content", "posts");
  const taken = new Set();
  for (const name of await readdir(posts).catch(() => [])) {
    if (!/\.(md|markdown)$/.test(name)) continue;
    taken.add(name.replace(/\.(md|markdown)$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, ""));
    const text = await readFile(join(posts, name), "utf8").catch(() => "");
    const own = /^---\r?\n[\s\S]*?^slug:\s*["']?([^"'\r\n]+)["']?\s*$/m.exec(text);
    if (own) taken.add(slugOf(own[1], ""));
  }
  return taken;
}

/** A slug no post has: the title's, or the title's with -2, -3, … after it. */
export function freeSlug(title, taken) {
  const base = slugOf(title);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Writes one recipe from the service ({ id, createdAt, author, recipe, photos: [base64] }) as a
 * draft in `site`. Answers the post's path, relative to the site. Checks it again first: only what
 * the family service would have taken is ever written.
 */
/**
 * Writes one request (someone asking Grammi for a recipe of hers) as a draft for her to write. When
 * she already has a request draft for the same recipe that she hasn't published, the new asker's name
 * is added to it instead, so five people asking for the stuffing is one draft that says so.
 */
export async function writeRequest(site, item, { today }) {
  const { asker, request } = checkRequest({ ...item.recipe, name: item.author?.name });
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(item.createdAt)) ? String(item.createdAt).slice(0, 10) : today;
  const slug = slugOf(request.title);
  const posts = join(site, "content", "posts");
  for (const name of await readdir(posts).catch(() => [])) {
    if (!name.endsWith(".md") || name.slice(0, -3).replace(/^\d{4}-\d{2}-\d{2}-/, "") !== slug) continue;
    const merged = askedAgain(await readFile(join(posts, name), "utf8"), { asker, request });
    if (merged) {
      await writeWhole(join(posts, name), merged);
      return `content/posts/${name}`;
    }
  }
  const path = `content/posts/${date}-${freeSlug(request.title, await takenSlugs(site))}.md`;
  await writeWhole(join(site, path), requestPost({ asker, request, date }));
  return path;
}

export async function writeDraft(site, item, { today }) {
  if (item.kind === "request") return writeRequest(site, item, { today });
  const { author, recipe } = checkRecipe({ ...item.recipe, name: item.author?.name, link: item.author?.link || "" });
  const photos = (Array.isArray(item.photos) ? item.photos : []).slice(0, LIMITS.photos)
    .map((data) => cleanJpeg(Buffer.from(String(data), "base64")))
    .filter((bytes) => bytes && bytes.length <= LIMITS.photoBytes);
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(item.createdAt)) ? String(item.createdAt).slice(0, 10) : today;
  const slug = freeSlug(recipe.title, await takenSlugs(site));
  const stem = `${date}-${slug}`;
  // An address nobody can guess, so a photo she hasn't published can't be found on her editor's site.
  const folder = `${slug.slice(0, 40)}-${randomBytes(8).toString("hex")}`;
  const files = draftFiles({ author, recipe, photos: photos.length, stem, folder, date });
  // The photos and the credits first, the post last: Studio lists it only once it's whole.
  for (const [index, path] of files.photos.entries()) await writeWhole(join(site, path), photos[index]);
  await writeWhole(join(site, files.credits.path), files.credits.text);
  await writeWhole(join(site, files.post.path), files.post.text);
  return files.post.path;
}

async function readState(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value && typeof value.delivered === "object" ? value : { delivered: {} };
  } catch {
    return { delivered: {} };
  }
}

/** One round: every waiting recipe written and reported delivered. Answers how many were new. */
export async function collect({ endpoint, key, site, stateFile, fetch = globalThis.fetch, today = new Date().toISOString().slice(0, 10), log = () => {} }) {
  const base = endpoint.replace(/\/+$/, "");
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const answer = await fetch(`${base}/admin/pending`, { headers });
  if (!answer.ok) throw new Error(`the family service answered ${answer.status}`);
  const { recipes = [] } = await answer.json();
  const state = await readState(stateFile);
  let written = 0;
  for (const item of recipes) {
    if (typeof item?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.id)) continue;
    let path = state.delivered[item.id];
    if (!path) {
      try {
        path = await writeDraft(site, item, { today });
      } catch (error) {
        log(`a recipe from the family could not be written (${error?.code || error?.message || error}); it stays waiting`);
        continue;
      }
      state.delivered[item.id] = path;
      await writeWhole(stateFile, `${JSON.stringify(state, null, 2)}\n`);
      written += 1;
      log(`a recipe from the family is in Posts as a draft: ${path}`);
    }
    const done = await fetch(`${base}/admin/${item.id}/delivered`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ path }) });
    if (!done.ok) log(`the family service didn't take the delivery of ${path} (${done.status}); it is asked again next time`);
  }
  return written;
}

async function main() {
  const endpoint = String(process.env.OPENBLOG_RECIPES_ENDPOINT || "").trim();
  const key = String(process.env.OPENBLOG_RECIPES_ADMIN_KEY || "");
  const site = process.env.SITE || "/data/site";
  const stateFile = process.env.RECIPE_INBOX_STATE || join(dirname(site), ".grammis-recipe-inbox.json");
  const log = (line) => console.log(`[recipes] ${line}`);
  if (!/^https?:\/\/\S+$/.test(endpoint) || key.length < 32) {
    log("off: set OPENBLOG_RECIPES_ENDPOINT and OPENBLOG_RECIPES_ADMIN_KEY to collect recipes from the family");
    return;
  }
  let quiet = 0;
  for (;;) {
    try {
      await collect({ endpoint, key, site, stateFile, log });
      quiet = 0;
    } catch (error) {
      // Said once, then every hour while it lasts, so a service that's down doesn't fill the log.
      if (quiet % 60 === 0) log(`couldn't reach the family service (${error?.message || error}); trying every minute`);
      quiet += 1;
    }
    await new Promise((done) => setTimeout(done, MINUTE));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`[recipes] stopped: ${error?.message || error}`);
    process.exit(1);
  });
}
