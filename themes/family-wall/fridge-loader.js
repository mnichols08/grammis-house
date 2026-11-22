// Puts the magnet fridge on The Family Wall: the door goes after the page's words, and the fridge
// (themes/grammis/components/magnet-fridge.js) hangs Grammi's notes on it. The page's Markdown stays
// as she writes it in the editor; where the fridge can't load, the notes show as they always have.
const page = document.querySelector(".ob-page");
const words = page && (page.querySelector("ob-code") || page.querySelector(".ob-prose"));
if (words && !document.querySelector("magnet-fridge")) {
  words.after(document.createElement("magnet-fridge"));
  import("../grammis/components/magnet-fridge.js");
}
