import "../style.css";
import "./lab.css";

const drawing = document.querySelector<HTMLElement>(".drawing");
const redraw = document.querySelector<HTMLButtonElement>("[data-redraw]");

// The drawing itself is CSS. This only holds it until it is on screen (on a small phone it may
// start below the fold), pauses its light while it is off screen, and offers to draw it again.
if (drawing && matchMedia("(prefers-reduced-motion: no-preference)").matches) {
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
