// What a recipe the family shares with Grammi may hold, and how it becomes a draft in her editor.
// Pure: no database, no files. The family service checks a recipe with `checkRecipe` before it is
// stored; her editor's side (docker/recipe-inbox.mjs) turns a stored one into a draft post with
// `draftFiles`. Everything here rebuilds what it was given from known fields, so nothing a guest
// typed becomes markup: tags, links and images in their words are written as plain text.

export const LIMITS = Object.freeze({
  name: 60,
  link: 300,
  title: 100,
  description: 300,
  story: 4000,
  ingredient: 200,
  ingredients: 60,
  step: 1000,
  steps: 40,
  notes: 2000,
  servings: 40,
  time: 40,
  photos: 4,
  photoBytes: 900 * 1024,
  details: 600,
});

/** The courses Studio's recipes use; the form offers these and nothing else. */
export const COURSES = Object.freeze(["Breakfast", "Appetizer", "Soup", "Salad", "Main dish", "Side dish", "Bread", "Dessert", "Drink", "Snack"]);

export class RecipeError extends Error {
  constructor(code, field = null, status = 422) {
    super(code);
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

const text = (value) => (typeof value === "string" ? value : "");
// Control characters and the invisible marks that reorder text on screen (open.blog refuses a name
// with either), out of everything.
const HIDDEN = /[\u0000-\u0009\u000B-\u001F\u007F\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069\u2028\u2029]+/g;
/** One line: spaces squeezed, trimmed. */
export const oneLine = (value) => text(value).replace(/\r\n?|\n/g, " ").replace(HIDDEN, " ").replace(/\s+/g, " ").trim();
/** Paragraphs kept (at most one blank line between), each line trimmed. */
export const paragraphs = (value) => text(value).replace(/\r\n?/g, "\n").replace(HIDDEN, " ")
  .split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();

function within(value, max, code, field, { required = false } = {}) {
  if (value.length > max || (required && !value)) throw new RecipeError(code, field);
  return value;
}

/**
 * The link the author chose to share, as an absolute http(s) address, or null when they left it
 * empty. "instagram.com/jane" gets https:// in front. A handle on its own ("@jane") is not an address.
 */
export function checkLink(value) {
  let link = oneLine(value);
  if (!link) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(link)) link = `https://${link.replace(/^\/+/, "")}`;
  let url;
  try {
    url = new URL(link);
  } catch {
    throw new RecipeError("link", "link");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || !/\.[a-z0-9-]{2,}$/i.test(url.hostname)) throw new RecipeError("link", "link");
  if (url.href.length > LIMITS.link || /[\s"<>\\^`{|}]/.test(url.href)) throw new RecipeError("link", "link");
  return url.href;
}

/** A recipe from the form's fields (FormData), in the shape `checkRecipe` reads. */
export function recipeFromForm(form) {
  const field = (name) => text(form.get(name));
  const all = (name) => form.getAll(name).filter((value) => typeof value === "string");
  return {
    name: field("name"),
    link: field("link"),
    title: field("title"),
    description: field("description"),
    course: field("course"),
    servings: field("servings"),
    prep: field("prep"),
    cook: field("cook"),
    story: field("story"),
    ingredients: all("ingredient"),
    steps: all("step"),
    notes: field("notes"),
  };
}

/**
 * A recipe, checked and rebuilt from known fields: { author: { name, link }, recipe: {...} }.
 * A name, a title, one ingredient and one step are needed; the rest is up to the author.
 * Throws RecipeError naming the field.
 */
export function checkRecipe(input = {}) {
  const name = within(oneLine(input.name), LIMITS.name, "name", "name", { required: true });
  const link = checkLink(input.link);
  const title = within(oneLine(input.title), LIMITS.title, "title", "title", { required: true });
  const description = within(oneLine(input.description), LIMITS.description, "description", "description");
  const course = oneLine(input.course);
  if (course && !COURSES.includes(course)) throw new RecipeError("course", "course");
  const servings = within(oneLine(input.servings), LIMITS.servings, "servings", "servings");
  const prep = within(oneLine(input.prep), LIMITS.time, "time", "prep");
  const cook = within(oneLine(input.cook), LIMITS.time, "time", "cook");
  const story = within(paragraphs(input.story), LIMITS.story, "story", "story");
  const list = (values, max, each, code) => {
    // A pasted list keeps its own bullets and numbers ("1. Preheat"); the draft numbers it again.
    const lines = (Array.isArray(values) ? values : []).map((value) => oneLine(value).replace(/^(?:[-*+•·]|\d{1,2}[.)])\s+/, "")).filter(Boolean);
    if (lines.length > max) throw new RecipeError(`too-many-${code}`, code);
    for (const line of lines) if (line.length > each) throw new RecipeError(`${code.slice(0, -1)}-length`, code);
    if (!lines.length) throw new RecipeError(code, code);
    return lines;
  };
  const ingredients = list(input.ingredients, LIMITS.ingredients, LIMITS.ingredient, "ingredients");
  const steps = list(input.steps, LIMITS.steps, LIMITS.step, "steps");
  const notes = within(paragraphs(input.notes), LIMITS.notes, "notes", "notes");
  return { author: { name, link }, recipe: { title, description, course, servings, prep, cook, story, ingredients, steps, notes } };
}

/**
 * A photo as a JPEG with nothing hidden in it: the camera's notes (where it was taken, the phone, the
 * time) and comments are taken out, the picture itself is kept byte for byte. The form already
 * redraws every photo as a plain JPEG; this makes sure of it. Null when it isn't a JPEG.
 */
export function cleanJpeg(bytes) {
  const buf = Buffer.from(bytes);
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const kept = [buf.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= buf.length) {
    if (buf[at] !== 0xff) return null;
    const marker = buf[at + 1];
    if (marker === 0xff) { at += 1; continue; }
    // The picture itself starts here: the rest is kept as it is.
    if (marker === 0xda) { kept.push(buf.subarray(at)); return Buffer.concat(kept); }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { kept.push(buf.subarray(at, at + 2)); at += 2; continue; }
    const length = buf.readUInt16BE(at + 2);
    if (length < 2 || at + 2 + length > buf.length) return null;
    // APP1 to APP15 (Exif, XMP, maker notes, ...) and COM go; APP0 (JFIF) and the tables stay.
    const hidden = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!hidden) kept.push(buf.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  return null;
}

/** The photos from the form (File or Blob values named "photo"), checked and cleaned: Buffers. */
export async function photosFromForm(form) {
  const files = form.getAll("photo").filter((value) => value && typeof value === "object" && typeof value.arrayBuffer === "function" && value.size > 0);
  if (files.length > LIMITS.photos) throw new RecipeError("too-many-photos", "photo");
  const photos = [];
  for (const file of files) {
    if (file.size > LIMITS.photoBytes) throw new RecipeError("photo-too-big", "photo");
    const clean = cleanJpeg(Buffer.from(await file.arrayBuffer()));
    if (!clean) throw new RecipeError("bad-photo", "photo");
    photos.push(clean);
  }
  return photos;
}

// ---- The draft in her editor -------------------------------------------------------------------

/** A file name from a title: plain lowercase letters, digits and hyphens. */
export function slugOf(value, fallback = "family-recipe") {
  const slug = oneLine(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return slug || fallback;
}

/**
 * Words a guest typed, safe in a Markdown paragraph or list item: tags, links and images show as
 * the characters typed, and a line can't start a heading, a quote, a list or a code fence (so a
 * guest's "## Steps" can't become a second Steps section).
 */
export function markdownText(value) {
  return String(value).split("\n").map((line) => {
    const safe = line.replace(/\\/g, "\\\\").replace(/</g, "\\<").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
    return safe
      .replace(/^(\d+)([.)])(?=\s|$)/, "$1\\$2")
      .replace(/^([#>+*\-=_~`|])/, "\\$1");
  }).join("\n");
}

/** A front matter value: a JSON string is a double-quoted YAML string. */
const yaml = (value) => JSON.stringify(String(value));

/**
 * The files of the draft for one shared recipe:
 *   post    content/posts/<stem>.md, `draft: true`, so it is never on the site until she publishes it
 *   credits content/posts/<stem>.credits.json, the author's name and the link they chose, frozen
 *   photos  static/images/family-recipes/<folder>/<n>.jpg, the first one the cover
 * `stem` and `folder` are chosen by the caller (unused names); `date` is "YYYY-MM-DD".
 */
export function draftFiles({ author, recipe, photos = 0, stem, folder, date }) {
  const pictures = Array.from({ length: photos }, (_, index) => `/images/family-recipes/${folder}/${index + 1}.jpg`);
  const front = [
    "---",
    `title: ${yaml(recipe.title)}`,
    `date: ${date}`,
    "draft: true",
    "profile: recipe",
    ...(recipe.course ? [`course: ${yaml(recipe.course)}`] : []),
    ...(recipe.servings ? [`servings: ${yaml(recipe.servings)}`] : []),
    ...(recipe.prep ? [`prep: ${yaml(recipe.prep)}`] : []),
    ...(recipe.cook ? [`cook: ${yaml(recipe.cook)}`] : []),
    "tags: [from-the-family]",
    `description: ${yaml(recipe.description || `${recipe.title}, a family recipe ${author.name} shared with Grammi.`)}`,
    `cover: ${yaml(pictures[0] || "")}`,
    ...(pictures[0] ? [`coverAlt: ${yaml(`${recipe.title}, from ${author.name}`)}`] : []),
    "---",
  ];
  const alt = (index) => markdownText(oneLine(`${recipe.title}, ${index ? `photo ${index + 1} ` : ""}from ${author.name}`)).replace(/[()]/g, "");
  const body = [
    recipe.story ? markdownText(recipe.story) : `${markdownText(author.name)} shared this recipe with Grammi.`,
    ...pictures.slice(1).map((src, index) => `![${alt(index + 1)}](${src})`),
    "## Ingredients",
    recipe.ingredients.map((line) => `- ${markdownText(line)}`).join("\n"),
    "## Steps",
    recipe.steps.map((line, index) => `${index + 1}. ${markdownText(line)}`).join("\n"),
    ...(recipe.notes ? [`## ${markdownText(author.name)}'s notes`, markdownText(recipe.notes)] : []),
  ];
  const post = `${front.join("\n")}\n\n${body.join("\n\n")}\n`;
  // open.blog's frozen credits (version 2): the person as they gave themselves, needing no entry in
  // openblog.json. Her pages say "By <name>", linked to their page when they shared one.
  const credits = {
    version: 2,
    credits: [{
      identity: { kind: "profile", contributor: slugOf(author.name, "family-cook"), profile: { name: author.name, url: author.link || "", sameAs: [], orcid: "" } },
      roles: [{ vocabulary: "crossref", role: "author" }],
    }],
  };
  return {
    post: { path: `content/posts/${stem}.md`, text: post },
    credits: { path: `content/posts/${stem}.credits.json`, text: `${JSON.stringify(credits, null, 2)}\n` },
    photos: pictures.map((src) => `static${src}`),
  };
}

// ---- Asking Grammi for a recipe -----------------------------------------------------------------

/** A request from the form's fields: who's asking, which recipe, and a few words to jog her memory. */
export const requestFromForm = (form) => ({ name: text(form.get("name")), title: text(form.get("title")), details: text(form.get("details")) });

/** A request, checked: { asker, request: { title, details } }. A name and a recipe are needed. */
export function checkRequest(input = {}) {
  const asker = within(oneLine(input.name), LIMITS.name, "name", "name", { required: true });
  const title = within(oneLine(input.title), LIMITS.title, "title", "title", { required: true });
  const details = within(oneLine(input.details), LIMITS.details, "details", "details");
  return { asker, request: { title, details } };
}

const ASKED = "Asked for by ";
const ALSO = "Also asked for by ";
const asked = (lead, asker, details) => [`${lead}${markdownText(asker)}.`, ...(details ? [`> ${markdownText(details)}`] : [])].join("\n\n");

/**
 * The draft a request becomes: a recipe post with her usual empty parts to fill in, tagged
 * `requested`, that says who asked and what they said. It is hers to write: no credits.
 */
export function requestPost({ asker, request, date }) {
  const front = [
    "---",
    `title: ${yaml(request.title)}`,
    `date: ${date}`,
    "draft: true",
    "profile: recipe",
    "tags: [requested]",
    `description: ${yaml(`TODO: one sentence about ${request.title}, for search results and link previews.`)}`,
    'cover: ""',
    "---",
  ];
  const body = [
    asked(ASKED, asker, request.details),
    "TODO(Grammi): the story. Who taught you this, when you make it, who always asks for seconds.",
    "## Ingredients",
    "- TODO: start each line with the amount (2 cups flour) so the family can make half or double.",
    "## Steps",
    '1. TODO: first step. Write times like "bake for 45 minutes" and readers get a timer.',
  ];
  return `${front.join("\n")}\n\n${body.join("\n\n")}\n`;
}

/**
 * A request draft with one more person asking: their name, and what they said, added under the
 * others. Null when `text` isn't a request draft that's still a draft (she has published it, or
 * taken the "Asked for by" line out), so the caller makes a new one instead.
 */
export function askedAgain(text, { asker, request }) {
  const lines = String(text).split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end < 0 || !lines.slice(1, end).some((line) => line.replace(/\s+/g, "") === "draft:true")) return null;
  const first = lines.findIndex((line, index) => index > end && line.startsWith(ASKED));
  if (first < 0) return null;
  // The asking block: "Asked for by …", then any "Also asked for by …" and what each said.
  let last = first;
  for (let at = first + 1; at < lines.length; at += 1) {
    const line = lines[at];
    if (line.startsWith(ALSO) || line.startsWith("> ")) last = at;
    else if (line.trim() !== "") break;
  }
  return [...lines.slice(0, last + 1), "", asked(ALSO, asker, request.details), ...lines.slice(last + 1)].join("\n");
}
