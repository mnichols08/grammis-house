// "Leave a gift under Grammi's tree": a form on the front page where family leave her a note or a
// card they make, wrapped until Christmas morning. It sends to the family service (the `gifts`
// address the person who set up the site fills in once), which keeps every word private until she
// opens it in Studio.
//
// A plain custom element with real form fields (labels, fieldsets, a status line), so it works
// with a keyboard and a screen reader as any form does. The card is data from fixed lists, drawn
// with gift-card-art.js; nothing anyone types becomes markup. It shows from November 20 to
// January 6 (or always, if Grammi says so), and only when the address is set.

import { DESIGNS, STICKERS, drawCard } from "./gift-card-art.js";

const LIMITS = { from: 40, note: 1000, message: 300, signOff: 40, stickers: 8 };
const WRAPS = { red: "Red", green: "Green", gold: "Gold", blue: "Blue", plaid: "Plaid", stripes: "Candy stripes" };
const STICKER_WORDS = { star: "Star", heart: "Heart", snowflake: "Snowflake", "candy-cane": "Candy cane", bell: "Bell", mitten: "Mitten", cookie: "Cookie", ornament: "Ornament", holly: "Holly", gift: "Little present" };
const PLACES = [["Top left", 8, 10], ["Top middle", 50, 8], ["Top right", 92, 10], ["Left side", 6, 50], ["Right side", 94, 50], ["Bottom left", 8, 90], ["Bottom middle", 50, 92], ["Bottom right", 92, 90]];
const ERRORS = {
  "family-code": "That isn't the family password. Check with the family and try again.",
  token: "Something hiccuped. Wait a moment and press the button again.",
  "slow-down": "That's a lot of gifts at once! Try again in an hour.",
  "tree-full": "The tree is full this year. Send Grammi a note another way.",
  "from-length": "Write your name (40 letters at most).",
  "note-length": "Write a note (1,000 letters at most).",
  "message-length": "Write a message on your card (300 letters at most).",
  "sign-off-length": "Keep the sign-off to 40 letters.",
};

let count = 0;
const make = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
};

function inSeason(date = new Date()) {
  const month = date.getMonth();
  const day = date.getDate();
  return (month === 10 && day >= 20) || month === 11 || (month === 0 && day <= 6);
}

/** When gifts left now open, in words. Exported for tests. */
export function opensWords(iso) {
  if (!iso) return "on Christmas morning";
  const year = new Date(iso).getFullYear();
  return year > new Date().getFullYear() ? `next Christmas morning (${year})` : "on Christmas morning";
}

const Base = globalThis.HTMLElement ?? class {}; // on a server, nothing to extend

export class GiftMaker extends Base {
  #id = `gift-${++count}`;
  #token = "";
  #stickers = [];
  #sending = false;

  connectedCallback() {
    if (this.dataset.ready) return;
    const address = (this.getAttribute("gifts") || "").trim().replace(/\/+$/, "");
    const shows = this.getAttribute("shows") || "season";
    if (!/^https:\/\//.test(address) || (shows !== "always" && !inSeason())) {
      this.hidden = true;
      return;
    }
    this.dataset.ready = "true";
    this.address = address;
    this.#draw();
    this.#fetchToken();
  }

  async #fetchToken() {
    try {
      const reply = await fetch(`${this.address}/token`, { credentials: "omit" });
      this.#token = (await reply.json()).token || "";
    } catch {
      this.#token = "";
    }
  }

  #field(name) {
    return this.querySelector(`[name="${name}"]`);
  }

  #draw() {
    const id = this.#id;
    const radios = (name, legend, options, checked, hint) => make("fieldset", { class: "gm-choices" },
      make("legend", { text: legend }),
      hint ? make("p", { class: "gm-hint", id: `${id}-${name}-hint`, text: hint }) : null,
      ...Object.entries(options).map(([value, label]) => make("label", { class: "gm-choice" },
        make("input", { type: "radio", name, value, checked: value === checked, onchange: () => this.#changed() }),
        make("span", { text: label }))));
    const counter = (name, max) => make("span", { class: "gm-count", id: `${id}-${name}-count`, "aria-live": "polite", text: `0 of ${max}` });
    const sticker = make("select", { id: `${id}-sticker` }, ...Object.entries(STICKER_WORDS).map(([value, label]) => make("option", { value, text: label })));
    const place = make("select", { id: `${id}-place` }, ...PLACES.map(([label], index) => make("option", { value: String(index), text: label })));

    this.status = make("div", { class: "gm-status", role: "status", "aria-live": "polite" });
    this.preview = make("div", { class: "gm-preview" });
    this.stickerList = make("ul", { class: "gm-stickers", "aria-label": "Stickers on your card" });
    this.addSticker = make("button", { type: "button", class: "gm-secondary", text: "Add this sticker", onclick: () => this.#add(sticker.value, Number(place.value)) });

    const noteBox = make("div", { class: "gm-part", "data-part": "note" },
      make("label", { for: `${id}-note`, text: "Your note" }),
      make("textarea", { id: `${id}-note`, name: "note", rows: 5, maxlength: LIMITS.note, "aria-describedby": `${id}-note-count`, oninput: () => this.#changed() }),
      counter("note", LIMITS.note));
    const cardBox = make("div", { class: "gm-part", "data-part": "card", hidden: true },
      radios("design", "Card", Object.fromEntries(Object.entries(DESIGNS).map(([key, d]) => [key, d.label])), "holly"),
      make("label", { for: `${id}-message`, text: "What it says" }),
      make("textarea", { id: `${id}-message`, name: "message", rows: 3, maxlength: LIMITS.message, "aria-describedby": `${id}-message-count`, oninput: () => this.#changed() }),
      counter("message", LIMITS.message),
      make("label", { for: `${id}-signoff`, text: "Signed (optional)" }),
      make("input", { id: `${id}-signoff`, name: "signOff", maxlength: LIMITS.signOff, placeholder: "Love, Ava", oninput: () => this.#changed() }),
      make("fieldset", { class: "gm-sticker-maker" },
        make("legend", { text: "Stickers (up to 8)" }),
        make("div", { class: "gm-row" },
          make("span", {}, make("label", { for: `${id}-sticker`, text: "Sticker" }), sticker),
          make("span", {}, make("label", { for: `${id}-place`, text: "Where" }), place),
          this.addSticker),
        this.stickerList),
      make("p", { class: "gm-hint", text: "How your card looks:" }),
      this.preview);

    const form = make("form", { class: "gm-form", novalidate: true, "aria-labelledby": `${id}-h`, onsubmit: (event) => { event.preventDefault(); this.#send(); } },
      make("h2", { id: `${id}-h`, class: "gm-title", text: "Leave a gift under Grammi's tree" }),
      make("p", { class: "gm-lede", text: "Write her a note or make her a card. It stays wrapped until Christmas morning, and only Grammi reads it." }),
      make("label", { for: `${id}-from`, text: "Your name" }),
      make("input", { id: `${id}-from`, name: "from", maxlength: LIMITS.from, autocomplete: "name", required: true }),
      radios("visibility", "Who sees that it's from you?", { private: "Just Grammi", public: "Everyone who sees the tree" }, "private",
        "Either way, only Grammi sees what's inside."),
      radios("kind", "What would you like to leave?", { note: "A note", card: "A card I make" }, "note"),
      noteBox, cardBox,
      radios("wrap", "Wrapping paper", WRAPS, "red"),
      make("label", { for: `${id}-code`, text: "The family password" }),
      make("p", { class: "gm-hint", id: `${id}-code-hint`, text: "So only family can leave gifts. Ask the family if you don't know it." }),
      make("input", { id: `${id}-code`, name: "code", autocomplete: "off", "aria-describedby": `${id}-code-hint`, required: true }),
      // People never see this; robots fill in every field they find.
      make("div", { class: "gm-away", "aria-hidden": "true" },
        make("label", { for: `${id}-website`, text: "Leave this empty" }),
        make("input", { id: `${id}-website`, name: "website", tabindex: "-1", autocomplete: "off" })),
      make("button", { type: "submit", class: "gm-send", text: "Put it under the tree" }),
      this.status);
    this.replaceChildren(form);
    this.#changed();
  }

  #add(kind, placeIndex) {
    if (this.#stickers.length >= LIMITS.stickers || !STICKERS[kind]) return;
    const [where, x, y] = PLACES[placeIndex] || PLACES[0];
    this.#stickers.push({ kind, x, y, where });
    this.#changed();
    this.stickerList.querySelector("li:last-child button")?.focus();
  }

  #remove(index) {
    this.#stickers.splice(index, 1);
    this.#changed();
    (this.stickerList.querySelector(`li:nth-child(${Math.min(index + 1, this.#stickers.length)}) button`) || this.addSticker).focus();
  }

  #card() {
    return {
      design: this.querySelector('[name="design"]:checked')?.value || "holly",
      message: this.#field("message").value.trim(),
      signOff: this.#field("signOff").value.trim(),
      stickers: this.#stickers.map(({ kind, x, y }) => ({ kind, x, y })),
    };
  }

  #changed() {
    const kind = this.querySelector('[name="kind"]:checked')?.value || "note";
    for (const part of this.querySelectorAll(".gm-part")) part.hidden = part.dataset.part !== kind;
    for (const [name, max] of [["note", LIMITS.note], ["message", LIMITS.message]]) {
      const field = this.#field(name);
      const out = this.querySelector(`#${this.#id}-${name}-count`);
      if (field && out) out.textContent = `${field.value.length} of ${max}`;
    }
    this.stickerList.replaceChildren(...this.#stickers.map((s, index) => make("li", {},
      make("span", { text: `${STICKER_WORDS[s.kind]}, ${s.where.toLowerCase()}` }),
      make("button", { type: "button", class: "gm-link", "aria-label": `Remove the ${STICKER_WORDS[s.kind].toLowerCase()} (${s.where.toLowerCase()})`, text: "Remove", onclick: () => this.#remove(index) }))));
    this.addSticker.disabled = this.#stickers.length >= LIMITS.stickers;
    if (kind === "card") {
      const card = this.#card();
      this.preview.replaceChildren(drawCard({ ...card, message: card.message || "Your words go here" }, { label: `Your card so far: ${card.message || "no words yet"}` }));
    }
  }

  async #send() {
    if (this.#sending) return;
    const kind = this.querySelector('[name="kind"]:checked')?.value || "note";
    const body = {
      token: this.#token,
      code: this.#field("code").value,
      website: this.#field("website").value,
      from: this.#field("from").value.trim(),
      showName: this.querySelector('[name="visibility"]:checked')?.value === "public",
      kind,
      wrap: this.querySelector('[name="wrap"]:checked')?.value || "red",
      ...(kind === "note" ? { note: this.#field("note").value.trim() } : { card: this.#card() }),
    };
    const missing = !body.from ? ["from", "Write your name."]
      : kind === "note" && !body.note ? ["note", "Write your note."]
      : kind === "card" && !body.card.message ? ["message", "Write what your card says."]
      : !body.code.trim() ? ["code", "Type the family password."] : null;
    if (missing) return this.#say(missing[1], missing[0]);
    this.#sending = true;
    const button = this.querySelector(".gm-send");
    button.disabled = true;
    button.textContent = "Wrapping it…";
    try {
      const response = await fetch(`${this.address}/submit`, {
        method: "POST", credentials: "omit", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const reply = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (reply.error === "token") this.#fetchToken();
        const field = { "family-code": "code", "from-length": "from", "note-length": "note", "message-length": "message", "sign-off-length": "signOff" }[reply.error];
        return this.#say(ERRORS[reply.error] || "That didn't go through. Try again in a minute.", field);
      }
      window.dispatchEvent(new CustomEvent("grammis-gift"));
      const thanks = make("div", { class: "gm-thanks", tabindex: "-1" },
        make("h2", { class: "gm-title", text: "Thank you!" }),
        make("p", { text: `Your gift is under the tree. Grammi opens it ${opensWords(reply.opensAt)}.` }),
        make("button", { type: "button", class: "gm-secondary", text: "Leave another", onclick: () => { this.#stickers = []; this.#draw(); this.#fetchToken(); this.querySelector("input")?.focus(); } }));
      this.replaceChildren(thanks);
      thanks.focus();
    } catch {
      this.#say("Couldn't reach Grammi's house. Check your connection and try again.");
    } finally {
      this.#sending = false;
      if (button.isConnected) { button.disabled = false; button.textContent = "Put it under the tree"; }
    }
  }

  #say(words, field) {
    this.status.textContent = words;
    this.status.dataset.kind = "problem";
    const input = field && this.#field(field);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      input.addEventListener("input", () => input.removeAttribute("aria-invalid"), { once: true });
      input.focus();
    }
  }
}

if (globalThis.customElements && !customElements.get("gift-maker")) customElements.define("gift-maker", GiftMaker);
