import "../style.css";
import "./lab.css";
import { whenPageIsIdle } from "../when-idle";

const motionAllowed = matchMedia("(prefers-reduced-motion: no-preference)").matches;
const drawing = document.querySelector<HTMLElement>(".drawing");
const redraw = document.querySelector<HTMLButtonElement>("[data-redraw]");
const story = document.querySelector<HTMLElement>("[data-story]");

// The drawing itself is CSS. This only holds it until it is on screen (on a small phone it may
// start below the fold), pauses its light while it is off screen, and offers to draw it again.
if (drawing && motionAllowed) {
  drawing.classList.add("is-offscreen");
  new IntersectionObserver(
    ([entry]) => {
      drawing.classList.toggle("is-offscreen", !entry?.isIntersecting);
    },
    { threshold: 0.3 },
  ).observe(drawing);

  if (redraw) {
    redraw.classList.remove("invisible");
    redraw.addEventListener("click", () => {
      drawing.classList.add("is-restarting");
      // Reading the layout applies the class at once, so the animations stop; removing the class
      // then starts them from the beginning.
      drawing.getBoundingClientRect();
      drawing.classList.remove("is-restarting");
    });
  }
}

// The scroll story works as a plain page without this. GSAP (its own chunk) loads once the page is
// idle, so it never delays the first paint, and never with reduced motion.
if (story && motionAllowed) {
  whenPageIsIdle(() => {
    import("./story").then(
      ({ startStory }) => {
        startStory(story);
      },
      (error: unknown) => {
        console.error("The scroll story failed to load", error);
      },
    );
  });
}
