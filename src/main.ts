import "./style.css";
import { mountScene } from "./scene/mount";
import { whenPageIsIdle } from "./when-idle";

const sceneContainer = document.querySelector<HTMLElement>("[data-scene]");
if (sceneContainer) {
  // ?quality=high|medium|low|minimal locks the tier, ?quality=auto keeps it adaptive; either way the
  // scene runs even on software-only WebGL (for tests, recordings and comparisons). ?debug opens
  // the frame-rate overlay, ?tune the tuning panel.
  const flags = new URLSearchParams(location.search);
  whenPageIsIdle(() => {
    void mountScene(sceneContainer, {
      force: flags.has("quality"),
      scene: {
        lockedTier: flags.get("quality") ?? undefined,
        debug: flags.has("debug"),
        tune: flags.has("tune"),
      },
    });
  });
}
