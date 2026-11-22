// Puts the magnet fridge and the "Write to Grammi" postcard on The Family Wall. The page's Markdown
// stays as she writes it in the editor; where this can't run, the page shows as she wrote it.
//
// The fridge (themes/grammis/components/magnet-fridge.js) goes after the page's words and hangs
// Grammi's notes on its door. The postcard (themes/grammis/components/family-mailbox.js) goes after
// the fridge: a note written there goes to the family service, which emails it to her. Each stays
// hidden where the family service isn't running.
const page = document.querySelector(".ob-page");
const words = page && (page.querySelector("ob-code") || page.querySelector(".ob-prose"));
if (words && !document.querySelector("magnet-fridge")) {
  words.after(document.createElement("magnet-fridge"));
  import("../grammis/components/magnet-fridge.js");
}
if (words && !document.querySelector("family-mailbox")) {
  (document.querySelector("magnet-fridge") || words).after(document.createElement("family-mailbox"));
  import("../grammis/components/family-mailbox.js");
}
