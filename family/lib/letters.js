// Notes to Grammi, and the emails the family service sends her. Pure: no database, no network.
//
// A note is what someone writes in "Write to Grammi" on the Family Wall: their name, the note, and,
// if they'd like her to write back, their email address. It goes to her by email; her own address is
// never on the site. A ping is one short email saying what has come in since the last one (recipes,
// requests, drawings, notes on recipes), with links into her editor.
//
// Everything anyone wrote is escaped before it goes into an email's HTML.

export const LIMITS = Object.freeze({ name: 60, note: 2000, email: 200 });

export class LetterError extends Error {
  constructor(code, field = null, status = 422) {
    super(code);
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

const text = (value) => (typeof value === "string" ? value : "");
const oneLine = (value) => text(value).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
const paragraphs = (value) => text(value).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ")
  .split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
const ADDRESS = /^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[A-Za-z]{2,24}$/;

/** An email address someone typed, or "" when they left it empty. Throws when it isn't one. */
export function checkAddress(value) {
  const address = oneLine(value);
  if (!address) return "";
  if (address.length > LIMITS.email || !ADDRESS.test(address)) throw new LetterError("email", "email");
  return address;
}

/** A note from the form's fields: { name, note, reply }. A name and a note are needed. */
export function checkLetter(form) {
  const field = (name) => text(typeof form.get === "function" ? form.get(name) : form[name]);
  const name = oneLine(field("name"));
  if (!name || name.length > LIMITS.name) throw new LetterError("name", "name");
  const note = paragraphs(field("note"));
  if (!note || note.length > LIMITS.note) throw new LetterError("note", "note");
  return { name, note, reply: checkAddress(field("email")) };
}

export const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const page = (inner) => `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f3ea;font:17px/1.6 Georgia,serif;color:#26231f">
<div style="max-width:560px;margin:0 auto;padding:24px 28px;background:#fffdf8;border-radius:12px;border:1px solid #e6dcc8">${inner}</div></body></html>`;

/** The email a note becomes: the note in full, and how to write back (or that they didn't say). */
export function letterEmail({ name, note, reply }, { siteName = "your site" } = {}) {
  const subject = `A note from ${name}`;
  const back = reply ? `To write back, just reply to this email (it goes to ${reply}).` : `${name} didn't leave an email address, so this one can't be answered by email.`;
  const text = `${name} wrote to you on ${siteName}:\n\n${note}\n\n${back}\n`;
  const html = page(`<p style="margin:0 0 12px;color:#6b6258">${escapeHtml(name)} wrote to you on ${escapeHtml(siteName)}:</p>
<div style="white-space:pre-wrap;font-size:19px;margin:0 0 18px">${escapeHtml(note)}</div>
<p style="margin:0;color:#6b6258;font-size:15px">${escapeHtml(back)}</p>`);
  return { subject, text, html };
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * The ping: what has come in since the last one. `counts` is { recipes, requests, drawings, comments };
 * `editorUrl` her editor's address (…/admin/), or "" to leave the links out. Null when nothing came.
 */
export function pingEmail(counts, { editorUrl = "", siteName = "your site" } = {}) {
  const base = editorUrl.replace(/\/+$/, "/");
  const lines = [
    counts.recipes ? { words: `${plural(counts.recipes, "recipe", "recipes")} from the family`, where: "Posts", path: "#/posts" } : null,
    counts.requests ? { words: `${plural(counts.requests, "request", "requests")} for one of your recipes`, where: "Posts", path: "#/posts" } : null,
    counts.drawings ? { words: `${plural(counts.drawings, "drawing", "drawings")} for your fridge`, where: "Fridge", path: "#/fridge" } : null,
    counts.comments ? { words: `${plural(counts.comments, "note", "notes")} on your recipes waiting for you to approve`, where: "Readers", path: "#/readers" } : null,
  ].filter(Boolean);
  if (!lines.length) return null;
  const subject = lines.length === 1 ? `New on ${siteName}: ${lines[0].words}` : `New on ${siteName}: ${lines.map((l) => l.words.split(" ").slice(0, 2).join(" ")).join(", ")}`;
  const text = `Here's what's come in on ${siteName}:\n\n${lines.map((l) => `- ${l.words} (in ${l.where}${base ? `: ${base}${l.path}` : ""})`).join("\n")}\n\nNothing goes on your site until you say so.\n`;
  const html = page(`<p style="margin:0 0 12px">Here's what's come in on ${escapeHtml(siteName)}:</p>
<ul style="margin:0 0 16px;padding-left:20px">${lines.map((l) => `<li style="margin:6px 0">${escapeHtml(l.words)}: ${base ? `<a href="${escapeHtml(base + l.path)}" style="color:#a3172b">open ${escapeHtml(l.where)}</a>` : `in ${escapeHtml(l.where)}`}</li>`).join("")}</ul>
<p style="margin:0;color:#6b6258;font-size:15px">Nothing goes on your site until you say so.</p>`);
  return { subject, text, html };
}
