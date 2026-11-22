// Notes to Grammi, and her pings. "Write to Grammi" on the Family Wall sends a note here; it is kept
// and emailed to her, with "reply" going to whoever wrote it when they left an address. Her own
// address (OPENBLOG_NOTIFY_EMAIL) is only ever here, never on the site.
//
// Every few minutes `ping` looks at what has come in since she was last told (recipes and requests
// from the family, drawings for the fridge, notes on recipes waiting for her) and, when there is
// anything, sends her one short email with links into her editor. It also sends any note whose email
// didn't go out the first time.
//
// The form (themes/grammis/components/family-mailbox.zb) reaches this through its own Zubra server
// functions: `look` (whether it's open, and a form token) and `write` (one note).

import { createHash } from "node:crypto";
import { checkFormToken, makeFormToken } from "./vendor/openblog/lib/gift-card.mjs";
import { LetterError, checkLetter, letterEmail, pingEmail } from "./lib/letters.js";
import { brevoTransport } from "./cards.js";
import { withinLimit } from "./lib/db.js";
import { hourOf } from "./lib/http.js";

const HOUR = 60 * 60 * 1000;
export const LETTER_RATES = Object.freeze({ perVisitorPerHour: 4, triesPerHour: 10, perDay: 60 });

function createStore(db, siteId) {
  const one = async (sql, values) => Number((await db.one(sql, values))?.n || 0);
  return {
    add: (row) => db.one(
      `insert into public.grammis_letters (site_id, from_name, reply_to, note, sender_digest, created_at)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [siteId, row.name, row.reply || null, row.note, row.digest, row.at],
    ),
    mailed: (id, at) => db.rows("update public.grammis_letters set mailed_at = $3 where site_id = $1 and id = $2", [siteId, id, at]),
    unmailed: () => db.rows("select id, from_name, reply_to, note from public.grammis_letters where site_id = $1 and mailed_at is null order by created_at asc limit 20", [siteId]),
    fromSender: (digest, since) => one("select count(*)::int as n from public.grammis_letters where site_id = $1 and sender_digest = $2 and created_at >= $3", [siteId, digest, since]),
    since: (since) => one("select count(*)::int as n from public.grammis_letters where site_id = $1 and created_at >= $2", [siteId, since]),
    toldUntil: async () => (await db.one("select told_until from public.grammis_pings where site_id = $1", [siteId]))?.told_until || null,
    told: (at) => db.rows(
      "insert into public.grammis_pings (site_id, told_until) values ($1, $2) on conflict (site_id) do update set told_until = excluded.told_until",
      [siteId, at],
    ),
    /** What came in between two times, from the other parts' own tables. */
    counts: async (after, until) => {
      const between = [siteId, after, until];
      return {
        recipes: await one("select count(*)::int as n from public.grammis_recipe_submissions where site_id = $1 and kind = 'recipe' and created_at > $2 and created_at <= $3", between),
        requests: await one("select count(*)::int as n from public.grammis_recipe_submissions where site_id = $1 and kind = 'request' and created_at > $2 and created_at <= $3", between),
        drawings: await one("select count(*)::int as n from public.grammis_fridge_drawings where site_id = $1 and created_at > $2 and created_at <= $3", between),
        comments: await one("select count(*)::int as n from public.openblog_comments where site_id = $1 and status = 'pending' and created_at > $2 and created_at <= $3", between),
      };
    },
  };
}

/** The letters part of the service. `transport` sends one email (Brevo's by default). */
export function createLetters({ db, settings, now = () => Date.now(), transport = null }) {
  const { to, from } = settings.letters;
  const siteName = settings.site.name || "your site";
  const store = createStore(db, settings.site.siteId);
  const send = transport || brevoTransport({ apiKey: settings.letters.apiKey });
  const salt = settings.site.salt;
  const secret = createHash("sha256").update(`${salt}\0letter-form`).digest("hex");
  const digestOf = (bucket, client, hour = "") => createHash("sha256").update(`${salt}\0${bucket}\0${hour}\0${client || "unknown"}`).digest("hex");

  const mailLetter = async (row) => {
    const mail = letterEmail({ name: row.from_name, note: row.note, reply: row.reply_to }, { siteName });
    const sent = await send({ from, to: { email: to }, ...(row.reply_to ? { replyTo: { email: row.reply_to, name: row.from_name } } : {}), tags: ["note-to-grammi"], ...mail });
    if (sent.ok) await store.mailed(row.id, new Date(now()).toISOString());
    return sent.ok;
  };

  /** Whether the form is open, and a fresh form token. */
  const look = () => ({ open: true, token: makeFormToken(secret, now()) });

  /** One note. Answers { ok } (kept, and on its way to her) or { error, field, status }. */
  async function write(fields, { address = "" } = {}) {
    try {
      if (String(fields.get("website") || "").trim()) return { ok: true };
      const at = now();
      if (!checkFormToken(String(fields.get("token") || ""), secret, at, { maxSeconds: 6 * 60 * 60 })) throw new LetterError("token", "token", 400);
      const hour = hourOf(at);
      if (!(await withinLimit(db, { siteId: settings.site.siteId, bucket: "letter-tries", hour, digest: digestOf("letter-tries", address, hour), perSubject: LETTER_RATES.triesPerHour, perSite: LETTER_RATES.perDay * 4 }))) {
        return { error: "slow-down", status: 429 };
      }
      const letter = checkLetter(fields);
      const digest = digestOf("letters", address);
      if (await store.fromSender(digest, new Date(at - HOUR).toISOString()) >= LETTER_RATES.perVisitorPerHour) return { error: "slow-down", status: 429 };
      if (await store.since(new Date(at - 24 * HOUR).toISOString()) >= LETTER_RATES.perDay) return { error: "full", status: 429 };
      const row = await store.add({ ...letter, digest, at: new Date(at).toISOString() });
      // Kept first, then mailed: one that doesn't go out now goes with the next ping.
      await mailLetter({ id: row.id, from_name: letter.name, reply_to: letter.reply, note: letter.note }).catch(() => false);
      return { ok: true };
    } catch (error) {
      if (error instanceof LetterError) return { error: error.code, field: error.field, status: error.status };
      return { error: "failed", status: 503 };
    }
  }

  /**
   * Tells her what has come in since the last ping, in one email, and sends any note that didn't go
   * out. The first ping only marks the time, so she isn't told about everything from before.
   * Answers { told, letters }.
   */
  async function ping() {
    let letters = 0;
    for (const row of await store.unmailed()) if (await mailLetter(row).catch(() => false)) letters += 1;
    const until = new Date(now()).toISOString();
    const after = await store.toldUntil();
    if (!after) {
      await store.told(until);
      return { told: false, letters };
    }
    const counts = await store.counts(after, until);
    const mail = pingEmail(counts, { editorUrl: settings.adminUrl, siteName });
    if (!mail) {
      await store.told(until);
      return { told: false, letters };
    }
    const sent = await send({ from, to: { email: to }, tags: ["ping"], ...mail });
    // Not sent: the same things are told next time, with whatever comes in meanwhile.
    if (sent.ok) await store.told(until);
    return { told: sent.ok, letters, counts };
  }

  return { look, write, ping, store };
}
