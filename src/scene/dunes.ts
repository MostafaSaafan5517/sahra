import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * The dune field's points. Positions are not places in the world: each point packs its layout
 * for the vertex shader (dunes.vert.glsl), which computes the real position every frame.
 *   x: place along its line, -1 (left) to 1 (right), evenly spread with a little jitter
 *   y: which line, 0 (farthest) to 1 (nearest)
 *   z: a random number 0..1, fixed per point
 * Lines are stored farthest first, so nearer sand is drawn over farther sand.
 */
export function createDuneGeometry(
  lines: number,
  pointsPerLine: number,
  random: () => number,
): BufferGeometry {
  const layout = new Float32Array(lines * pointsPerLine * 3);
  let index = 0;
  for (let line = 0; line < lines; line++) {
    const place = lines === 1 ? 1 : line / (lines - 1);
    for (let point = 0; point < pointsPerLine; point++) {
      layout[index++] = ((point + random()) / pointsPerLine) * 2 - 1;
      layout[index++] = place;
      layout[index++] = random();
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(layout, 3));
  return geometry;
}

/**
 * A small seeded random number generator (mulberry32), so the same seed always lays out the
 * same sand. Returns numbers in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
