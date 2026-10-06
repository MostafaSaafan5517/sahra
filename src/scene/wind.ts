import { Plane, Raycaster, Vector2, Vector3, type Camera } from "three";

/** How many gusts the vertex shader tracks at once (its uniform arrays have this length). */
export const MAX_GUSTS = 12;
/** Pointer positions are projected onto a plane at this height, about the dunes' average. */
const GROUND_HEIGHT = 0.4;
/** A pause longer than this ends a stroke: the next movement starts a new one. */
const STROKE_GAP_SECONDS = 0.25;
/** Gusts weaker than this (a barely moving pointer) are not worth a slot. */
const MIN_STRENGTH = 0.05;
/** Pointer speed, in viewport diagonals per second, that gives a gust full strength. */
const FULL_STRENGTH_SPEED = 0.8;

export interface Gust {
  /** Where the gust hits the sand. */
  x: number;
  z: number;
  /** Which way it blows along the ground (a unit vector). */
  directionX: number;
  directionZ: number;
  /** 0..1, from the pointer's speed. */
  strength: number;
  /** In seconds, on the same clock as the shader's `uTime`. */
  startTime: number;
}

/**
 * The gusts the shader reads, in two flat arrays that are the uniform values themselves
 * (`uGustOrigins`, `uGustDirections`), so adding a gust needs no further copying. A new gust
 * takes the slot of the oldest one.
 */
export class GustField {
  /** Per gust: x, z, start time, strength. */
  readonly origins = new Float32Array(MAX_GUSTS * 4);
  /** Per gust: direction x, direction z, unused, unused. */
  readonly directions = new Float32Array(MAX_GUSTS * 4);
  private nextSlot = 0;

  constructor() {
    // Every slot starts long expired, so the shader skips it.
    for (let slot = 0; slot < MAX_GUSTS; slot++) this.origins[slot * 4 + 2] = -1e6;
  }

  add(gust: Gust): void {
    const offset = this.nextSlot * 4;
    this.origins.set([gust.x, gust.z, gust.startTime, gust.strength], offset);
    this.directions.set([gust.directionX, gust.directionZ, 0, 0], offset);
    this.nextSlot = (this.nextSlot + 1) % MAX_GUSTS;
  }
}

/**
 * Where a point on the screen (in normalized device coordinates, -1..1) meets the sand, or null
 * when it is in the sky.
 */
export function groundPoint(ndcX: number, ndcY: number, camera: Camera): Vector3 | null {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
  return raycaster.ray.intersectPlane(
    new Plane(new Vector3(0, 1, 0), -GROUND_HEIGHT),
    new Vector3(),
  );
}

interface Sample {
  x: number;
  y: number;
  time: number;
}

/**
 * Turns a moving pointer or finger into gusts. Each movement gives the pointer's speed and
 * direction; at most one gust is made per `interval`, which is set so a gust's slot is never
 * reused while it is still blowing (no sand snapping back early).
 */
export class GustTrail {
  interval: number;
  private readonly camera: Camera;
  private readonly field: GustField;
  private previous: Sample | null = null;
  private lastGustTime = -Infinity;

  constructor(camera: Camera, field: GustField, interval: number) {
    this.camera = camera;
    this.field = field;
    this.interval = interval;
  }

  /** The pointer is at (x, y) CSS pixels in a viewport of width × height, at `time` seconds. */
  move(x: number, y: number, time: number, width: number, height: number): void {
    const previous = this.previous;
    this.previous = { x, y, time };
    if (!previous || time - previous.time > STROKE_GAP_SECONDS) return;
    if (time - this.lastGustTime < this.interval) return;

    const elapsed = Math.max(time - previous.time, 1 / 240);
    const speed = Math.hypot(x - previous.x, y - previous.y) / elapsed / Math.hypot(width, height);
    const strength = Math.min(1, speed / FULL_STRENGTH_SPEED);
    if (strength < MIN_STRENGTH) return;

    const from = groundPoint(
      (previous.x / width) * 2 - 1,
      1 - (previous.y / height) * 2,
      this.camera,
    );
    const to = groundPoint((x / width) * 2 - 1, 1 - (y / height) * 2, this.camera);
    if (!from || !to) return;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    if (length === 0) return;

    this.field.add({
      x: to.x,
      z: to.z,
      directionX: (to.x - from.x) / length,
      directionZ: (to.z - from.z) / length,
      strength,
      startTime: time,
    });
    this.lastGustTime = time;
  }

  /** The stroke ended (finger lifted): the next movement starts a new one. */
  end(): void {
    this.previous = null;
  }
}

/**
 * Feeds mouse and finger movement anywhere on the page into the trail. Fingers use touch events
 * rather than pointer events: touch events keep arriving while the browser scrolls or zooms, and
 * passive listeners never block either, so the page's own touch behaviour is untouched.
 */
export function listenForGusts(trail: GustTrail): void {
  const seconds = () => performance.now() / 1000;
  addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      trail.move(event.clientX, event.clientY, seconds(), innerWidth, innerHeight);
    },
    { passive: true },
  );
  const followFinger = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) trail.move(touch.clientX, touch.clientY, seconds(), innerWidth, innerHeight);
  };
  addEventListener(
    "touchstart",
    (event) => {
      trail.end();
      followFinger(event);
    },
    { passive: true },
  );
  addEventListener("touchmove", followFinger, { passive: true });
  const endStroke = () => {
    trail.end();
  };
  addEventListener("touchend", endStroke, { passive: true });
  addEventListener("touchcancel", endStroke, { passive: true });
}
