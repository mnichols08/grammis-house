// Recipes from the family: what the form may send, and the draft her editor writes from it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecipeError, askedAgain, checkLink, checkRecipe, checkRequest, cleanJpeg, draftFiles, markdownText, photosFromForm, recipeFromForm, requestPost, slugOf } from "../lib/recipe-check.js";
import { readSettings } from "../lib/settings.js";
import { collect, freeSlug, takenSlugs, writeDraft } from "../../docker/recipe-inbox.mjs";

const segment = (marker, body) => {
  const data = Buffer.from(body);
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([head, data]);
};
/** A small JPEG-shaped file: JFIF, an Exif block with a place in it, a comment, a table, the picture. */
export const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  segment(0xe0, "JFIF\0\x01\x01\0\0\x01\0\x01\0\0"),
  segment(0xe1, "Exif\0\0GPS 40.7128 N 74.0060 W"),
  segment(0xfe, "taken at Grammi's house"),
  segment(0xdb, "\0".repeat(65)),
  Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x12, 0x34, 0x56, 0xff, 0xd9]),
]);

const sample = {
  name: "Aunt Linda",
  link: "instagram.com/lindabakes",
  title: "Linda's Peanut Butter Fudge",
  description: "",
  course: "Dessert",
  servings: "24 squares",
  prep: "10 min",
  cook: "5 min",
  story: "Mom made this every Christmas Eve.\n\n\n\nWe ate it before dinner.",
  ingredients: ["- 2 cups sugar", " ", "1 cup peanut butter"],
  steps: ["1. Boil the sugar and milk for 5 minutes.", "Stir in the peanut butter."],
  notes: "Don't double it: it won't set.",
};

test("a recipe is checked and rebuilt from known fields", () => {
  const { author, recipe } = checkRecipe(sample);
  assert.deepEqual(author, { name: "Aunt Linda", link: "https://instagram.com/lindabakes" });
  assert.deepEqual(recipe.ingredients, ["2 cups sugar", "1 cup peanut butter"], "empty lines out, pasted bullets off");
  assert.deepEqual(recipe.steps, ["Boil the sugar and milk for 5 minutes.", "Stir in the peanut butter."]);
  assert.equal(recipe.story, "Mom made this every Christmas Eve.\n\nWe ate it before dinner.");
  const fails = (change, code) => assert.throws(() => checkRecipe({ ...sample, ...change }), (error) => error instanceof RecipeError && error.code === code);
  fails({ name: " " }, "name");
  fails({ title: "" }, "title");
  fails({ ingredients: ["", " "] }, "ingredients");
  fails({ steps: [] }, "steps");
  fails({ course: "Brunch" }, "course");
  fails({ ingredients: Array(61).fill("1 egg") }, "too-many-ingredients");
  fails({ steps: ["x".repeat(1001)] }, "step-length");
  fails({ link: "javascript:alert(1)" }, "link");
});

test("a name can't hide characters that turn text around", () => {
  assert.equal(checkRecipe({ ...sample, name: "Linda\u202E\u2066 B." }).author.name, "Linda B.");
});

test("the link is the author's choice: an address of theirs, or nothing", () => {
  assert.equal(checkLink(""), null);
  assert.equal(checkLink("  "), null);
  assert.equal(checkLink("https://www.facebook.com/linda.b"), "https://www.facebook.com/linda.b");
  assert.equal(checkLink("tiktok.com/@lindabakes"), "https://tiktok.com/@lindabakes");
  for (const bad of ["@lindabakes", "javascript:alert(1)", "ftp://x.example/a", "https://user:pw@x.example/", "https://localhost/", "data:text/html,hi"]) {
    assert.throws(() => checkLink(bad), RecipeError, bad);
  }
});

test("a photo keeps its picture and loses what the camera wrote into it", () => {
  const clean = cleanJpeg(JPEG);
  assert.ok(clean);
  assert.equal(clean.includes(Buffer.from("GPS")), false);
  assert.equal(clean.includes(Buffer.from("Grammi's house")), false);
  assert.equal(clean.includes(Buffer.from("JFIF")), true);
  assert.deepEqual(clean.subarray(-15), JPEG.subarray(-15), "the picture itself is untouched");
  assert.equal(cleanJpeg(Buffer.from("<svg onload=alert(1)>")), null);
  assert.equal(cleanJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff])), null, "a segment longer than the file");
});

test("the form's fields and photos are read as the check expects", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(sample)) {
    if (Array.isArray(value)) for (const line of value) form.append(key === "ingredients" ? "ingredient" : "step", line);
    else form.set(key, value);
  }
  form.append("photo", new Blob([JPEG], { type: "image/jpeg" }), "a.jpg");
  assert.deepEqual(checkRecipe(recipeFromForm(form)), checkRecipe(sample));
  const photos = await photosFromForm(form);
  assert.equal(photos.length, 1);
  form.append("photo", new Blob([Buffer.from("GIF89a")]), "b.gif");
  await assert.rejects(photosFromForm(form), (error) => error.code === "bad-photo");
  const many = new FormData();
  for (let i = 0; i < 5; i += 1) many.append("photo", new Blob([JPEG]), `${i}.jpg`);
  await assert.rejects(photosFromForm(many), (error) => error.code === "too-many-photos");
  const big = new FormData();
  big.append("photo", new Blob([JPEG, Buffer.alloc(950 * 1024)]), "big.jpg");
  await assert.rejects(photosFromForm(big), (error) => error.code === "photo-too-big");
});

test("words a guest typed stay words in the draft", () => {
  assert.equal(markdownText("<script>alert(1)</script>"), "\\<script>alert(1)\\</script>");
  assert.equal(markdownText("[click](javascript:alert(1)) ![x](https://t.example/p.gif)"), "\\[click\\](javascript:alert(1)) !\\[x\\](https://t.example/p.gif)");
  assert.equal(markdownText("## Steps\n> quote\n1. one\n1.5 cups"), "\\## Steps\n\\> quote\n1\\. one\n1.5 cups", "no heading, quote or list; an amount stays an amount");
  assert.equal(markdownText("a \\<b>"), "a \\\\\\<b>", "a typed backslash can't undo the escape");
  assert.equal(slugOf("Linda's Peanut-Butter Fudge!"), "lindas-peanut-butter-fudge");
  assert.equal(slugOf("Crème brûlée"), "creme-brulee");
  assert.equal(slugOf("李"), "family-recipe");
});

test("the draft is a recipe post like hers, a draft, with the author's credits", () => {
  const checked = checkRecipe(sample);
  const files = draftFiles({ ...checked, photos: 2, stem: "2026-11-22-lindas-peanut-butter-fudge", folder: "fudge-0011", date: "2026-11-22" });
  assert.equal(files.post.path, "content/posts/2026-11-22-lindas-peanut-butter-fudge.md");
  assert.deepEqual(files.photos, ["static/images/family-recipes/fudge-0011/1.jpg", "static/images/family-recipes/fudge-0011/2.jpg"]);
  const text = files.post.text;
  assert.match(text, /^---\ntitle: "Linda's Peanut Butter Fudge"\ndate: 2026-11-22\ndraft: true\nprofile: recipe\ncourse: "Dessert"\nservings: "24 squares"\nprep: "10 min"\ncook: "5 min"\ntags: \[from-the-family\]\n/);
  assert.match(text, /\ndescription: "Linda's Peanut Butter Fudge, a family recipe Aunt Linda shared with Grammi."\n/);
  assert.match(text, /\ncover: "\/images\/family-recipes\/fudge-0011\/1.jpg"\ncoverAlt: "Linda's Peanut Butter Fudge, from Aunt Linda"\n---\n/);
  assert.match(text, /!\[Linda's Peanut Butter Fudge, photo 2 from Aunt Linda\]\(\/images\/family-recipes\/fudge-0011\/2.jpg\)/);
  assert.match(text, /## Ingredients\n\n- 2 cups sugar\n- 1 cup peanut butter\n\n## Steps\n\n1\. Boil the sugar and milk for 5 minutes\.\n2\. Stir in the peanut butter\.\n\n## Aunt Linda's notes\n\nDon't double it: it won't set\.\n$/);
  const credits = JSON.parse(files.credits.text);
  assert.deepEqual(credits, {
    version: 2,
    credits: [{
      identity: { kind: "profile", contributor: "aunt-linda", profile: { name: "Aunt Linda", url: "https://instagram.com/lindabakes", sameAs: [], orcid: "" } },
      roles: [{ vocabulary: "crossref", role: "author" }],
    }],
  });
  const quiet = draftFiles({ ...checkRecipe({ ...sample, link: "", story: "", notes: "", description: "Rich & \"easy\"" }), photos: 0, stem: "x", folder: "y", date: "2026-11-22" });
  assert.equal(JSON.parse(quiet.credits.text).credits[0].identity.profile.url, "", "no link: just the name");
  assert.match(quiet.post.text, /\ndescription: "Rich & \\"easy\\""\n/);
  assert.match(quiet.post.text, /\ncover: ""\n---\n\nAunt Linda shared this recipe with Grammi\.\n\n## Ingredients/);
  assert.doesNotMatch(quiet.post.text, /notes/);
});

test("recipes are on only when switched on and complete", () => {
  const base = { OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_ANALYTICS_SALT: "s".repeat(16) };
  assert.equal(readSettings(base).recipes.enabled, false);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_RECIPES_ENABLED: "true" }).recipes.problems, ["OPENBLOG_RECIPES_ADMIN_KEY"]);
  const on = readSettings({ ...base, OPENBLOG_RECIPES_ENABLED: "true", OPENBLOG_RECIPES_ADMIN_KEY: "r".repeat(32) });
  assert.equal(on.recipes.enabled, true);
  assert.equal(on.recipes.code, "");
  assert.deepEqual(readSettings({ ...base, OPENBLOG_RECIPES_ENABLED: "true", OPENBLOG_RECIPES_ADMIN_KEY: "r".repeat(32), OPENBLOG_RECIPES_FAMILY_CODE: "pie" }).recipes.problems, ["OPENBLOG_RECIPES_FAMILY_CODE"]);
});

test("her editor writes each shared recipe once, as a draft beside her posts", async () => {
  const site = await mkdtemp(join(tmpdir(), "recipe-inbox-"));
  try {
    await mkdir(join(site, "content", "posts"), { recursive: true });
    await writeFile(join(site, "content", "posts", "2026-11-01-pumpkin-pie.md"), "---\ntitle: Pie\n---\n");
    await writeFile(join(site, "content", "posts", "2026-10-01-other.md"), "---\ntitle: Other\nslug: \"lindas-peanut-butter-fudge\"\n---\n");
    assert.deepEqual([...(await takenSlugs(site))].sort(), ["lindas-peanut-butter-fudge", "other", "pumpkin-pie"]);
    assert.equal(freeSlug("Pumpkin Pie", new Set(["pumpkin-pie", "pumpkin-pie-2"])), "pumpkin-pie-3");

    const { author, recipe } = checkRecipe(sample);
    const item = { id: "0b6f6c55-3c33-4a4b-9a77-6f7cbbd3e0a1", createdAt: "2026-11-22T15:00:00.000000+00:00", author, recipe, photos: [JPEG.toString("base64"), Buffer.from("not a jpeg").toString("base64")] };
    const asked = [];
    const fetch = async (url, init = {}) => {
      asked.push([init.method || "GET", url, init.body ? JSON.parse(init.body) : null, init.headers.authorization]);
      if (url.endsWith("/admin/pending")) return new Response(JSON.stringify({ recipes: [item, { id: "../../etc", recipe }] }), { status: 200 });
      return new Response("{}", { status: url.includes("/delivered") ? 500 : 404 });
    };
    const stateFile = join(site, "state.json");
    const options = { endpoint: "https://family.example/api/recipes/", key: "k".repeat(40), site, stateFile, fetch, today: "2026-11-23" };
    assert.equal(await collect(options), 1);

    const path = "content/posts/2026-11-22-lindas-peanut-butter-fudge-2.md";
    assert.deepEqual(asked.map(([method, url]) => [method, url]), [
      ["GET", "https://family.example/api/recipes/admin/pending"],
      ["POST", `https://family.example/api/recipes/admin/${item.id}/delivered`],
    ], "a strange id is never written or asked about");
    assert.deepEqual(asked[1][2], { path });
    assert.equal(asked[0][3], `Bearer ${"k".repeat(40)}`);

    const post = await readFile(join(site, path), "utf8");
    assert.match(post, /draft: true/);
    const cover = /cover: "(\/images\/family-recipes\/[a-z0-9-]+\/1\.jpg)"/.exec(post)[1];
    const photo = await readFile(join(site, "static", cover));
    assert.equal(photo.includes(Buffer.from("GPS")), false, "the photo on disk has no place in it");
    const folder = await readdir(join(site, "static", "images", "family-recipes"));
    assert.equal(folder.length, 1);
    assert.deepEqual(await readdir(join(site, "static", "images", "family-recipes", folder[0])), ["1.jpg"], "the one that wasn't a JPEG is left out");
    assert.ok(JSON.parse(await readFile(join(site, path.replace(/\.md$/, ".credits.json")), "utf8")).credits[0]);

    // The service didn't hear it was delivered, so it offers it again: it's reported, not written twice.
    asked.length = 0;
    assert.equal(await collect(options), 0);
    assert.equal((await readdir(join(site, "content", "posts"))).filter((name) => name.endsWith(".md")).length, 3);
    assert.deepEqual(asked[1][2], { path });

    await assert.rejects(writeDraft(site, { ...item, recipe: { ...recipe, title: "" } }, { today: "2026-11-23" }), (error) => error.code === "title");
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});

test("a request names a recipe and who's asking, and becomes a draft for Grammi to write", () => {
  const asked = checkRequest({ name: " Jimmy ", title: "Your  pecan pie", details: "the one with the crumble top\nfrom Easter" });
  assert.deepEqual(asked, { asker: "Jimmy", request: { title: "Your pecan pie", details: "the one with the crumble top from Easter" } });
  assert.throws(() => checkRequest({ name: "Jimmy", title: " " }), (error) => error.code === "title");
  assert.throws(() => checkRequest({ name: "", title: "Pie" }), (error) => error.code === "name");
  assert.throws(() => checkRequest({ name: "J", title: "Pie", details: "x".repeat(601) }), (error) => error.code === "details");

  const post = requestPost({ ...asked, date: "2026-11-22" });
  assert.match(post, /^---\ntitle: "Your pecan pie"\ndate: 2026-11-22\ndraft: true\nprofile: recipe\ntags: \[requested\]\n/);
  assert.match(post, /\n---\n\nAsked for by Jimmy\.\n\n> the one with the crumble top from Easter\n\nTODO\(Grammi\)/);
  assert.match(post, /## Ingredients\n\n- TODO/);

  // More people asking add their names under the first; a request with nothing to say adds just the name.
  const twice = askedAgain(post, checkRequest({ name: "Linda <3", title: "pecan pie" }));
  const thrice = askedAgain(twice, checkRequest({ name: "Ricky", title: "Pecan Pie", details: "[with bourbon](javascript:x)" }));
  const asking = thrice.slice(thrice.indexOf("Asked for by"), thrice.indexOf("TODO(Grammi)"));
  assert.equal(asking, [
    "Asked for by Jimmy.",
    "> the one with the crumble top from Easter",
    "Also asked for by Linda \\<3.",
    "Also asked for by Ricky.",
    "> \\[with bourbon\\](javascript:x)",
    "",
  ].join("\n\n"), "names and words stay text");
  // Once she has published it, or taken the line out, it's hers: a new request makes a new draft.
  assert.equal(askedAgain(post.replace("draft: true", "draft: false"), asked), null);
  assert.equal(askedAgain(post.replace("Asked for by", "Requested by"), asked), null);
});

test("her editor merges requests for the same recipe into one draft while it's a draft", async () => {
  const site = await mkdtemp(join(tmpdir(), "recipe-requests-"));
  try {
    await mkdir(join(site, "content", "posts"), { recursive: true });
    const item = (id, name, title, details = "") => ({ id, kind: "request", createdAt: "2026-11-22T10:00:00Z", author: { name, link: null }, recipe: { title, details } });
    const first = await writeDraft(site, item("a", "Jimmy", "Pecan Pie", "crumble top"), { today: "2026-11-22" });
    assert.equal(first, "content/posts/2026-11-22-pecan-pie.md");
    assert.equal(await writeDraft(site, item("b", "Linda", "pecan pie"), { today: "2026-11-23" }), first, "the same draft");
    const text = await readFile(join(site, first), "utf8");
    assert.match(text, /Asked for by Jimmy\.\n\n> crumble top\n\nAlso asked for by Linda\./);
    assert.deepEqual(await readdir(join(site, "content", "posts")), ["2026-11-22-pecan-pie.md"], "no credits: the recipe is hers");

    // She publishes it; the next request is a new draft at a free address.
    await writeFile(join(site, first), text.replace("draft: true", "draft: false"));
    assert.equal(await writeDraft(site, item("c", "Ricky", "Pecan Pie"), { today: "2026-12-01" }), "content/posts/2026-11-22-pecan-pie-2.md");
  } finally {
    await rm(site, { recursive: true, force: true });
  }
});
