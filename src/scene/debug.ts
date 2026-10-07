/** What the ?debug overlay shows, read from the running scene once a second. */
export interface DebugInfo {
  /** Frames a second, and the 75th-percentile frame time, over the frame monitor's window. */
  fps: number;
  slowFrameMs: number;
  tier: string;
  grains: number;
  pixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  renderer: string;
  /** `running`, `paused` (hidden or off screen) or `low-power`. */
  state: string;
}

/**
 * A small overlay for measuring on real devices (opened with `?debug`, its own lazy chunk): the
 * numbers recorded in docs/performance.md come from it.
 */
export function openDebugOverlay(read: () => DebugInfo): void {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed bottom-3 left-3 z-10 max-w-[calc(100vw-1.5rem)] whitespace-pre-line rounded bg-black/75 px-3 py-2 font-mono text-xs leading-5 text-neutral-100";
  document.body.append(overlay);

  const update = () => {
    const info = read();
    const rate =
      info.fps > 0
        ? `${info.fps.toFixed(1)} fps, slowest quarter of frames ${info.slowFrameMs.toFixed(1)} ms`
        : "measuring the frame rate";
    overlay.textContent = [
      rate,
      `quality ${info.tier}: ${info.grains.toLocaleString("en")} grains, pixel ratio ${String(info.pixelRatio)}`,
      `canvas ${String(info.canvasWidth)} x ${String(info.canvasHeight)}, ${info.state}`,
      info.renderer || "renderer not reported",
    ].join("\n");
  };
  update();
  setInterval(update, 1000);
}
