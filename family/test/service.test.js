// The whole service against a real Postgres: set FAMILY_TEST_DATABASE_URL to a server it may make a
// throwaway database on (postgres://user@host:port/postgres). Skipped without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import pg from "pg";
import { createActions } from "@zubra/actions";
import { COMPONENTS, createFamily } from "../server.js";
import { createDatabase } from "../lib/db.js";
import { migrate } from "../lib/migrate.js";
import { readSettings } from "../lib/settings.js";

const admin = process.env.FAMILY_TEST_DATABASE_URL;
const KEYS = { notes: "n".repeat(40), cards: "c".repeat(40), gifts: "g".repeat(40) };

test("the family service, end to end", { skip: !admin && "set FAMILY_TEST_DATABASE_URL to run" }, async (t) => {
  const name = `family_test_${process.pid}`;
  const root = new pg.Client({ connectionString: admin });
  await root.connect();
  await root.query(`drop database if exists ${name}`);
  await root.query(`create database ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  const db = createDatabase(url.href);
  let clock = Date.parse("2026-12-01T15:00:00Z");
  const sent = [];
  const settings = readSettings({
    OPENBLOG_SITE_ID: "grammis-house", OPENBLOG_SITE_ORIGIN: "https://grammi.example", OPENBLOG_SITE_BASE_PATH: "/grammis-house/",
    OPENBLOG_ANALYTICS_SALT: "s".repeat(32), OPENBLOG_ADMIN_API_KEY: KEYS.notes,
    OPENBLOG_GREETINGS_ENABLED: "true", OPENBLOG_GREETINGS_ADMIN_KEY: KEYS.cards, BREVO_API_KEY: "test", OPENBLOG_GREETINGS_FROM: "Grammi <g@example.com>",
    OPENBLOG_GIFTS_ENABLED: "true", OPENBLOG_GIFTS_ADMIN_KEY: KEYS.gifts,
  });
  await migrate(db);
  await migrate(db); // a second start changes nothing
  const actions = await createActions({ components: COMPONENTS });
  const family = createFamily({ settings, db, actions, now: () => clock, transport: async (mail) => { sent.push(mail); return { ok: true, id: "m1" }; } });
  family.server.listen(0, "127.0.0.1");
  await once(family.server, "listening");
  const base = `http://127.0.0.1:${family.server.address().port}`;
  const call = async (fn, fields = {}) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    const response = await fetch(`${base}/_zb/action/gift-maker/${fn}`, { method: "POST", body: form, headers: { accept: "application/json", "sec-fetch-site": "same-origin", "x-real-ip": "203.0.113.7" } });
    assert.equal(response.status, 200, `${fn} answers`);
    return response.json();
  };
  const owner = (path, key, init = {}) => fetch(`${base}${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) } }).then(async (r) => ({ status: r.status, body: await r.json() }));

  try {
    await t.test("gifts: hidden until ready, then taken through the form's server function", async () => {
      assert.equal((await call("look")).ready, false);
      assert.equal((await call("leave", { from: "Jimmy", kind: "note", note: "Hi", token: (await call("look")).token })).error, "token", "a token straight away is too quick");
      await owner("/api/gifts/admin/settings", KEYS.gifts, { method: "POST", body: JSON.stringify({ ready: true }) });
      const { token } = await call("look");
      clock += 5000;
      const left = await call("leave", { token, from: "Jimmy", showName: "on", kind: "note", note: "Merry Christmas", wrap: "plaid", bow: "red", spotX: "30", spotY: "80" });
      assert.equal(left.ok, true);
      assert.deepEqual(left.gift.spot, { x: 30, y: 80 });
      const tree = await call("look");
      assert.deepEqual(tree.gifts.map((gift) => [gift.from, gift.wrap, gift.bow]), [["Jimmy", "plaid", "red"]]);
      assert.equal(tree.gifts[0].note, undefined, "what a gift says is never public");
      const list = await owner("/api/gifts/admin/list", KEYS.gifts);
      assert.equal(list.body.gifts[0].note, undefined, "not even to Studio until it's opened");
      assert.equal((await owner(`/api/gifts/admin/${left.gift.id}/open`, KEYS.gifts, { method: "POST" })).status, 423);
      clock = Date.parse("2026-12-25T12:00:00Z");
      const opened = await owner(`/api/gifts/admin/${left.gift.id}/open`, KEYS.gifts, { method: "POST" });
      assert.equal(opened.body.gift.note, "Merry Christmas");
      assert.equal((await owner("/api/gifts/admin/list", "wrong".repeat(10))).status, 401);
    });

    await t.test("greeting cards: written in Studio, sent when due, a yearly one moved to next year", async () => {
      clock = Date.parse("2027-04-10T15:00:00Z");
      const contact = (await owner("/api/greetings/contacts", KEYS.cards, { method: "POST", body: JSON.stringify({ name: "Jimmy", email: "jimmy@example.com", birthday: "1980-04-11" }) })).body.contact;
      const card = (await owner("/api/greetings/cards", KEYS.cards, { method: "POST", body: JSON.stringify({ contactId: contact.id, design: "birthday", subject: "Happy birthday, {name}!", message: "Love, Mom", sendOn: "2027-04-11", hour: 8, timeZone: "America/New_York", yearly: true }) })).body.card;
      assert.equal(card.nextSendAt, "2027-04-11T12:00:00+00:00");
      assert.equal((await family.cards.sendCards()).sent, 0, "not before its time");
      clock = Date.parse("2027-04-11T12:05:00Z");
      const report = await family.cards.sendCards();
      assert.equal(report.sent, 1);
      assert.equal(sent[0].to.email, "jimmy@example.com");
      assert.equal(sent[0].subject, "Happy birthday, Jimmy!");
      const after = (await owner("/api/greetings/cards", KEYS.cards)).body.cards[0];
      assert.equal(after.status, "scheduled");
      assert.match(after.nextSendAt, /^2028-04-11T12:00:00/);
      assert.equal((await family.cards.sendCards()).sent, 0, "never twice");
    });

    await t.test("notes: left on a page, approved in the inbox, then shown", async () => {
      const siteNotes = family.notes;
      assert.ok(siteNotes);
      // No built site here: the posts' modes come from the site's address, which a test can't reach,
      // so the inbox is checked from a stored note.
      await db.rows("insert into public.openblog_comments (site_id, path, author_name, body) values ('grammis-house', '/posts/stuffing/', 'Ricky', 'Yum')");
      const inbox = await owner("/api/admin/moderation?state=pending", KEYS.notes);
      assert.equal(inbox.body.protocol, "full");
      const item = inbox.body.items[0];
      assert.equal(item.comment.authorName, "Ricky");
      const approved = await owner("/api/admin/moderation", KEYS.notes, { method: "PATCH", body: JSON.stringify({ source: "comment", id: item.id, expectedVersion: 1, from: "pending", action: "approve", actor: "grammi" }) });
      assert.equal(approved.body.item.status, "approved");
      assert.equal(approved.body.item.version, 2);
      const stale = await owner("/api/admin/moderation", KEYS.notes, { method: "PATCH", body: JSON.stringify({ source: "comment", id: item.id, expectedVersion: 1, from: "pending", action: "approve" }) });
      assert.equal(stale.status, 409);
      assert.equal((await owner("/api/admin/moderation", "x".repeat(40))).status, 401);
    });
  } finally {
    family.server.close();
    await db.close();
    await root.query(`drop database if exists ${name}`);
    await root.end();
  }
});
