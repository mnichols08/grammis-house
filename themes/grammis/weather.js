// The month's weather on the home page: a handful of snowflakes, hearts, petals, clovers,
// leaves or confetti drift down when someone arrives, then stop. A month picks its weather
// with the "weather" token in theme.json ("none" for a still page).
// Decoration only: none for readers who prefer reduced motion, none on recipe pages
// (people are cooking), and the page is complete without it.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const home = document.querySelector(".ob-home-section") && !document.querySelector(".ob-recipe, ob-recipe");
const kind = getComputedStyle(document.documentElement).getPropertyValue("--ob-weather").trim();

const SHAPES = {
  snow: {
    colors: ["#ffffff", "#e3eef7", "#cfe0ee"],
    count: 22,
    draw: (c) => `<g stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none">${[0, 60, 120]
      .map((a) => `<path transform="rotate(${a})" d="M0-10V10M-3-7 0-4 3-7M-3 7 0 4 3 7"/>`).join("")}</g>`,
  },
  hearts: {
    colors: ["#c8243c", "#f08aa4", "#e0567a", "#ffffff"],
    count: 16,
    draw: (c) => `<path d="M0 9C-9 3-12-3-8-7-5-10-1-9 0-5 1-9 5-10 8-7 12-3 9 3 0 9Z" fill="${c}"/>`,
  },
  petals: {
    colors: ["#f6b8c8", "#ffffff", "#e8577a", "#c9b6ea", "#fff3c4"],
    count: 20,
    draw: (c) => `<path d="M0-10C6-6 6 4 0 10-6 4-6-6 0-10Z" fill="${c}"/><path d="M0-8V6" stroke="#fff" stroke-opacity=".4"/>`,
  },
  clover: {
    colors: ["#2e8b4a", "#5fb36a", "#1f6b3a"],
    count: 14,
    draw: (c) => [0, 120, 240]
      .map((a) => `<path transform="rotate(${a})" d="M0 0C-5-3-7-8-4-10-2-11 0-9 0-7 0-9 2-11 4-10 7-8 5-3 0 0Z" fill="${c}"/>`).join(""),
  },
  leaves: {
    colors: ["#a3232b", "#d9661c", "#e0a12e", "#7a8a3a", "#b4470f"],
    count: 14,
    draw: (c) => `<path d="M0-11L2.6-5.5 7.5-7.6 5.6-2.2 10.5-.4 5.2 2.4 6.2 7.2 0 4.6-6.2 7.2-5.2 2.4-10.5-.4-5.6-2.2-7.5-7.6-2.6-5.5Z" fill="${c}"/>`,
  },
  confetti: {
    colors: ["#b22234", "#2a3e7a", "#ffffff", "#f2c14e"],
    count: 30,
    draw: (c) => (Math.random() < 0.5
      ? `<rect x="-3" y="-7" width="6" height="14" rx="1" fill="${c}"/>`
      : `<path d="M0-10 2.9-4 9.5-3.1 4.8 1.5 5.9 8.1 0 5 -5.9 8.1-4.8 1.5-9.5-3.1-2.9-4Z" fill="${c}"/>`),
  },
};

const shape = SHAPES[kind];
if (shape && !reduce && home && !document.querySelector(".gh-weather")) {
  const sky = document.createElement("div");
  sky.className = "gh-weather";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);
  for (let i = 0; i < shape.count; i++) {
    const piece = document.createElement("span");
    piece.className = "gh-drop";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.setProperty("--gh-size", `${12 + Math.random() * 16}px`);
    piece.style.setProperty("--gh-fall", `${9 + Math.random() * 7}s`);
    piece.style.setProperty("--gh-sway", `${2.2 + Math.random() * 1.6}s`);
    piece.style.setProperty("--gh-drift", `${(Math.random() - 0.5) * 16}rem`);
    piece.style.animationDelay = `${i * 0.6 + Math.random() * 0.6}s`;
    const color = shape.colors[Math.floor(Math.random() * shape.colors.length)];
    piece.innerHTML = `<svg viewBox="-12 -12 24 24">${shape.draw(color)}</svg>`;
    piece.addEventListener("animationend", (e) => e.target === piece && piece.remove());
    sky.append(piece);
  }
}
