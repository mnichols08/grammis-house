// Greeting cards, the owner's side: the people she sends cards to and the cards themselves, for
// Studio only. Every route needs the cards key; nothing here is public. At open.blog's addresses:
//   GET  /api/greetings/status | contacts | cards
//   POST /api/greetings/contacts | contacts/<id> | contacts/<id>/remove
//   POST /api/greetings/cards | cards/<id> | cards/<id>/cancel | preview | test
// and every hour the cards whose time has come go out by email (Brevo). The rules (what a card may
// say, when it goes, how it reads) are open.blog's own (vendor/openblog/lib/greeting-*.mjs).

import { CardError, DESIGNS, LIMITS, checkCard, checkContact, isUuid, nextSendAt, renderCard } from "./vendor/openblog/lib/greeting-card.mjs";
import { sendDue } from "./vendor/openblog/lib/greeting-send.mjs";
import { reply, sameSecret } from "./lib/http.js";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const CONTACTS = "public.openblog_greeting_contacts";
const CARDS = "public.openblog_greeting_cards";
// What a card's row may be changed to: column names from this list only.
const CARD_COLUMNS = ["contact_id", "design", "subject", "message", "sign_off", "send_on", "send_hour", "time_zone", "yearly", "next_send_at", "status", "attempts", "error_code", "last_sent_at"];

const contactOut = (row) => ({ id: row.id, name: row.name, email: row.email, birthday: row.birthday || null });
const cardOut = (row) => ({
  id: row.id,
  contactId: row.contact_id,
  design: row.design,
  subject: row.subject,
  message: row.message,
  signOff: row.sign_off || "",
  sendOn: row.send_on,
  hour: row.send_hour,
  timeZone: row.time_zone,
  yearly: row.yearly === true,
  status: row.status,
  nextSendAt: row.next_send_at,
  lastSentAt: row.last_sent_at || null,
  attempts: Number(row.attempts) || 0,
  error: row.error_code || null,
});
const cardRow = (card, next) => ({
  contact_id: card.contactId,
  design: card.design,
  subject: card.subject,
  message: card.message,
  sign_off: card.signOff,
  send_on: card.sendOn,
  send_hour: card.hour,
  time_zone: card.timeZone,
  yearly: card.yearly,
  next_send_at: next.toISOString(),
  status: "scheduled",
  attempts: 0,
  error_code: null,
});

/** Brevo's transactional email: { ok, id } or { ok: false, code } with a fixed code; never throws. */
export function brevoTransport({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  return async (mail) => {
    let response;
    try {
      response = await fetchImpl(BREVO_URL, {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: mail.from,
          to: [mail.to],
          ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
          tags: Array.isArray(mail.tags) && mail.tags.length ? mail.tags.slice(0, 3) : ["greeting-card"],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return { ok: false, code: error?.name === "TimeoutError" ? "timeout" : "network" };
    }
    if (response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: true, id: typeof body.messageId === "string" ? body.messageId.slice(0, 200) : null };
    }
    const code = response.status === 401 || response.status === 403 ? "refused-key"
      : response.status === 429 ? "rate-limited"
      : response.status >= 500 ? "provider-error"
      : "rejected";
    return { ok: false, code };
  };
}

/** The cards' storage on Postgres, in the shape open.blog's sender (greeting-send.mjs) calls. */
export function createCardStore(db, siteId, now = () => Date.now()) {
  const stamp = () => new Date(now()).toISOString();
  const hourAgo = () => new Date(now() - 60 * 60 * 1000).toISOString();
  const update = async (id, row, { onlyStatus = null } = {}) => {
    const names = Object.keys(row).filter((name) => CARD_COLUMNS.includes(name));
    const values = names.map((name) => row[name]);
    const sets = names.map((name, index) => `${name} = $${index + 3}`);
    let guard = "";
    if (onlyStatus) {
      values.push(onlyStatus);
      guard = ` and status = any($${values.length + 2})`;
    }
    values.push(stamp());
    return db.one(`update ${CARDS} set ${[...sets, `updated_at = $${values.length + 2}`].join(", ")} where site_id = $1 and id = $2${guard} returning *`, [siteId, id, ...values]);
  };
  return {
    contacts: () => db.rows(`select id, name, email, birthday, created_at from ${CONTACTS} where site_id = $1 order by name asc limit 500`, [siteId]),
    contact: (id) => db.one(`select id, name, email, birthday from ${CONTACTS} where site_id = $1 and id = $2`, [siteId, id]),
    addContact: (row) => db.one(`insert into ${CONTACTS} (site_id, name, email, birthday) values ($1, $2, $3, $4) returning *`, [siteId, row.name, row.email, row.birthday ?? null]),
    updateContact: (id, row) => db.one(`update ${CONTACTS} set name = $3, email = $4, birthday = $5, updated_at = now() where site_id = $1 and id = $2 returning *`, [siteId, id, row.name, row.email, row.birthday ?? null]),
    // Removing a person removes their cards with them (ON DELETE CASCADE).
    removeContact: (id) => db.rows(`delete from ${CONTACTS} where site_id = $1 and id = $2`, [siteId, id]),

    cards: () => db.rows(`select * from ${CARDS} where site_id = $1 and status <> 'cancelled' order by next_send_at asc limit 1000`, [siteId]),
    card: (id) => db.one(`select * from ${CARDS} where site_id = $1 and id = $2`, [siteId, id]),
    addCard: (row) => {
      const names = Object.keys(row).filter((name) => CARD_COLUMNS.includes(name));
      return db.one(
        `insert into ${CARDS} (site_id, ${names.join(", ")}) values ($1, ${names.map((_, index) => `$${index + 2}`).join(", ")}) returning *`,
        [siteId, ...names.map((name) => row[name])],
      );
    },
    updateCard: update,
    // Cards whose time has come, and cards stuck "sending" for an hour (a sender that stopped).
    due: () => db.rows(
      `select * from ${CARDS} where site_id = $1 and next_send_at <= $2
         and (status = 'scheduled' or (status = 'sending' and updated_at < $3))
       order by next_send_at asc limit 50`,
      [siteId, stamp(), hourAgo()],
    ),
    // Takes a card for sending, in one statement; null when another run already took it.
    claim: (card) => db.one(
      `update ${CARDS} set status = 'sending', updated_at = $3
        where site_id = $1 and id = $2 and (status = 'scheduled' or (status = 'sending' and updated_at < $4))
       returning *`,
      [siteId, card.id, stamp(), hourAgo()],
    ),
  };
}

export function createCards({ db, settings, now = () => Date.now(), transport = null }) {
  const { siteId, zone, name: siteName } = settings.site;
  const cards = settings.cards;
  const store = createCardStore(db, siteId, now);
  const send = transport || brevoTransport({ apiKey: cards.apiKey });
  const mailSettings = { zone, from: cards.from, siteUrl: cards.siteUrl, siteName };

  /** The hourly run: sends what is due; counts only. */
  const sendCards = async () => {
    try {
      return { enabled: true, ...(await sendDue({ settings: mailSettings, store, transport: send, now })) };
    } catch (error) {
      return { enabled: true, sent: 0, error: error?.code || "failed" };
    }
  };

  /** Studio's side: `parts` are the path after /api/greetings/. */
  async function owner({ method, parts, headers, body }) {
    if (!sameSecret(String(headers.authorization || "").replace(/^Bearer /i, ""), cards.adminKey)) return reply(401, { error: "unauthorized" });
    const input = () => {
      if (!body) throw new CardError(400, "malformed");
      return body;
    };
    const known = (id) => {
      if (!isUuid(id)) throw new CardError(404, "not-found");
      return id;
    };
    const contactFor = async (id) => {
      const contact = await store.contact(known(id));
      if (!contact) throw new CardError(400, "contact-required", "contactId");
      return contact;
    };
    try {
      const [first, second, third] = parts;
      if (method === "GET" && first === "status" && parts.length === 1) {
        return reply(200, {
          enabled: true,
          timeZone: zone,
          from: cards.from,
          designs: Object.entries(DESIGNS).map(([id, d]) => ({ id, label: d.label, subject: d.subject })),
          limits: LIMITS,
        });
      }
      if (first === "contacts") {
        if (method === "GET" && parts.length === 1) return reply(200, { contacts: (await store.contacts()).map(contactOut) });
        if (method === "POST" && parts.length === 1) {
          if ((await store.contacts()).length >= LIMITS.contacts) throw new CardError(409, "too-many");
          return reply(200, { contact: contactOut(await store.addContact(checkContact(input()))) });
        }
        if (method === "POST" && parts.length === 2) {
          const row = await store.updateContact(known(second), checkContact(input()));
          if (!row) throw new CardError(404, "not-found");
          return reply(200, { contact: contactOut(row) });
        }
        if (method === "POST" && parts.length === 3 && third === "remove") {
          await store.removeContact(known(second));
          return reply(200, { removed: true });
        }
      }
      if (first === "cards") {
        if (method === "GET" && parts.length === 1) return reply(200, { cards: (await store.cards()).map(cardOut) });
        if (method === "POST" && parts.length === 1) {
          const card = checkCard(input(), zone);
          await contactFor(card.contactId);
          if ((await store.cards()).length >= LIMITS.cards) throw new CardError(409, "too-many");
          const next = nextSendAt({ sendOn: card.sendOn, hour: card.hour, zone: card.timeZone, yearly: card.yearly }, now());
          return reply(200, { card: cardOut(await store.addCard(cardRow(card, next))) });
        }
        if (method === "POST" && parts.length === 2) {
          const card = checkCard(input(), zone);
          await contactFor(card.contactId);
          const next = nextSendAt({ sendOn: card.sendOn, hour: card.hour, zone: card.timeZone, yearly: card.yearly }, now());
          // A card on its way out can't be changed under the sender.
          const row = await store.updateCard(known(second), cardRow(card, next), { onlyStatus: ["scheduled", "failed", "sent"] });
          if (!row) throw new CardError(409, "busy");
          return reply(200, { card: cardOut(row) });
        }
        if (method === "POST" && parts.length === 3 && third === "cancel") {
          const row = await store.updateCard(known(second), { status: "cancelled" }, { onlyStatus: ["scheduled", "failed", "sent"] });
          if (!row) throw new CardError(409, "busy");
          return reply(200, { cancelled: true });
        }
      }
      if ((first === "preview" || first === "test") && method === "POST" && parts.length === 1) {
        const card = checkCard(input(), zone);
        const contact = await contactFor(card.contactId);
        const at = nextSendAt({ sendOn: card.sendOn, hour: card.hour, zone: card.timeZone, yearly: card.yearly }, now());
        const sendDay = new Intl.DateTimeFormat("en-CA", { timeZone: card.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
        const mail = renderCard(card, { contact, from: cards.from, siteUrl: cards.siteUrl, siteName, sendDay });
        if (first === "preview") return reply(200, { subject: mail.subject, html: mail.html, sendsAt: at.toISOString() });
        // A test goes to the owner's own sending address, never to the person on the card.
        const result = await send({ ...mail, subject: `[Test] ${mail.subject}`, to: { email: cards.from.email, name: cards.from.name || cards.from.email } });
        return result.ok ? reply(200, { sent: true, to: cards.from.email }) : reply(502, { error: "send-failed", code: result.code });
      }
      return reply(404, { error: "not-found" });
    } catch (error) {
      if (error instanceof CardError) return reply(error.status, { error: error.code, field: error.field });
      if (error?.code === "23503") return reply(400, { error: "contact-required", field: "contactId" }); // the person was removed meanwhile
      return reply(503, { error: "storage-unavailable" });
    }
  }

  return { owner, sendCards, store };
}
