/**
 * The dune scene as an embed for any site (Webflow, WordPress, Framer, plain HTML): a container
 * and one script.
 *
 *   <div data-sahra style="height: 480px"></div>
 *   <script type="module" src="https://sahra-khaki.vercel.app/embed/sahra.js"></script>
 *
 * This file is the small loader. It finds every `[data-sahra]` container on the page (and any
 * added later), and once a container is near the screen and the page is idle, it starts a scene
 * behind the container's own content. The scene (Three.js) is a separate file beside this one,
 * loaded only then and only where WebGL2 runs on a GPU, so a page pays for it only when the
 * scene can show. Options are data attributes (see ./options.ts); the container's `data-state`
 * says how it went (see mountScene). The container's own background shows until the scene
 * fades in, and stays where it cannot run. A container removed from the page releases its scene.
 */
import { mountScene } from "../scene/mount";
import type { SceneHandle } from "../scene/scene";
import { whenPageIsIdle } from "../when-idle";
import { embedOptions } from "./options";

const SELECTOR = "[data-sahra]";
/** How far from the screen a container starts its scene, so it is ready when it scrolls in. */
const NEAR_SCREEN = "200px";

const seen = new WeakSet<HTMLElement>();
const scenes = new Map<HTMLElement, Promise<SceneHandle | undefined>>();
const nearScreen = new IntersectionObserver(
  (entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || !(target instanceof HTMLElement)) continue;
      nearScreen.unobserve(target);
      whenPageIsIdle(() => {
        if (target.isConnected) start(target);
      });
    }
  },
  { rootMargin: NEAR_SCREEN },
);

/**
 * Prepares a container and starts its scene once it is near the screen. Containers in the page
 * when this script runs, and any added later, are mounted by themselves; call this for a
 * container in a shadow root or one the script cannot otherwise see.
 */
export function mount(container: HTMLElement): void {
  if (seen.has(container)) return;
  seen.add(container);
  nearScreen.observe(container);
}

function start(container: HTMLElement): void {
  const options = embedOptions(container.dataset);
  for (const warning of options.warnings) console.warn(`Sahra: ${warning}`);

  // The scene sits in a layer behind the container's own content, clipped to its rounded corners.
  if (getComputedStyle(container).position === "static") container.style.position = "relative";
  container.style.isolation = "isolate";
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    zIndex: "-1",
    overflow: "hidden",
    borderRadius: "inherit",
    pointerEvents: "none",
  });
  container.prepend(layer);

  scenes.set(
    container,
    mountScene(container, {
      force: options.force,
      layer,
      scene: {
        lockedTier: options.lockedTier,
        highestTier: options.highestTier,
        light: options.light,
      },
    }),
  );
}

/** Mounts containers added to the page, and releases the scenes of those taken out of it. */
const watcher = new MutationObserver((records) => {
  for (const { addedNodes } of records) {
    for (const node of addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(SELECTOR)) mount(node);
      for (const container of node.querySelectorAll<HTMLElement>(SELECTOR)) mount(container);
    }
  }
  for (const [container, scene] of scenes) {
    if (container.isConnected) continue;
    scenes.delete(container);
    void scene.then((handle) => handle?.stop());
  }
});

for (const container of document.querySelectorAll<HTMLElement>(SELECTOR)) mount(container);
watcher.observe(document.documentElement, { childList: true, subtree: true });
