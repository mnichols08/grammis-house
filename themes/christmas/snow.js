// Gentle snow on the home page. Decoration only: off for readers who prefer
// reduced motion, off on recipe pages, and it stops on its own.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const home = document.querySelector(".ob-home-section, main .ob-list") && !document.querySelector(".ob-recipe, ob-recipe");

if (!reduce && home && !document.querySelector(".gh-weather")) {
  const sky = document.createElement("div");
  sky.className = "gh-weather";
  sky.setAttribute("aria-hidden", "true");
  document.body.prepend(sky);

  let made = 0;
  const fall = () => {
    if (made++ >= 60) return clearInterval(timer);
    const flake = document.createElement("span");
    const size = 3 + Math.random() * 5;
    flake.className = "gh-flake";
    flake.style.width = flake.style.height = `${size}px`;
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.opacity = `${0.5 + Math.random() * 0.5}`;
    flake.style.animationDuration = `${8 + Math.random() * 8}s`;
    flake.style.setProperty("--gh-drift", `${(Math.random() - 0.5) * 6}rem`);
    flake.addEventListener("animationend", () => flake.remove());
    sky.append(flake);
  };
  const timer = setInterval(fall, 300);
}
