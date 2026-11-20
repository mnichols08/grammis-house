// What the theme's components reach on the server, through their own `'use server'` functions.
// The running service hands its parts in at start (server.js calls `connect`); a component's server
// function then calls these. Each answer is plain data the component reads; nothing here trusts what
// the browser says about itself beyond the form's fields.

import { visitorAddress } from "./lib/http.js";

let parts = null;

/** Called once by the server at start. */
export function connect(service) {
  parts = service;
}

const gifts = () => {
  if (!parts?.gifts) throw Object.assign(new Error("gifts are off"), { off: true });
  return parts.gifts;
};

/** The boxes under the tree, and a fresh form token. Off: { ready: false }, so the section stays hidden. */
export async function lookAtTree() {
  try {
    const service = gifts();
    return { ...(await service.tree()), token: service.token() };
  } catch {
    return { gifts: [], ready: false };
  }
}

/** One gift from the form. Answers { ok, gift, opensAt } or { error }. */
export async function leaveGift(formData, request) {
  try {
    const service = gifts();
    const answer = await service.leave(formData, { address: visitorAddress(request.headers, parts.trustRealIp) });
    if (answer.error) return { error: answer.error, field: answer.field ?? null };
    return answer;
  } catch {
    return { error: "off" };
  }
}
