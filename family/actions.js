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

/** Whether the recipe form is open, whether it asks for the family password, and a form token. Off: { open: false }. */
export async function lookAtRecipes() {
  try {
    if (!parts?.recipes) return { open: false };
    return parts.recipes.look();
  } catch {
    return { open: false };
  }
}

/** One recipe from the form, photos and all. Answers { ok } or { error, field }. */
export async function shareRecipe(formData, request) {
  try {
    if (!parts?.recipes) return { error: "off" };
    const answer = await parts.recipes.share(formData, { address: visitorAddress(request.headers, parts.trustRealIp) });
    if (answer.error) return { error: answer.error, field: answer.field ?? null };
    return { ok: true };
  } catch {
    return { error: "off" };
  }
}

/** The fridge: a call to one of its parts, or { error: "off" } (the page then leaves the fridge out). */
async function atFridge(part, formData, request) {
  try {
    if (!parts?.fridge) return { error: "off" };
    const answer = await parts.fridge[part](formData, { address: visitorAddress(request.headers, parts.trustRealIp) });
    if (answer.error) return { error: answer.error, field: answer.field ?? null };
    return answer;
  } catch {
    return { error: "off" };
  }
}
export async function lookAtFridge() {
  try {
    return parts?.fridge ? await parts.fridge.look() : { error: "off" };
  } catch {
    return { error: "off" };
  }
}
export const moveOnFridge = (formData, request) => atFridge("move", formData, request);
export const drawForFridge = (formData, request) => atFridge("draw", formData, request);
export const grammisCorner = (formData, request) => atFridge("grammi", formData, request);

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
