import { describe, expect, it } from "vitest";
import { FrameMonitor } from "./frame-monitor";

/** Below about 45 frames a second, as the scene uses for stepping down. */
const BUDGET_MS = 22;

/** Feeds frames every `frameMs` from `fromMs` to `toMs`; returns the times it said "too slow". */
function run(monitor: FrameMonitor, fromMs: number, toMs: number, frameMs: number): number[] {
  const verdicts: number[] = [];
  for (let time = fromMs; time <= toMs; time += frameMs) {
    if (monitor.frame(time, BUDGET_MS)) verdicts.push(time);
  }
  return verdicts;
}

function started(atMs = 0): FrameMonitor {
  const monitor = new FrameMonitor();
  monitor.restart(atMs);
  return monitor;
}

describe("FrameMonitor", () => {
  it("leaves a smooth 60 frames a second alone", () => {
    expect(run(started(), 0, 10_000, 1000 / 60)).toEqual([]);
  });

  it("leaves a smooth 120 frames a second alone", () => {
    expect(run(started(), 0, 10_000, 1000 / 120)).toEqual([]);
  });

  it("says too slow at 30 frames a second, once the warmup and a full window have passed", () => {
    const verdicts = run(started(), 0, 2600, 1000 / 30);
    expect(verdicts).toHaveLength(1);
    // Warmup 1 s, then 1.5 s of frames.
    expect(verdicts[0]).toBeGreaterThanOrEqual(2500);
  });

  it("judges each tier on its own frames: after a verdict it waits a warmup and a window again", () => {
    const verdicts = run(started(), 0, 6000, 1000 / 30);
    expect(verdicts).toHaveLength(2);
    expect((verdicts[1] ?? 0) - (verdicts[0] ?? 0)).toBeGreaterThanOrEqual(2500);
  });

  it("ignores slow frames during the warmup", () => {
    expect(run(started(), 0, 990, 100)).toEqual([]);
  });

  it("forgives a few hitches among smooth frames", () => {
    const monitor = started();
    const verdicts: number[] = [];
    let time = 0;
    for (let frame = 0; frame < 600; frame++) {
      // Every 20th frame takes 80 ms instead of 16.7 ms.
      time += frame % 20 === 0 ? 80 : 1000 / 60;
      if (monitor.frame(time, BUDGET_MS)) verdicts.push(time);
    }
    expect(verdicts).toEqual([]);
  });

  it("counts even extremely slow frames, one every two seconds, as too slow", () => {
    expect(run(started(), 0, 6000, 2000)).toHaveLength(1);
  });

  it("judges against the budget it is given", () => {
    // 30 frames a second is too slow for 22 ms, but within 40 ms.
    const monitor = started();
    const verdicts: number[] = [];
    for (let time = 0; time <= 6000; time += 1000 / 30) {
      if (monitor.frame(time, 40)) verdicts.push(time);
    }
    expect(verdicts).toEqual([]);
  });

  it("starts over when restarted, as the scene does after a pause", () => {
    const monitor = started();
    run(monitor, 0, 2000, 1000 / 60);
    monitor.restart(7000);
    // Slow frames after the restart are not judged until a warmup and a window later.
    expect(run(monitor, 7000, 9400, 1000 / 30)).toEqual([]);
    expect(run(monitor, 9433, 9600, 1000 / 30)).toHaveLength(1);
  });

  it("reports the frame rate and the slow-frame time over the window", () => {
    const monitor = started();
    run(monitor, 0, 3000, 20);
    const { fps, slowFrameMs } = monitor.stats();
    expect(fps).toBeCloseTo(50, 0);
    expect(slowFrameMs).toBeCloseTo(20, 5);
  });

  it("reports zeros before it has judged anything", () => {
    expect(new FrameMonitor().stats()).toEqual({ fps: 0, slowFrameMs: 0 });
  });
});
