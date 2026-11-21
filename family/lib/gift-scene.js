// Extra pieces a gift card may hold, on top of the design, message, sign-off and stickers
// open.blog already checks (family/vendor/openblog/lib/gift-card.mjs). Those four stay the card.
// Anything here is optional, so a card saved before this still checks and draws as it always did.
//
// A guest may also set the paper color, leave the design's drawings off, draw lines, place short
// bits of text, turn or resize a sticker, and add up to two small photos. Photos are JPEG or PNG
// data URLs only, checked down to their first bytes. Nothing here is markup.

import { CardError, checkGift } from "../vendor/openblog/lib/gift-card.mjs";
import { oneLine } from "../vendor/openblog/lib/greeting-card.mjs";

const HEX = /^#[0-9a-f]{6}$/;
const TEXT_SIZES = new Set([18, 24, 32, 44]);
const LIMITS = Object.freeze({
  marks: 40,
  points: 80,
  texts: 12,
  text: 80,
  pictures: 2,
  pictureChars: 70000,
  pictureBytes: 52000,
  cardBytes: 160000,
});

const text = (value) => String(value ?? "");

function readHex(value, code, field) {
  const color = text(value).trim().toLowerCase();
  if (!HEX.test(color)) throw new CardError(422, code, field);
  return color;
}

function readTurn(value, code, field) {
  const turn = Number(value);
  if (!Number.isInteger(turn) || turn < -180 || turn > 180) throw new CardError(422, code, field);
  return turn;
}

/** Stickers open.blog already checked, plus a turn or a size when the guest set one. */
function stickerExtras(checked, raw) {
  if (!Array.isArray(checked) || !Array.isArray(raw)) return null;
  let any = false;
  const list = checked.map((sticker, index) => {
    const from = raw[index] || {};
    const out = { ...sticker };
    if (from.turn != null && from.turn !== 0 && from.turn !== "0") {
      out.turn = readTurn(from.turn, "bad-sticker", "stickers");
      any = true;
    }
    if (from.size != null && from.size !== 100 && from.size !== "100") {
      const size = Number(from.size);
      if (!Number.isInteger(size) || size < 40 || size > 220) throw new CardError(422, "bad-sticker", "stickers");
      out.size = size;
      any = true;
    }
    return out;
  });
  return any ? list : null;
}

function readMarks(list) {
  if (list == null) return null;
  if (!Array.isArray(list)) throw new CardError(422, "bad-drawing", "marks");
  if (list.length > LIMITS.marks) throw new CardError(422, "bad-drawing", "marks");
  if (!list.length) return null;
  return list.map((stroke) => {
    const color = readHex(stroke?.color, "bad-drawing", "marks");
    const size = Number(stroke?.size);
    const points = stroke?.points;
    if (!Number.isInteger(size) || size < 1 || size > 16 || !Array.isArray(points) || points.length < 1 || points.length > LIMITS.points) {
      throw new CardError(422, "bad-drawing", "marks");
    }
    return {
      color,
      size,
      points: points.map((point) => {
        if (!Array.isArray(point) || point.length !== 2) throw new CardError(422, "bad-drawing", "marks");
        const x = Number(point[0]);
        const y = Number(point[1]);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 600 || y < 0 || y > 400) {
          throw new CardError(422, "bad-drawing", "marks");
        }
        return [x, y];
      }),
    };
  });
}

function readTexts(list) {
  if (list == null) return null;
  if (!Array.isArray(list)) throw new CardError(422, "bad-text", "texts");
  if (list.length > LIMITS.texts) throw new CardError(422, "bad-text", "texts");
  if (!list.length) return null;
  return list.map((item) => {
    const raw = text(item?.text).replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").trim();
    if (raw.length < 1 || raw.length > LIMITS.text) throw new CardError(422, "bad-text", "texts");
    const x = Number(item?.x);
    const y = Number(item?.y);
    const size = Number(item?.size);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 100 || y < 0 || y > 100 || !TEXT_SIZES.has(size)) {
      throw new CardError(422, "bad-text", "texts");
    }
    const out = { text: oneLine(raw, LIMITS.text), x, y, size, color: readHex(item?.color, "bad-text", "texts") };
    if (item?.turn != null && item.turn !== 0 && item.turn !== "0") out.turn = readTurn(item.turn, "bad-text", "texts");
    return out;
  });
}

/** A photo is a JPEG or PNG data URL, and the first bytes have to say so. */
function pictureBytes(src) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!match || src.length > LIMITS.pictureChars) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 4 || bytes.length > LIMITS.pictureBytes) return null;
  if (match[1] === "png") {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return bytes.subarray(0, 8).equals(png) ? bytes : null;
  }
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
}

function readPictures(list) {
  if (list == null) return null;
  if (!Array.isArray(list)) throw new CardError(422, "bad-picture", "pictures");
  if (list.length > LIMITS.pictures) throw new CardError(422, "too-many-pictures", "pictures");
  if (!list.length) return null;
  return list.map((item) => {
    const src = text(item?.src);
    if (!pictureBytes(src)) throw new CardError(422, "bad-picture", "pictures");
    const x = Number(item?.x);
    const y = Number(item?.y);
    const w = Number(item?.w);
    const h = Number(item?.h);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > 100 || y < 0 || y > 100) {
      throw new CardError(422, "bad-picture", "pictures");
    }
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 8 || w > 520 || h < 8 || h > 360) {
      throw new CardError(422, "bad-picture", "pictures");
    }
    const out = { src, x, y, w, h };
    if (item?.turn != null && item.turn !== 0 && item.turn !== "0") out.turn = readTurn(item.turn, "bad-picture", "pictures");
    return out;
  });
}

/**
 * The optional parts of a card. `null` when there are none, so the card open.blog checked is kept
 * as it was. `art` is true when something besides the centered message was made (a drawing, words
 * placed on the card, a photo, a sticker, or a sign-off).
 */
function readScene(raw) {
  if (raw?.tooBig === true) throw new CardError(422, "card-too-big", "card");
  let plain = false;
  if (raw?.plain != null && raw.plain !== false) {
    if (raw.plain !== true) throw new CardError(422, "bad-color", "plain");
    plain = true;
  }
  const bg = raw?.bg != null && raw.bg !== "" ? readHex(raw.bg, "bad-color", "bg") : null;
  const marks = readMarks(raw?.marks);
  const texts = readTexts(raw?.texts);
  const pictures = readPictures(raw?.pictures);
  const art = Boolean(marks || texts || pictures || (Array.isArray(raw?.stickers) && raw.stickers.length) || text(raw?.signOff).trim());
  if (!bg && !plain && !marks && !texts && !pictures) return art ? { art } : null;
  return { art: art || Boolean(bg || plain), bg, plain, marks, texts, pictures };
}

/** The scene fields a form may send, and no others. A missing scene adds nothing. */
export function sceneFromForm(raw) {
  if (!raw) return {};
  if (raw.length > 200000) return { tooBig: true };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { bg: "bad" };
    const out = {};
    for (const key of ["bg", "plain", "marks", "texts", "pictures"]) {
      if (Object.hasOwn(parsed, key)) out[key] = parsed[key];
    }
    return out;
  } catch {
    return { bg: "bad" };
  }
}

/**
 * A gift as the form sent it. Notes, and cards that are only a design, words and stickers, come
 * back exactly as open.blog's check returns them. A card with a drawing or a photo keeps those too.
 */
export function checkGiftWithScene(input) {
  const raw = input?.card;
  if (!input || input.kind !== "card" || !raw || typeof raw !== "object" || Array.isArray(raw)) return checkGift(input);
  const scene = readScene(raw);
  const message = text(raw.message).replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").trim();
  let gift;
  if (!message) {
    if (!scene?.art) throw new CardError(422, "message-length", "message");
    gift = checkGift({ ...input, card: { ...raw, message: "x" } });
    gift = { ...gift, card: { ...gift.card, message: "" } };
  } else {
    gift = checkGift(input);
  }
  const stickers = stickerExtras(gift.card.stickers, raw.stickers);
  if (!scene && !stickers) return gift;
  const card = { ...gift.card };
  if (stickers) card.stickers = stickers;
  if (scene?.bg) card.bg = scene.bg;
  if (scene?.plain) card.plain = true;
  if (scene?.marks) card.marks = scene.marks;
  if (scene?.texts) card.texts = scene.texts;
  if (scene?.pictures) card.pictures = scene.pictures;
  if ((scene || stickers) && Buffer.byteLength(JSON.stringify(card)) > LIMITS.cardBytes) {
    throw new CardError(422, "card-too-big", "card");
  }
  return { ...gift, card };
}
