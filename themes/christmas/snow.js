// Snow on the home page, and the garland's bulbs twinkling one by one.
// Decoration only: still for readers who prefer reduced motion, no snow on recipe
// pages, and the page is complete without it.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const home = document.querySelector(".ob-home-section") && !document.querySelector(".ob-recipe, ob-recipe");

// Where the bulbs sit in one repeat of decor/garland.svg (made by the art script).
const TILE = 240;
const BULBS = [[36.0, 54.9, "#e8384d"], [64.0, 65.5, "#f2c14e"], [92.0, 71.9, "#3fae6a"], [120.0, 74.0, "#4a8fe0"], [148.0, 71.9, "#f2913d"], [176.0, 65.5, "#e8384d"], [204.0, 54.9, "#f2c14e"]];

function lights() {
  const header = document.querySelector(".ob-header");
  if (!header || header.querySelector(".gh-lights")) return;
  const garland = getComputedStyle(header, "::after");
  if (!garland.backgroundImage.includes("svg")) return;
  const layer = document.createElement("div");
  layer.className = "gh-lights";
  layer.setAttribute("aria-hidden", "true");
  const scale = parseFloat(garland.height) / 96;
  const tiles = Math.ceil(header.clientWidth / (TILE * scale)) + 1;
  for (let t = 0; t < tiles; t++) {
    for (const [x, y, color] of BULBS) {
      const glow = document.createElement("span");
      glow.style.left = `${(t * TILE + x) * scale}px`;
      glow.style.top = `${y * scale}px`;
      glow.style.setProperty("--gh-bulb", color);
      glow.style.animationDelay = `${-Math.random() * 3}s`;
      glow.style.animationDuration = `${1.6 + Math.random() * 2.2}s`;
      layer.append(glow);
    }
  }
  header.append(layer);
}

function snow() {
  if (document.querySelector(".gh-weather")) return;
  const sky = document.createElement("div");
  sky.className = "gh-weather";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);
  for (let i = 0; i < 70; i++) {
    const depth = Math.random();
    const flake = document.createElement("span");
    const size = 2 + depth * 6;
    flake.className = "gh-flake";
    flake.style.width = flake.style.height = `${size}px`;
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.opacity = `${0.35 + depth * 0.6}`;
    flake.style.filter = depth < 0.3 ? "blur(1px)" : "none";
    flake.style.animationDuration = `${16 - depth * 8}s, ${2 + Math.random() * 2}s`;
    flake.style.animationDelay = `${Math.random() * 8}s, 0s`;
    flake.style.setProperty("--gh-drift", `${(Math.random() - 0.5) * 8}rem`);
    flake.addEventListener("animationend", (e) => e.animationName === "gh-snow" && flake.remove());
    sky.append(flake);
  }
}

if (!reduce) {
  lights();
  if (home) snow();
}
