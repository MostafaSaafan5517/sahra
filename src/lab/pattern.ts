/**
 * The Lab's line drawing: an eight-point star pattern in the tradition of Islamic geometric art,
 * built with Hankin's "polygons in contact" method on the octagon and square tiling.
 *
 * From the middle of every edge of the tiling, two lines leave into each tile, tilted away from
 * the edge by the contact angle. Each runs until it meets the line from the neighbouring edge.
 * Inside an octagon this draws an eight-point star, inside a square a small four-point star, and
 * since both tiles on either side of an edge use the same angle, every line crosses the edge
 * straight into the next tile: the stars join into one continuous pattern.
 *
 * This runs at build time: a Vite plugin writes `patternSvg()` into `lab/index.html`, so the
 * drawing is plain SVG, and CSS (`src/lab/lab.css`) draws it.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Tile {
  readonly kind: "octagon" | "square";
  readonly center: Point;
  /** Corners in counter-clockwise order (y pointing up). */
  readonly corners: readonly Point[];
}

/** Distance between neighbouring octagons' centres, for tiles whose sides are 1 long. */
export const OCTAGON_SPACING = 1 + Math.SQRT2;

/**
 * The contact angle: 60 degrees gives clear eight-point stars with calm crossings between them
 * (67.5, the other classic choice, crowds them with overlapping kites).
 */
export const CONTACT_ANGLE = Math.PI / 3;

/**
 * The drawing's size in SVG units (its `viewBox`): 3 by 2, for wide screens. Phones show its
 * middle square (`preserveAspectRatio="xMidYMid slice"` and a square box in CSS).
 */
export const DRAWING_WIDTH = 960;
export const DRAWING_HEIGHT = 640;

/** How many octagons fit from top to bottom; the centre one sits in the middle. */
const OCTAGONS_TALL = 4;

function regularPolygon(
  center: Point,
  sides: number,
  circumradius: number,
  firstAngle: number,
): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = firstAngle + (index * 2 * Math.PI) / sides;
    return {
      x: center.x + circumradius * Math.cos(angle),
      y: center.y + circumradius * Math.sin(angle),
    };
  });
}

/** The radius of the circle touching a regular polygon's sides, for sides 1 long. */
function inradius(sides: number): number {
  return 1 / (2 * Math.tan(Math.PI / sides));
}

/**
 * The octagon and square tiling (4.8.8), sides 1 long, with an octagon centred on the origin.
 * Octagons have flat sides facing up, down, left and right; the squares between four octagons
 * stand on a corner. Returns every tile that reaches inside the rectangle from -halfWidth to
 * +halfWidth across and -halfHeight to +halfHeight up.
 */
export function tilesWithin(halfWidth: number, halfHeight: number): Tile[] {
  const octagonRadius = 1 / (2 * Math.sin(Math.PI / 8));
  const squareRadius = Math.SQRT1_2;
  const reach = Math.ceil(Math.max(halfWidth, halfHeight) / OCTAGON_SPACING) + 1;
  const reachesInside = (center: Point, sides: number) =>
    Math.abs(center.x) - inradius(sides) < halfWidth - 1e-9 &&
    Math.abs(center.y) - inradius(sides) < halfHeight - 1e-9;

  const tiles: Tile[] = [];
  for (let row = -reach; row <= reach; row++) {
    for (let column = -reach; column <= reach; column++) {
      const octagon = { x: column * OCTAGON_SPACING, y: row * OCTAGON_SPACING };
      if (reachesInside(octagon, 8)) {
        tiles.push({
          kind: "octagon",
          center: octagon,
          corners: regularPolygon(octagon, 8, octagonRadius, Math.PI / 8),
        });
      }
      const square = { x: octagon.x + OCTAGON_SPACING / 2, y: octagon.y + OCTAGON_SPACING / 2 };
      if (reachesInside(square, 4)) {
        tiles.push({
          kind: "square",
          center: square,
          corners: regularPolygon(square, 4, squareRadius, 0),
        });
      }
    }
  }
  return tiles;
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The unit vector from a towards b, turned by `angle` (counter-clockwise when positive). */
function heading(a: Point, b: Point, angle: number): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const x = (b.x - a.x) / length;
  const y = (b.y - a.y) / length;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** Where the line through p along u meets the line through q along v. */
function intersection(p: Point, u: Point, q: Point, v: Point): Point {
  const along = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / (u.x * v.y - u.y * v.x);
  return { x: p.x + along * u.x, y: p.y + along * u.y };
}

/**
 * Hankin's star inside one tile, as a closed outline: each edge's midpoint, then the point where
 * its line meets the next edge's line, all the way round.
 */
export function hankinStar(tile: Tile, contactAngle: number): Point[] {
  const { corners } = tile;
  const at = (index: number) => corners[index % corners.length] as Point;
  return corners.flatMap((corner, index) => {
    const shared = at(index + 1);
    const middle = midpoint(corner, shared);
    const nextMiddle = midpoint(shared, at(index + 2));
    // Corners run counter-clockwise, so the tile's inside is to the left of each edge: the line
    // from this edge turns left, the one from the next edge, heading back, turns right.
    const meeting = intersection(
      middle,
      heading(middle, shared, contactAngle),
      nextMiddle,
      heading(nextMiddle, shared, -contactAngle),
    );
    return [middle, meeting];
  });
}

/** Rounds to a tenth of an SVG unit: finer than a pixel at any size the page shows. */
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The finished `<svg>`: the tiling's octagons (the construction lines), then the stars, each a
 * closed path with `pathLength="1"` and a `--order` from 0 (the centre) to 1 (the farthest tile),
 * which the CSS uses to draw from the centre outwards.
 */
export function patternSvg(): string {
  const halfHeight = (OCTAGONS_TALL / 2) * OCTAGON_SPACING;
  const scale = DRAWING_HEIGHT / 2 / halfHeight;
  const tiles = tilesWithin(DRAWING_WIDTH / 2 / scale, halfHeight);
  const farthest = Math.max(...tiles.map(({ center }) => Math.hypot(center.x, center.y)));

  const path = (points: readonly Point[], center: Point) => {
    const d = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${String(round(DRAWING_WIDTH / 2 + point.x * scale))} ${String(round(DRAWING_HEIGHT / 2 - point.y * scale))}`,
      )
      .join("");
    const order = Math.round((Math.hypot(center.x, center.y) / farthest) * 100) / 100;
    return `<path d="${d}Z" pathLength="1" style="--order:${String(order)}"/>`;
  };
  const stars = (kind: Tile["kind"]) =>
    tiles
      .filter((tile) => tile.kind === kind)
      .map((tile) => path(hankinStar(tile, CONTACT_ANGLE), tile.center))
      .join("");
  // The squares are the gaps between octagons, so the octagons' outlines draw the whole tiling.
  const tiling = tiles
    .filter((tile) => tile.kind === "octagon")
    .map((tile) => path(tile.corners, tile.center))
    .join("");

  return [
    `<svg class="pattern" viewBox="0 0 ${String(DRAWING_WIDTH)} ${String(DRAWING_HEIGHT)}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="pattern-title">`,
    `<title id="pattern-title">Eight-point stars and small four-point stars in thin lines, joined into one pattern over a faint grid of octagons and squares</title>`,
    `<g class="pattern-tiling">${tiling}</g>`,
    `<g class="pattern-stars pattern-stars-small">${stars("square")}</g>`,
    `<g class="pattern-stars pattern-stars-large">${stars("octagon")}</g>`,
    `</svg>`,
  ].join("");
}
