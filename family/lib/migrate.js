// Sets the database up at start: the roles open.blog's SQL grants to (roles.sql), then each of its
// SQL files the family service uses, applied when new or changed since it was last applied (each
// is written to be run twice safely). One start at a time, under an advisory lock.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL = new URL("../vendor/openblog/sql/", import.meta.url);
const LOCAL = new URL("../sql/", import.meta.url);
export const FILES = ["openblog", "moderation", "greetings", "gifts"];
// Ours, applied after open.blog's: a wider card, so a drawing and a small photo fit; recipes the
// family shares, waiting for her editor to collect them.
export const LOCAL_FILES = ["gift-scene", "recipes"];
const LOCK = 7_040_514_312; // any constant: the family service's migrations

async function applyFile(client, dir, name, log) {
  const text = await readFile(new URL(`${name}.sql`, dir), "utf8");
  const sum = createHash("sha256").update(text).digest("hex");
  const done = await client.query("select sha256 from public.openblog_service_migrations where file = $1", [name]);
  if (done.rows[0]?.sha256 === sum) return;
  log(`applying ${name}.sql`);
  await client.query(text);
  await client.query(
    "insert into public.openblog_service_migrations (file, sha256) values ($1, $2) on conflict (file) do update set sha256 = excluded.sha256, applied_at = now()",
    [name, sum],
  );
}

export async function migrate(db, { files = FILES, local = LOCAL_FILES, log = () => {} } = {}) {
  const client = await db.pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK]);
    await client.query(await readFile(new URL("roles.sql", SQL), "utf8"));
    for (const name of files) await applyFile(client, SQL, name, log);
    for (const name of local) await applyFile(client, LOCAL, name, log);
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK]).catch(() => {});
    client.release();
  }
}
