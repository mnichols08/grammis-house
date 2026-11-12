// A handful of leaves tumble down the home page when someone arrives, then stop.
// Decoration only: none for readers who prefer reduced motion, none on recipe pages
// (people are cooking), and the page is complete without it.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const home = document.querySelector(".ob-home-section") && !document.querySelector(".ob-recipe, ob-recipe");

const MAPLE = "M0-11L2.6-5.5 7.5-7.6 5.6-2.2 10.5-.4 5.2 2.4 6.2 7.2 0 4.6-6.2 7.2-5.2 2.4-10.5-.4-5.6-2.2-7.5-7.6-2.6-5.5Z";
const OAK = "M0-11C3.5-10 1.8-7.4 4.6-6.6 8.4-5.6 4.6-2.8 6.6-1 9.4 1.2 4.8 2.8 5.6 4.8 6.4 7.6 2 7.4 0 10.6-2 7.4-6.4 7.6-5.6 4.8-4.8 2.8-9.4 1.2-6.6-1-4.6-2.8-8.4-5.6-4.6-6.6-1.8-7.4-3.5-10 0-11Z";
const COLORS = ["#9b1d33", "#c4561c", "#e0a12e", "#b8371f", "#7a8a3a", "#d9822b"];

if (!reduce && home && !document.querySelector(".gh-weather")) {
  const sky = document.createElement("div");
  sky.className = "gh-weather";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);

  const drop = (delay) => {
    const leaf = document.createElement("span");
    const size = 18 + Math.random() * 18;
    leaf.className = "gh-leaf";
    leaf.style.left = `${Math.random() * 100}vw`;
    leaf.style.setProperty("--gh-size", `${size}px`);
    leaf.style.setProperty("--gh-fall", `${9 + Math.random() * 7}s`);
    leaf.style.setProperty("--gh-sway", `${2.2 + Math.random() * 1.6}s`);
    leaf.style.setProperty("--gh-drift", `${(Math.random() - 0.5) * 18}rem`);
    leaf.style.animationDelay = `${delay}s`;
    const path = Math.random() < 0.6 ? MAPLE : OAK;
    leaf.innerHTML = `<svg viewBox="-12 -12 24 24"><path d="${path}" fill="${COLORS[Math.floor(Math.random() * COLORS.length)]}"/><path d="M0 4.6V-9M0 0 6-4M0 0-6-4" stroke="#fff" stroke-opacity=".35" stroke-width=".7" fill="none"/></svg>`;
    leaf.addEventListener("animationend", (e) => e.target === leaf && leaf.remove());
    sky.append(leaf);
  };
  for (let i = 0; i < 16; i++) drop(i * 0.8 + Math.random() * 0.6);
}
