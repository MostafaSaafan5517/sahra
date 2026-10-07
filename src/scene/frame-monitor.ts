export interface FrameMonitorOptions {
  /** How much recent time is judged at once. */
  windowMs: number;
  /** Frames right after a (re)start are not judged: shaders, caches and memory are settling. */
  warmupMs: number;
}

export const DEFAULT_FRAME_MONITOR_OPTIONS: FrameMonitorOptions = {
  windowMs: 1500,
  warmupMs: 1000,
};

export interface FrameStats {
  /** Frames a second over the window. */
  fps: number;
  /** The 75th-percentile frame time over the window, in milliseconds. */
  slowFrameMs: number;
}

interface Frame {
  time: number;
  duration: number;
}

/**
 * Watches the frame rate. Fed every frame's timestamp, it answers whether the recent frames are
 * too slow, so the scene can step its quality down. After any verdict, quality change or pause it
 * starts over, warmup included, so each tier is judged on its own frames.
 *
 * It has no notion of a pause itself: the scene stops feeding it while hidden or off screen and
 * restarts it on resume. So a long gap between frames always means slow frames, however slow.
 */
export class FrameMonitor {
  private readonly options: FrameMonitorOptions;
  private frames: Frame[] = [];
  private lastTime: number | null = null;
  private judgingFrom = Infinity;

  constructor(options: FrameMonitorOptions = DEFAULT_FRAME_MONITOR_OPTIONS) {
    this.options = options;
  }

  /** Starts over at `timeMs`: frames during the warmup that follows are not judged. */
  restart(timeMs: number): void {
    this.frames = [];
    this.lastTime = null;
    this.judgingFrom = timeMs + this.options.warmupMs;
  }

  /**
   * Records a frame drawn at `timeMs`. True means the recent frames were too slow: their
   * 75th-percentile frame took longer than `budgetMs`.
   */
  frame(timeMs: number, budgetMs: number): boolean {
    const lastTime = this.lastTime;
    this.lastTime = timeMs;
    if (lastTime === null) return false;
    const duration = timeMs - lastTime;
    if (timeMs < this.judgingFrom) return false;

    this.frames.push({ time: timeMs, duration });
    const windowStart = timeMs - this.options.windowMs;
    while (this.frames.length > 0 && (this.frames[0]?.time ?? Infinity) <= windowStart) {
      this.frames.shift();
    }
    // Judge only a full window of frames.
    if (timeMs - this.judgingFrom < this.options.windowMs) return false;
    if (this.stats().slowFrameMs <= budgetMs) return false;
    this.restart(timeMs);
    this.lastTime = timeMs;
    return true;
  }

  /** The frame rate and slow-frame time over the current window (zeros before there is one). */
  stats(): FrameStats {
    const count = this.frames.length;
    if (count === 0) return { fps: 0, slowFrameMs: 0 };
    const durations = this.frames.map((frame) => frame.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    return {
      fps: (count * 1000) / total,
      slowFrameMs: durations[Math.floor(0.75 * (count - 1))] ?? 0,
    };
  }
}
