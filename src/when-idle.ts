/**
 * Runs the task after the page has loaded and the browser is idle, so heavy downloads and
 * startup work (the scene, the scroll story) never compete with the content's first paint.
 */
export function whenPageIsIdle(task: () => void): void {
  const schedule = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(task, { timeout: 1000 });
    else setTimeout(task, 0);
  };
  if (document.readyState === "complete") schedule();
  else addEventListener("load", schedule, { once: true });
}
