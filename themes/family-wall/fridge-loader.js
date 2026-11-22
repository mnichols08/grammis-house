// Puts the magnet fridge and the "Write to Grammi" postcard on The Family Wall. The page's Markdown
// stays as she writes it in the editor; where this can't run, the page shows as she wrote it.
//
// The fridge (themes/grammis/components/magnet-fridge.js) goes after the page's words and hangs
// Grammi's notes on its door.
//
// The postcard (themes/grammis/components/family-mailbox.js) goes after the fridge. Her address is the
// first email link in the page's own words, outside her notes: she writes it like any other text
// (<her@address>), and the postcard replaces that line. An example address (example.com, .org, .net)
// is a placeholder, so until she puts her own in there is no postcard.
const page = document.querySelector(".ob-page");
const words = page && (page.querySelector("ob-code") || page.querySelector(".ob-prose"));
if (words && !document.querySelector("magnet-fridge")) {
  words.after(document.createElement("magnet-fridge"));
  import("../grammis/components/magnet-fridge.js");
}

const link = page && [...page.querySelectorAll(".ob-prose a[href^='mailto:']")].find((a) => !a.closest("blockquote"));
let address = "";
try {
  address = link ? decodeURIComponent(link.getAttribute("href").slice("mailto:".length).split("?")[0]).trim() : "";
} catch {
  address = "";
}
const real = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(address) && !/@example\.(com|org|net)$/i.test(address);
if (words && real && !document.querySelector("family-mailbox")) {
  const card = document.createElement("family-mailbox");
  card.setAttribute("email", address);
  (document.querySelector("magnet-fridge") || words).after(card);
  link.closest("p")?.setAttribute("data-on-postcard", "");
  import("../grammis/components/family-mailbox.js");
}
