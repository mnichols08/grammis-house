// The database: Postgres, reached directly. Times come back exactly as open.blog's tools have always
// seen them (PostgREST's JSON: "2026-11-20T03:51:53.123456+00:00", microseconds kept), dates as
// "YYYY-MM-DD", so the moderation inbox's page cursors and Studio's answers don't change.

import pg from "pg";

const TIMESTAMPTZ = 1184;
const TIMESTAMP = 1114;
const DATE = 1082;
const INT8 = 20;

/** Postgres's own text for a timestamptz in UTC ("2026-11-20 03:51:53.1234+00") as PostgREST writes it. */
export function isoTime(text) {
  if (text === null || text === undefined) return text;
  const match = /^(\d{4,}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)([+-]\d\d)(?::?(\d\d))?$/.exec(String(text));
  if (!match) return String(text);
  return `${match[1]}T${match[2]}${match[3]}:${match[4] || "00"}`;
}

const types = {
  getTypeParser(oid, format) {
    if (oid === TIMESTAMPTZ) return isoTime;
    if (oid === TIMESTAMP || oid === DATE) return (value) => value;
    if (oid === INT8) return (value) => Number(value);
    return pg.types.getTypeParser(oid, format);
  },
};

/** A pool on `url`, every session in UTC. */
export function createDatabase(url, { max = 5 } = {}) {
  const pool = new pg.Pool({ connectionString: url, max, types, options: "-c TimeZone=UTC", connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  pool.on("error", () => {}); // an idle client the server dropped; the next query takes another
  return {
    pool,
    /** The rows of one statement. */
    rows: async (text, values = []) => (await pool.query({ text, values, types })).rows,
    /** The first row, or null. */
    one: async (text, values = []) => (await pool.query({ text, values, types })).rows[0] ?? null,
    /** One SQL function's single value (`select fn(...) as value`). */
    value: async (text, values = []) => (await pool.query({ text, values, types })).rows[0]?.value ?? null,
    close: () => pool.end(),
  };
}

/** The shared hourly limit open.blog's SQL keeps (openblog_consume_rate_limit): false when over. */
export async function withinLimit(db, { siteId, bucket, hour, digest, perSubject, perSite }) {
  const reply = await db.value(
    "select public.openblog_consume_rate_limit($1, $2, $3, $4, $5, $6) as value",
    [siteId, bucket, hour, digest, perSubject, perSite],
  );
  return Boolean(reply?.allowed ?? reply);
}
