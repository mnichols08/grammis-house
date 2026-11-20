// Grammi's built site, served under its base path (/grammis-house/, as openblog.json's url says), so
// every page and the family service share one address and the gift form's server functions are on
// the same origin as the page. It does what a static host does:
//
//   - `/` goes to the site's front page; `/admin` and `/admin/*` to her editor (OPENBLOG_ADMIN_URL);
//   - files from the build folder, `/a/` as `/a/index.html`, `/a` moved to `/a/` when that folder exists;
//   - the exact redirects `openblog build` writes in `_redirects`;
//   - the feeds and the latest-posts JSON readable by scripts on other sites;
//   - `404.html` for anything missing; ETags so a browser revalidates.
//
// Only GET and HEAD. A path never leaves the folder.

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".webm": "video/webm", ".pdf": "application/pdf", ".wasm": "application/wasm",
};
const OPEN_TO_ALL = new Set(["api/blog.json", "api/views.json", "feed.json", "rss.xml"]);

/** The exact-path redirects of a `_redirects` file: Map(from → { to, status }). */
export function parseRedirects(text) {
  const rules = new Map();
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [from, to, status = "301", ...rest] = line.split(/\s+/);
    const code = Number(status.replace(/!$/, ""));
    if (rest.length || !from?.startsWith("/") || /[*:]/.test(from) || !to || ![301, 302, 307, 308].includes(code)) continue;
    rules.set(from, { to, status: code });
  }
  return rules;
}

/** A request handler for the site built in `root`, served under `basePath`. */
export async function createSite({ root, basePath = "/", adminUrl = "" }) {
  const base = normalize(root);
  const rules = parseRedirects(await readFile(join(base, "_redirects"), "utf8").catch(() => ""));
  const fileAt = async (path) => ((await stat(path).catch(() => null))?.isFile() ? path : null);
  const dirAt = async (path) => Boolean((await stat(path).catch(() => null))?.isDirectory());
  const inside = (relativePath) => {
    let decoded;
    try {
      decoded = decodeURIComponent(relativePath);
    } catch {
      return null;
    }
    if (decoded.includes("\0")) return null;
    const path = normalize(join(base, decoded));
    return path === base || path.startsWith(base + sep) ? path : null;
  };

  return async function site(req, res, url) {
    const pathname = url.pathname;
    const go = (status, location) => res.writeHead(status, { location, "cache-control": "no-store" }).end();
    if (adminUrl && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
      return go(302, `${adminUrl.replace(/\/+$/, "")}${pathname === "/admin" ? "/" : pathname.slice("/admin".length)}${url.search}`);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" }).end("Method not allowed\n");
    if (pathname === "/" && basePath !== "/") return go(302, basePath);
    if (`${pathname}/` === basePath) return go(301, basePath);
    const rule = rules.get(pathname);
    if (rule) return go(rule.status, rule.to);

    let file = null;
    let status = 200;
    const within = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : null;
    const path = within === null ? null : inside(within);
    if (path) {
      if (pathname.endsWith("/")) file = await fileAt(join(path, "index.html"));
      else {
        file = await fileAt(path);
        if (!file && (await dirAt(path)) && (await fileAt(join(path, "index.html")))) return go(301, `${pathname}/${url.search}`);
      }
    }
    if (!file || file === join(base, "_redirects")) {
      file = await fileAt(join(base, "404.html"));
      status = 404;
    }
    if (!file) return res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found\n");
    const bytes = await readFile(file);
    const tag = `"${createHash("sha256").update(bytes).digest("base64url").slice(0, 27)}"`;
    const headers = {
      "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
      etag: tag,
    };
    if (status === 200 && OPEN_TO_ALL.has(within)) headers["access-control-allow-origin"] = "*";
    if (status === 200 && req.headers["if-none-match"] === tag) return res.writeHead(304, headers).end();
    headers["content-length"] = bytes.length;
    res.writeHead(status, headers);
    res.end(req.method === "HEAD" ? undefined : bytes);
  };
}
