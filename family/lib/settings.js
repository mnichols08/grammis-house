// The service's settings, read once from its environment. The names are open.blog's own (the same a
// Netlify or Railway service of open.blog's takes), so moving between them changes nothing.
// Each part is on only when it is switched on AND complete; otherwise it is off, with the names
// (never the values) of what is wrong.

import { isTimeZone } from "../vendor/openblog/lib/greeting-card.mjs";

const text = (value) => String(value ?? "");
const on = (value) => text(value).trim().toLowerCase() === "true";
const SITE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const HTTPS_ORIGIN = /^https:\/\/[^\s"<>/]+$/;
// open.blog's own pattern for the sender ("Grammi <grammi@example.com>" or a bare address).
const SENDER = /^(?:([^<>\r\n"]{1,80}) <([^\s@<>",;]{1,64}@[^\s@<>",;]{1,200}\.[A-Za-z]{2,24})>|([^\s@<>",;]{1,64}@[^\s@<>",;]{1,200}\.[A-Za-z]{2,24}))$/;
const longKey = (value) => text(value).length >= 32 && !/\s/.test(text(value));

export function readSettings(env = process.env) {
  const siteId = text(env.OPENBLOG_SITE_ID).trim();
  const origin = text(env.OPENBLOG_SITE_ORIGIN).trim().replace(/\/+$/, "");
  const basePath = text(env.OPENBLOG_SITE_BASE_PATH || "/").trim();
  const salt = text(env.OPENBLOG_ANALYTICS_SALT);
  const zone = text(env.OPENBLOG_GREETINGS_TIME_ZONE || "America/New_York").trim();
  const site = { siteId, origin, basePath, salt, zone, name: text(env.OPENBLOG_SITE_NAME).trim().slice(0, 80) };
  const shared = [];
  if (!SITE_ID.test(siteId)) shared.push("OPENBLOG_SITE_ID");
  if (!HTTPS_ORIGIN.test(origin)) shared.push("OPENBLOG_SITE_ORIGIN");
  if (!/^\/(?:[^\\?#\u0000-\u001F]*\/)?$/.test(basePath) || basePath.includes("//") || basePath.split("/").some((s) => s === "." || s === "..")) shared.push("OPENBLOG_SITE_BASE_PATH");
  if (salt.length < 16) shared.push("OPENBLOG_ANALYTICS_SALT");
  if (!isTimeZone(zone)) shared.push("OPENBLOG_GREETINGS_TIME_ZONE");

  // Notes on recipes: on whenever the shared settings and the moderation key are there (as open.blog's
  // engagement is), with the moderation inbox's full schema, which this service always installs.
  const notesProblems = [...shared];
  if (!longKey(env.OPENBLOG_ADMIN_API_KEY)) notesProblems.push("OPENBLOG_ADMIN_API_KEY");
  const notes = notesProblems.length ? { enabled: false, problems: notesProblems } : { enabled: true, problems: [], adminKey: text(env.OPENBLOG_ADMIN_API_KEY) };

  let cards = { enabled: false, problems: [] };
  if (on(env.OPENBLOG_GREETINGS_ENABLED)) {
    const problems = [...shared];
    const sender = SENDER.exec(text(env.OPENBLOG_GREETINGS_FROM).trim());
    if (!longKey(env.OPENBLOG_GREETINGS_ADMIN_KEY)) problems.push("OPENBLOG_GREETINGS_ADMIN_KEY");
    if (!text(env.BREVO_API_KEY).trim() || /\s/.test(text(env.BREVO_API_KEY).trim())) problems.push("BREVO_API_KEY");
    if (!sender) problems.push("OPENBLOG_GREETINGS_FROM");
    cards = problems.length ? { enabled: false, problems } : {
      enabled: true,
      problems: [],
      adminKey: text(env.OPENBLOG_GREETINGS_ADMIN_KEY),
      apiKey: text(env.BREVO_API_KEY).trim(),
      from: sender[3] ? { email: sender[3] } : { name: sender[1].trim(), email: sender[2] },
      siteUrl: `${origin}${basePath}`,
    };
  }

  let gifts = { enabled: false, problems: [] };
  if (on(env.OPENBLOG_GIFTS_ENABLED)) {
    const problems = [...shared];
    const code = text(env.OPENBLOG_GIFTS_FAMILY_CODE);
    const opensOn = text(env.OPENBLOG_GIFTS_OPENS_ON || "12-25").trim();
    if (!longKey(env.OPENBLOG_GIFTS_ADMIN_KEY)) problems.push("OPENBLOG_GIFTS_ADMIN_KEY");
    if (code && code.replace(/[^\p{L}\p{N}]+/gu, "").length < 6) problems.push("OPENBLOG_GIFTS_FAMILY_CODE");
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(opensOn)) problems.push("OPENBLOG_GIFTS_OPENS_ON");
    gifts = problems.length ? { enabled: false, problems } : { enabled: true, problems: [], adminKey: text(env.OPENBLOG_GIFTS_ADMIN_KEY), code, opensOn };
  }

  // Recipes from the family: a form on her front page, collected by her editor as drafts. The family
  // password is optional: without one anyone may send a recipe (she still reads each before it's up).
  let recipes = { enabled: false, problems: [] };
  if (on(env.OPENBLOG_RECIPES_ENABLED)) {
    const problems = [...shared];
    const code = text(env.OPENBLOG_RECIPES_FAMILY_CODE);
    if (!longKey(env.OPENBLOG_RECIPES_ADMIN_KEY)) problems.push("OPENBLOG_RECIPES_ADMIN_KEY");
    if (code && code.replace(/[^\p{L}\p{N}]+/gu, "").length < 6) problems.push("OPENBLOG_RECIPES_FAMILY_CODE");
    recipes = problems.length ? { enabled: false, problems } : { enabled: true, problems: [], adminKey: text(env.OPENBLOG_RECIPES_ADMIN_KEY), code };
  }

  // The fridge on The Family Wall: magnets anyone may move, drawings Grammi puts up in Studio's Fridge
  // screen, which reaches the service with this key (as Gifts does).
  let fridge = { enabled: false, problems: [] };
  if (on(env.OPENBLOG_FRIDGE_ENABLED)) {
    const problems = [...shared];
    if (!longKey(env.OPENBLOG_FRIDGE_ADMIN_KEY)) problems.push("OPENBLOG_FRIDGE_ADMIN_KEY");
    fridge = problems.length ? { enabled: false, problems } : { enabled: true, problems: [], adminKey: text(env.OPENBLOG_FRIDGE_ADMIN_KEY) };
  }

  return {
    site,
    notes,
    cards,
    gifts,
    recipes,
    fridge,
    databaseUrl: text(env.DATABASE_URL).trim(),
    port: Number(env.PORT || 8080),
    // Behind Railway's proxy the visitor's address is X-Real-IP; anywhere else, say false.
    trustRealIp: text(env.OPENBLOG_TRUST_X_REAL_IP || "true").trim() !== "false",
    // The built site to serve (the Dockerfile builds it here); none means the service only answers.
    siteDir: text(env.FAMILY_SITE_DIR).trim(),
    // Where /admin goes (her editor's sign-in): https://…/admin/.
    adminUrl: /^https:\/\/[^\s"<>]+\/admin\/?$/.test(text(env.OPENBLOG_ADMIN_URL).trim()) ? text(env.OPENBLOG_ADMIN_URL).trim() : "",
    production: text(env.NODE_ENV) === "production",
  };
}
