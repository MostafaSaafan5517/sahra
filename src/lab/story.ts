import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
// Phones show and hide their address bar while scrolling, which resizes the viewport; refreshing
// every pin each time would make the page jump.
ScrollTrigger.config({ ignoreMobileResize: true });

/** How long the animation trails the scroll, in seconds: enough to smooth a flick of the wheel. */
const SCRUB = 0.6;
/**
 * A line waits unseen for its turn (screen readers still read it), then steps back to this
 * opacity once the next one has come: still 3.7:1 against the page, above the 3:1 WCAG AA asks
 * of large text.
 */
const PASSED = 0.4;

function part(story: HTMLElement, selector: string): HTMLElement {
  const element = story.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`The scroll story has no ${selector}.`);
  return element;
}

/**
 * Turns the story's static layout (every line shown, the day's pictures in a row that scrolls
 * sideways by itself) into the scroll story: the lines section pins while each line comes up in
 * turn, then the pictures' section pins and the page's scroll pans the row sideways.
 */
export function startStory(story: HTMLElement): void {
  const reveal = part(story, "[data-story-reveal]");
  const lines = gsap.utils.toArray<HTMLElement>("[data-story-line]", reveal);
  const note = part(story, "[data-story-note]");
  const pan = part(story, "[data-story-pan]");
  const track = part(story, "[data-story-track]");
  const progress = part(story, "[data-story-progress]");
  const progressBar = part(story, "[data-story-progress] > div");
  const end = part(story, "[data-story-end]");
  const [firstLine, ...nextLines] = lines;
  if (!firstLine) throw new Error("The scroll story has no lines.");

  // From here the page's scroll moves the row (lab.css), so the row is no longer a stop of its own
  // for the keyboard.
  story.dataset.enhanced = "";
  track.removeAttribute("tabindex");
  progress.classList.remove("invisible");

  // Staged reveals: the section stays pinned for two screens of scrolling while each line comes up
  // in turn and the one before it steps back.
  gsap.set([...nextLines, note], { opacity: 0, y: 24 });
  const reveals = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: { trigger: reveal, pin: true, start: "top top", end: "+=200%", scrub: SCRUB },
  });
  let previous = firstLine;
  for (const line of nextLines) {
    reveals.to(previous, { opacity: PASSED }).to(line, { opacity: 1, y: 0 }, "<");
    previous = line;
  }
  reveals.to(note, { opacity: 1, y: 0 });

  // The horizontal pan: the section pins for as long as the row is wider than the screen, and the
  // row slides left by exactly that much, with a progress line under it.
  const distance = () => track.scrollWidth - pan.clientWidth;
  const panning = gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pan,
        pin: true,
        start: "top top",
        end: () => `+=${String(distance())}`,
        scrub: SCRUB,
        invalidateOnRefresh: true,
      },
    })
    .to(track, { x: () => -distance() }, 0)
    .fromTo(progressBar, { scaleX: 0 }, { scaleX: 1 }, 0);

  // The last picture's link sits off screen until the pan reaches it. Focusing it from the
  // keyboard scrolls the page to the end of the pan, where it is in view.
  end.addEventListener("focus", () => {
    const trigger = panning.scrollTrigger;
    if (trigger && window.scrollY < trigger.end)
      scrollTo({ top: trigger.end, behavior: "instant" });
  });
}
