// Notes on recipes (comments), page views, and Studio's moderation inbox, at the addresses open.blog's
// pages and Studio already use (the site's engagement endpoint is this service's /api):
//   GET  /api/comments?path=      a post's approved notes, while the post takes notes
//   POST /api/comments            { path, authorName, body }: stored pending, for Grammi to approve
//   POST /api/hit, GET /api/views a page view counted (one visitor a day), and a page's count
//   GET|PATCH /api/admin/moderation   the inbox: notes waiting, approved, turned down, taken off
//   GET  /api/admin/comments, /api/admin/analytics, /api/admin/health
// The admin routes need OPENBLOG_ADMIN_API_KEY (Studio's moderation token).
//
// This is open.blog's hosted engagement for a site that takes notes and nothing else: passage
// feedback, receipts and reports are off, and their addresses say so as open.blog's do when off.
// The moderation inbox's state machine is open.blog's own (vendor/openblog/lib/participation-
// moderation.mjs), and every change goes through its SQL function, which keeps the version and the
// audit event in one statement. Whether a post takes notes is what the built site says, in its
// openblog-comments.json, read from the folder this service serves (or the site's address).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { auditActor, MODERATION_STATES } from "./vendor/openblog/lib/feedback-moderation.mjs";
import {
  COMMENT_STATES, INBOX_ACTIONS, MODERATOR_ROLES, PARTICIPATION_KINDS, commentState, legacyCommentStatus, planTransition, timeKey,
} from "./vendor/openblog/lib/participation-moderation.mjs";
import { withinLimit } from "./lib/db.js";
import { hourOf, sameSecret } from "./lib/http.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z)~([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const INBOX_PAGE = 50;
const MODES = ["open", "locked", "hidden"];
const COLUMNS = "id, path, author_name, body, status, created_at, moderated_at, version, moderation_state, moderation_reason";
const FEEDBACK_UNAVAILABLE = "Passage feedback is not available on this site. The page itself is unchanged; you can copy your note and send it to the author instead.";
const PROTECTION_UNAVAILABLE = "This site does not offer receipts or reports through the form. You can write to the author instead.";

/** A time as open.blog's records write it: whole seconds, Z. */
export const canonicalTime = (value) => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.[0-9]{3}Z$/, "Z");
};

/** A post's path as the pages send it: "/…/" and nothing odd. */
export const cleanPath = (value) => {
  const path = String(value || "").trim();
  if (path.length < 2 || path.length > 500 || !path.startsWith("/") || path.startsWith("//") || !path.endsWith("/") || /[\\?#\u0000-\u001F]/.test(path)) return "";
  return path.split("/").some((segment) => segment === "." || segment === "..") ? "" : path;
};

const publicComment = (row) => ({ id: row.id, authorName: row.author_name, body: row.body, createdAt: row.created_at, ...(row.status ? { status: row.status } : {}) });

/** A comment row as an inbox item. */
const inboxComment = (row) => ({
  source: "comment",
  id: row.id,
  status: commentState(row.moderation_state, row.status),
  version: row.version ?? 1,
  moderatedAt: row.moderated_at ? canonicalTime(row.moderated_at) : null,
  reason: row.moderation_reason ?? null,
  comment: { path: row.path, authorName: row.author_name, body: row.body, createdAt: canonicalTime(row.created_at) },
});

/**
 * The SQL condition for comments in `state`, matching exactly the rows `commentState` reads as
 * `state` (open.blog's commentStateFilter, for Postgres), with its values from `$start` on; null when
 * no comment can be in it.
 */
export function commentStateCondition(state, start) {
  if (!COMMENT_STATES.includes(state)) return null;
  const status = legacyCommentStatus(state);
  if (state !== status) return { sql: `(status = $${start} and moderation_state = $${start + 1})`, values: [status, state] };
  const others = MODERATION_STATES.filter((other) => other !== state && legacyCommentStatus(other) === status);
  if (!others.length) return { sql: `status = $${start}`, values: [status] };
  return { sql: `(status = $${start} and (moderation_state is null or moderation_state <> all($${start + 1})))`, values: [status, others] };
}

export function createNotes({ db, settings, now = () => new Date(), siteFetch = globalThis.fetch }) {
  const { siteId, origin, basePath, salt } = settings.site;
  const { adminKey } = settings.notes;
  const json = (status, value, cors = "") => ({
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(cors ? { "access-control-allow-origin": cors, vary: "Origin" } : {}) },
    body: JSON.stringify(value),
  });

  // Whether a post takes notes: the mode the built site publishes for it; anything missing is hidden.
  const commentPolicy = async (path) => {
    let value = null;
    try {
      if (settings.siteDir) {
        value = JSON.parse(await readFile(join(settings.siteDir, "openblog-comments.json"), "utf8"));
      } else {
        const response = await siteFetch(new URL(`${basePath}openblog-comments.json`, `${origin}/`).href, { headers: { accept: "application/json" }, redirect: "error" });
        if (response.ok) value = await response.json();
      }
    } catch {
      value = null;
    }
    const mode = value && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, path) ? value[path] : "";
    return MODES.includes(mode) ? mode : "hidden";
  };

  const quota = (bucket, subject, perSubject, perSite) => {
    const hour = hourOf(now());
    const digest = createHash("sha256").update(`${salt}\0${bucket}\0${hour}\0${subject}`).digest("hex");
    return withinLimit(db, { siteId, bucket, hour, digest, perSubject, perSite });
  };

  const inboxRow = (id) => db.one(`select ${COLUMNS} from public.openblog_comments where site_id = $1 and id = $2`, [siteId, id]);

  /** One request: `path` is after /api/, `query` its parameters, `body` the parsed JSON (or null). */
  return async function notes({ method, path, query, headers, body, address }) {
    // A page may write from the site's own address (OPENBLOG_SITE_ORIGIN) or from whatever address this
    // service is being reached at (her own domain, say, in front of the Railway one): this service serves
    // the site itself, so a page on the same host as the request is one of hers.
    const requestOrigin = String(headers.origin || "").replace(/\/$/, "");
    const host = String(headers.host || "").trim().toLowerCase();
    const sameHost = Boolean(host) && /^[a-z0-9.-]+(:\d+)?$/.test(host) && requestOrigin.toLowerCase() === `https://${host}`;
    const cors = requestOrigin && (requestOrigin === origin || sameHost) ? requestOrigin : "";
    if (method === "OPTIONS") {
      if (!cors) return json(403, { error: "Origin is not allowed." });
      return {
        status: 204,
        headers: { "access-control-allow-origin": cors, "access-control-allow-headers": "Authorization, Content-Type", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", vary: "Origin" },
        body: "",
      };
    }
    const segments = path.split("/").filter(Boolean);
    const leaf = segments.at(-1) || "";
    const operation = segments.at(-2) === "admin" ? `admin/${leaf}` : leaf;
    const mutating = method === "POST" || method === "PATCH";
    const admin = sameSecret(String(headers.authorization || "").replace(/^Bearer\s+/i, ""), adminKey);
    if (mutating && !cors && !admin) return json(403, { error: "Origin is not allowed." });
    if (mutating && !body) return json(400, { error: "Invalid JSON." }, cors);
    const needAdmin = () => (admin ? null : json(401, { error: "Admin authorization is required." }, cors));

    try {
      if (operation === "comments" && method === "GET") {
        const page = cleanPath(query.get("path"));
        if (!page) return json(400, { error: "Invalid post path." }, cors);
        if (await commentPolicy(page) === "hidden") return json(200, { comments: [] }, cors);
        const rows = await db.rows(
          "select id, author_name, body, created_at from public.openblog_comments where site_id = $1 and path = $2 and status = 'approved' order by created_at asc limit 200",
          [siteId, page],
        );
        return json(200, { comments: rows.map(publicComment) }, cors);
      }
      if (operation === "comments" && method === "POST") {
        const page = cleanPath(body.path);
        const authorName = String(body.authorName || "").trim().replace(/\s+/g, " ");
        const text = String(body.body || "").trim();
        if (!page || authorName.length < 1 || authorName.length > 80 || text.length < 1 || text.length > 4000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
          return json(422, { error: "Enter a valid name and a comment no longer than 4,000 characters." }, cors);
        }
        const policy = await commentPolicy(page);
        if (policy !== "open") return json(403, { error: policy === "locked" ? "This discussion is read-only." : "Comments are not available for this post." }, cors);
        if (!(await quota("comments", address, 5, 500))) return json(429, { error: "Too many comments. Please try again later." }, cors);
        const row = await db.one(
          "insert into public.openblog_comments (site_id, path, author_name, body, status) values ($1, $2, $3, $4, 'pending') returning id",
          [siteId, page, authorName, text],
        );
        return json(202, { id: row.id, status: "pending" }, cors);
      }

      // What this site doesn't take, answered as open.blog answers when it's off.
      if (operation === "feedback" || operation === "admin/feedback") {
        if (operation === "admin/feedback" && !admin) return needAdmin();
        return json(404, { error: FEEDBACK_UNAVAILABLE, code: "unavailable" }, cors);
      }
      if (operation === "receipt" || operation === "reports") return json(404, { error: PROTECTION_UNAVAILABLE, code: "unavailable" }, cors);
      if (["admin/author-response", "admin/decisions", "admin/retention"].includes(operation)) {
        return needAdmin() ?? json(404, { error: "This site takes notes only.", code: "unavailable" }, cors);
      }

      if (operation === "admin/moderation") {
        const refused = needAdmin();
        if (refused) return refused;
        if (method === "GET") {
          if (query.has("id")) {
            const id = String(query.get("id"));
            if (!UUID.test(id) || query.get("source") !== "comment") return json(422, { error: "Name an item by its source and id." }, cors);
            const row = await inboxRow(id.toLowerCase());
            return json(200, { protocol: "full", thirdPerspectives: false, items: row ? [inboxComment(row)] : [], next: null }, cors);
          }
          const state = MODERATION_STATES.includes(query.get("state")) ? query.get("state") : "pending";
          const kind = query.get("kind") || "";
          if (kind && !PARTICIPATION_KINDS.includes(kind)) return json(422, { error: "Unknown participation kind." }, cors);
          let after = null;
          if (query.get("after")) {
            const match = CURSOR.exec(String(query.get("after")));
            if (!match) return json(422, { error: "Invalid page cursor." }, cors);
            after = { time: match[1], id: match[2] };
          }
          const limit = Math.min(Math.max(Number.parseInt(query.get("limit"), 10) || INBOX_PAGE, 1), 100);
          const condition = !kind || kind === "comment" ? commentStateCondition(state, 2) : null;
          if (!condition) return json(200, { protocol: "full", thirdPerspectives: false, items: [], next: null }, cors);
          const values = [siteId, ...condition.values];
          let cursor = "";
          if (after) {
            values.push(after.time, after.id);
            cursor = ` and (created_at > $${values.length - 1}::timestamptz or (created_at = $${values.length - 1}::timestamptz and id > $${values.length}::uuid))`;
          }
          values.push(limit + 1);
          const rows = await db.rows(
            `select ${COLUMNS} from public.openblog_comments where site_id = $1 and ${condition.sql}${cursor} order by created_at asc, id asc limit $${values.length}`,
            values,
          );
          const entries = rows.map((row) => ({ row, key: timeKey(row.created_at), id: String(row.id).toLowerCase() })).filter((entry) => entry.key);
          const page = entries.slice(0, limit);
          const last = page.at(-1);
          return json(200, {
            protocol: "full",
            thirdPerspectives: false,
            items: page.map((entry) => inboxComment(entry.row)),
            next: entries.length > limit && last ? `${last.key}~${last.id}` : null,
          }, cors);
        }
        if (method === "PATCH") {
          const id = String(body.id || "").toLowerCase();
          const version = body.expectedVersion;
          const role = body.actorRole === undefined ? "site-admin" : body.actorRole;
          if (body.source !== "comment" || !UUID.test(id) || !Number.isInteger(version) || version < 1 || version > 2147483647 || !MODERATION_STATES.includes(body.from)
            || !INBOX_ACTIONS.includes(body.action) || !MODERATOR_ROLES.includes(role)) {
            return json(422, { error: "Invalid moderation change.", code: "invalid" }, cors);
          }
          const row = await inboxRow(id);
          if (!row) return json(404, { error: "No such item.", code: "notFound" }, cors);
          const state = commentState(row.moderation_state, row.status);
          const conflict = (current) => json(409, { error: "This item changed since you loaded it. Review it again before acting.", code: "conflict", item: inboxComment(current) }, cors);
          if (state !== body.from || (row.version ?? 1) !== version) return conflict(row);
          const facts = {
            kind: "comment", state, version: row.version ?? 1, revision: 1, clarificationAsked: null, clarificationConsent: false,
            contentRetained: true, retained: true, parent: null, since: row.moderated_at || row.created_at,
          };
          const plan = planTransition(facts, { action: body.action, expectedVersion: version, reason: body.reason, role });
          if (!plan.ok) {
            if (plan.code === "stale") return conflict(row);
            return json(plan.code === "denied" ? 403 : 422, { error: "This moderation change is not allowed.", code: plan.code }, cors);
          }
          const { change } = plan;
          const changed = await db.rows(
            `select ${COLUMNS} from public.openblog_moderate_comment($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [siteId, id, version, change.from, change.to, change.action, change.reason, auditActor(body.actor), role, canonicalTime(now())],
          );
          if (changed.length === 1) return json(200, { ok: true, item: inboxComment(changed[0]) }, cors);
          const current = await inboxRow(id);
          return current ? conflict(current) : json(404, { error: "No such item.", code: "notFound" }, cors);
        }
      }
      if (operation === "admin/comments" && method === "GET") {
        const refused = needAdmin();
        if (refused) return refused;
        const status = ["pending", "approved", "rejected"].includes(query.get("status")) ? query.get("status") : "pending";
        const rows = await db.rows(
          "select id, path, author_name, body, status, created_at from public.openblog_comments where site_id = $1 and status = $2 order by created_at asc limit 200",
          [siteId, status],
        );
        return json(200, { comments: rows.map((row) => ({ ...publicComment(row), path: row.path })) }, cors);
      }
      if (operation === "admin/comments" && method === "PATCH") {
        return needAdmin() ?? json(409, { error: "Comments are moderated through /admin/moderation on this site.", code: "useModerationInbox" }, cors);
      }
      if (operation === "hit" && method === "POST") {
        if (headers.dnt === "1" || headers["sec-gpc"] === "1") return { status: 204, headers: cors ? { "access-control-allow-origin": cors, vary: "Origin" } : {}, body: "" };
        const page = cleanPath(body.path);
        if (!page) return json(400, { error: "Invalid page path." }, cors);
        const day = now().toISOString().slice(0, 10);
        const agent = String(headers["user-agent"] || "").slice(0, 500);
        const visitor = createHash("sha256").update(`${salt}\0${day}\0${address}\0${agent}`).digest("hex");
        if (!(await quota("analytics", address, 120, 20000))) return json(429, { error: "Analytics rate limit reached." }, cors);
        let referrer = "";
        try { referrer = new URL(String(body.referrer || "")).hostname.toLowerCase().slice(0, 253); } catch { /* no referrer */ }
        const result = await db.value("select public.openblog_record_view($1, $2::date, $3, $4, $5) as value", [siteId, day, page, visitor, referrer]);
        return json(200, { views: Number(result?.views ?? result ?? 0) }, cors);
      }
      if (operation === "views" && method === "GET") {
        const page = cleanPath(query.get("path"));
        if (!page) return json(400, { error: "Invalid page path." }, cors);
        const result = await db.value("select public.openblog_page_views($1, $2) as value", [siteId, page]);
        return json(200, { views: Number(result?.views ?? result ?? 0) }, cors);
      }
      if (operation === "export" && method === "GET") {
        return needAdmin() ?? json(404, { error: "This site doesn't export arrivals.", code: "exportOff" }, cors);
      }
      if (operation === "admin/analytics" && method === "GET") {
        const refused = needAdmin();
        if (refused) return refused;
        const days = [7, 30, 90, 365].includes(Number(query.get("days"))) ? Number(query.get("days")) : 30;
        return json(200, await db.value("select public.openblog_analytics_summary($1, $2) as value", [siteId, days]), cors);
      }
      if (operation === "admin/health" && method === "GET") {
        // Whether the tables this site's settings need are there. Yes, no or "can't tell"; never a value.
        const refused = needAdmin();
        if (refused) return refused;
        const table = async (id, name) => {
          try {
            const found = await db.value("select to_regclass($1) is not null as value", [`public.${name}`]);
            return { id, ok: found === true, code: found === true ? "ok" : "missing" };
          } catch {
            return { id, ok: null, code: "unreachable" };
          }
        };
        return json(200, {
          checks: [
            await table("comments", "openblog_comments"),
            await table("feedback", "openblog_feedback"),
            await table("moderation", "openblog_feedback_events"),
            await table("protection", "openblog_abuse_reports"),
            { id: "robot-secret", ok: false, code: "missing" },
          ],
        }, cors);
      }
      return json(404, { error: "No such engagement operation." }, cors);
    } catch (error) {
      console.error("family notes:", error.message);
      return json(502, { error: "The hosted data service is unavailable." }, cors);
    }
  };
}
