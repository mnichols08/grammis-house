// Small helpers for the service's JSON routes: replies, bodies, keys, the visitor's address.

import { createHash, timingSafeEqual } from "node:crypto";

export const SECURITY = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };

/** A reply: { status, headers, body }. */
export const reply = (status, value, headers = {}) => ({
  status,
  headers: { ...SECURITY, "content-type": "application/json; charset=utf-8", ...headers },
  body: JSON.stringify(value),
});

export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

/** A request's body as text, read up to `limit` bytes; a longer one is a 413. */
export function readText(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let over = false;
    req.on("data", (chunk) => {
      if (over) return;
      size += chunk.length;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        reject(new HttpError(413, "too-large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (!over) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

/** A JSON object, or null when the text isn't one. */
export function objectOf(text) {
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** Compares two secrets in constant time; an empty one never matches. */
export function sameSecret(given, wanted) {
  const a = createHash("sha256").update(String(given ?? "")).digest();
  const b = createHash("sha256").update(String(wanted ?? "")).digest();
  return Boolean(given) && Boolean(wanted) && timingSafeEqual(a, b);
}

/** The bearer token of a request's Authorization header. */
export const bearer = (headers) => String(headers.authorization || "").replace(/^Bearer\s+/i, "");

/**
 * The visitor's address: the one Railway's proxy set in X-Real-IP (it overwrites any copy the
 * visitor sent), only when the service is told to trust it. Never anything else the visitor wrote.
 */
export function visitorAddress(headers, trust) {
  if (!trust) return "";
  const value = String(headers.get ? headers.get("x-real-ip") || "" : headers["x-real-ip"] || "").trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(value) ? value : "";
}

/** The start of this hour, as open.blog's rate limit keys it. */
export const hourOf = (at) => new Date(at).toISOString().slice(0, 13) + ":00:00Z";
