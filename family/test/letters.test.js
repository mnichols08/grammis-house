// Notes to Grammi, and her pings: what a note may hold, and the emails that tell her.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LetterError, checkAddress, checkLetter, letterEmail, pingEmail } from "../lib/letters.js";
import { readSettings } from "../lib/settings.js";

test("a note needs a name and words; an address only when they want her to write back", () => {
  assert.deepEqual(checkLetter({ name: "  Jimmy ", note: "Made the pie!\r\n\r\n\r\n\r\nIt was great.", email: "" }), { name: "Jimmy", note: "Made the pie!\n\nIt was great.", reply: "" });
  assert.equal(checkLetter({ name: "Jimmy", note: "Hi", email: " jimmy@example.org " }).reply, "jimmy@example.org");
  const fails = (input, code) => assert.throws(() => checkLetter(input), (error) => error instanceof LetterError && error.code === code);
  fails({ name: "", note: "Hi" }, "name");
  fails({ name: "Jimmy", note: "  " }, "note");
  fails({ name: "Jimmy", note: "x".repeat(2001) }, "note");
  fails({ name: "Jimmy", note: "Hi", email: "jimmy at home" }, "email");
  fails({ name: "Jimmy", note: "Hi", email: "a@b.c>,evil@x.com" }, "email");
  assert.equal(checkAddress(""), "");
});

test("the note reaches her as written, and nothing in it becomes markup", () => {
  const mail = letterEmail({ name: "Jimmy <b>", note: "<script>alert(1)</script>\nLove you", reply: "jimmy@example.org" }, { siteName: "Grammi's House" });
  assert.equal(mail.subject, "A note from Jimmy <b>");
  assert.match(mail.text, /Jimmy <b> wrote to you on Grammi's House:\n\n<script>alert\(1\)<\/script>\nLove you\n\nTo write back, just reply/);
  assert.doesNotMatch(mail.html, /<script>|<b>/);
  assert.match(mail.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(letterEmail({ name: "Ann", note: "Hi", reply: "" }).text, /Ann didn't leave an email address/);
});

test("a ping says what came in, with a link to each place, and is nothing when nothing came", () => {
  assert.equal(pingEmail({ recipes: 0, requests: 0, drawings: 0, comments: 0 }), null);
  const one = pingEmail({ recipes: 0, requests: 1, drawings: 0, comments: 0 }, { editorUrl: "https://editor.example/admin/", siteName: "Grammi's House" });
  assert.equal(one.subject, "New on Grammi's House: 1 request for one of your recipes");
  assert.match(one.text, /- 1 request for one of your recipes \(in Posts: https:\/\/editor\.example\/admin\/#\/posts\)/);
  const many = pingEmail({ recipes: 2, requests: 0, drawings: 1, comments: 3 }, { editorUrl: "https://editor.example/admin/" });
  assert.match(many.text, /2 recipes from the family[\s\S]*1 drawing for your fridge \(in Fridge: https:\/\/editor\.example\/admin\/#\/fridge\)[\s\S]*3 notes on your recipes waiting for you to approve \(in Readers/);
  assert.match(many.html, /href="https:\/\/editor\.example\/admin\/#\/readers"/);
  assert.doesNotMatch(pingEmail({ recipes: 1 }).text, /http/, "no editor address: no links");
});

test("notes and pings are on once her address is set, with the cards' sender and Brevo key", () => {
  const base = { OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_ANALYTICS_SALT: "s".repeat(16) };
  assert.equal(readSettings(base).letters.enabled, false);
  assert.deepEqual(readSettings({ ...base, OPENBLOG_NOTIFY_EMAIL: "grammi@example.org" }).letters.problems, ["BREVO_API_KEY", "OPENBLOG_GREETINGS_FROM"]);
  const on = readSettings({ ...base, OPENBLOG_NOTIFY_EMAIL: "grammi@example.org", BREVO_API_KEY: "k", OPENBLOG_GREETINGS_FROM: "Grammi <g@example.org>" });
  assert.equal(on.letters.enabled, true);
  assert.equal(on.letters.to, "grammi@example.org");
  assert.deepEqual(on.letters.from, { name: "Grammi", email: "g@example.org" });
  assert.deepEqual(readSettings({ ...base, OPENBLOG_NOTIFY_EMAIL: "not an address", BREVO_API_KEY: "k", OPENBLOG_GREETINGS_FROM: "g@example.org" }).letters.problems, ["OPENBLOG_NOTIFY_EMAIL"]);
});
