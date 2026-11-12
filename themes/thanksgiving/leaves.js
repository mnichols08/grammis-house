// A few leaves drift down the home page for the first moments of a visit.
// Decoration only: no leaves for readers who prefer reduced motion, none on
// recipe pages (people are cooking), and the page is complete without it.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const home = document.querySelector(".ob-home-section, main .ob-list") && !document.querySelector(".ob-recipe, ob-recipe");

if (!reduce && home && !document.querySelector(".gh-weather")) {
  const sky = document.createElement("div");
  sky.className = "gh-weather";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);

  const kinds = ["🍁", "🍂", "🍁", "🌰"];
  let made = 0;
  const drop = () => {
    if (made++ >= 14) return clearInterval(timer);
    const leaf = document.createElement("span");
    leaf.className = "gh-leaf";
    leaf.textContent = kinds[made % kinds.length];
    leaf.style.left = `${Math.random() * 100}vw`;
    leaf.style.animationDuration = `${7 + Math.random() * 6}s`;
    leaf.style.setProperty("--gh-drift", `${(Math.random() - 0.5) * 16}rem`);
    leaf.style.setProperty("--gh-spin", `${(Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360)}deg`);
    leaf.addEventListener("animationend", () => leaf.remove());
    sky.append(leaf);
  };
  const timer = setInterval(drop, 900);
}
