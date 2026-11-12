// Hangs the seasonal sign under the garland on the home page. Which holiday it counts down to
// comes from the active theme's `season` token, so changing the season changes the sign too.
import "./components/holiday-countdown.js";

const season = getComputedStyle(document.documentElement).getPropertyValue("--ob-season").trim().replace(/"/g, "").toLowerCase();
const home = document.querySelector(".ob-home-section");
const header = document.querySelector(".ob-header");

if (season && home && header && !document.querySelector("holiday-countdown")) {
  const sign = document.createElement("holiday-countdown");
  sign.setAttribute("holiday", season);
  header.after(sign);
}
