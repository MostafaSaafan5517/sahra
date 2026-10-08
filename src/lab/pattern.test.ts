import { describe, expect, it } from "vitest";
import {
  CONTACT_ANGLE,
  DRAWING_HEIGHT,
  DRAWING_WIDTH,
  OCTAGON_SPACING,
  hankinStar,
  patternSvg,
  tilesWithin,
  type Point,
} from "./pattern";

const close = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;
const key = ({ x, y }: Point) => `${x.toFixed(6)},${y.toFixed(6)}`;

describe("tilesWithin", () => {
  const halfWidth = 3 * OCTAGON_SPACING;
  const halfHeight = 2 * OCTAGON_SPACING;
  const tiles = tilesWithin(halfWidth, halfHeight);

  it("puts an octagon in the middle, with flat sides facing the edges", () => {
    const middle = tiles.find((tile) => close(tile.center, { x: 0, y: 0 }));
    expect(middle?.kind).toBe("octagon");
    const rightmost = Math.max(...(middle?.corners ?? []).map((corner) => corner.x));
    const onTheRight = (middle?.corners ?? []).filter((corner) =>
      close(corner, { ...corner, x: rightmost }),
    );
    expect(onTheRight).toHaveLength(2);
  });

  it("gives every tile sides 1 long", () => {
    for (const { corners } of tiles) {
      corners.forEach((corner, index) => {
        const next = corners[(index + 1) % corners.length] as Point;
        expect(Math.hypot(next.x - corner.x, next.y - corner.y)).toBeCloseTo(1, 9);
      });
    }
  });

  it("fits the tiles together with no gaps: every square corner is also an octagon corner", () => {
    const octagonCorners = new Set(
      tiles.filter((tile) => tile.kind === "octagon").flatMap((tile) => tile.corners.map(key)),
    );
    const squares = tiles.filter((tile) => tile.kind === "square");
    expect(squares.length).toBeGreaterThan(0);
    for (const square of squares.filter((tile) => Math.hypot(tile.center.x, tile.center.y) < 4)) {
      for (const corner of square.corners) expect(octagonCorners.has(key(corner))).toBe(true);
    }
  });

  it("keeps only tiles that reach inside the rectangle it is given, and all of those", () => {
    const inside = ({ x, y }: Point) => Math.abs(x) < halfWidth && Math.abs(y) < halfHeight;
    for (const { center, corners } of tiles) {
      expect(corners.some(inside), `tile at ${key(center)}`).toBe(true);
    }
    const centres = new Set(tiles.map((tile) => key(tile.center)));
    expect(centres.has(key({ x: 3 * OCTAGON_SPACING - OCTAGON_SPACING / 2, y: 0 }))).toBe(false);
    expect(centres.has(key({ x: 2.5 * OCTAGON_SPACING, y: 1.5 * OCTAGON_SPACING }))).toBe(true);
    expect(centres.has(key({ x: 0, y: 2 * OCTAGON_SPACING }))).toBe(true);
    expect(centres.has(key({ x: 0, y: 3 * OCTAGON_SPACING }))).toBe(false);
  });
});

describe("hankinStar", () => {
  const tiles = tilesWithin(2 * OCTAGON_SPACING, 2 * OCTAGON_SPACING);
  const middleOctagon = tiles.find((tile) => close(tile.center, { x: 0, y: 0 }));
  if (!middleOctagon) throw new Error("No octagon in the middle.");

  it("makes an eight-point star in an octagon, its points at the middles of the sides", () => {
    const star = hankinStar(middleOctagon, CONTACT_ANGLE);
    expect(star).toHaveLength(16);
    const tips = star.filter((_, index) => index % 2 === 0);
    for (const tip of tips) expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(OCTAGON_SPACING / 2, 9);
  });

  it("meets each pair of lines on the way from a corner to the centre, as far in as the angle says", () => {
    for (const tile of [middleOctagon, tiles.find((candidate) => candidate.kind === "square")]) {
      if (!tile) throw new Error("No square in the tiling.");
      const sides = tile.corners.length;
      // The triangle of the corner, a side's middle (half a side, 0.5, away) and the meeting point:
      // half the corner's angle at the corner, the contact angle at the side's middle.
      const halfCorner = Math.PI / 2 - Math.PI / sides;
      const fromCorner =
        (0.5 * Math.sin(CONTACT_ANGLE)) / Math.sin(Math.PI - halfCorner - CONTACT_ANGLE);
      const star = hankinStar(tile, CONTACT_ANGLE);
      tile.corners.forEach((_, index) => {
        const corner = tile.corners[(index + 1) % sides] as Point;
        const meeting = star[2 * index + 1] as Point;
        const toCentre = Math.hypot(tile.center.x - corner.x, tile.center.y - corner.y);
        const expected = {
          x: corner.x + ((tile.center.x - corner.x) * fromCorner) / toCentre,
          y: corner.y + ((tile.center.y - corner.y) * fromCorner) / toCentre,
        };
        expect(Math.hypot(meeting.x - expected.x, meeting.y - expected.y)).toBeLessThan(1e-9);
      });
    }
  });

  it("is the same star when turned an eighth of a turn", () => {
    const star = hankinStar(middleOctagon, CONTACT_ANGLE);
    const turn = Math.PI / 4;
    const turned = new Set(
      star.map(({ x, y }) =>
        key({
          x: x * Math.cos(turn) - y * Math.sin(turn),
          y: x * Math.sin(turn) + y * Math.cos(turn),
        }),
      ),
    );
    expect(turned).toEqual(new Set(star.map(key)));
  });

  it("keeps every star inside its own tile", () => {
    for (const tile of tiles) {
      const radius = Math.hypot(
        (tile.corners[0] as Point).x - tile.center.x,
        (tile.corners[0] as Point).y - tile.center.y,
      );
      for (const point of hankinStar(tile, CONTACT_ANGLE)) {
        expect(Math.hypot(point.x - tile.center.x, point.y - tile.center.y)).toBeLessThanOrEqual(
          radius,
        );
      }
    }
  });

  it("runs every line straight across the side it crosses, into the next tile's star", () => {
    // For each side's middle: the directions of the lines leaving it, per tile.
    const leaving = new Map<string, Point[][]>();
    for (const tile of tiles) {
      const star = hankinStar(tile, CONTACT_ANGLE);
      star.forEach((point, index) => {
        if (index % 2 !== 0) return;
        const before = star[(index + star.length - 1) % star.length] as Point;
        const after = star[index + 1] as Point;
        const direction = (to: Point) => {
          const length = Math.hypot(to.x - point.x, to.y - point.y);
          return { x: (to.x - point.x) / length, y: (to.y - point.y) / length };
        };
        const sides = leaving.get(key(point)) ?? [];
        sides.push([direction(before), direction(after)]);
        leaving.set(key(point), sides);
      });
    }
    const shared = [...leaving.values()].filter((sides) => sides.length === 2);
    expect(shared.length).toBeGreaterThan(40);
    for (const [one, other] of shared as [Point[], Point[]][]) {
      for (const direction of one) {
        const straightOn = { x: -direction.x, y: -direction.y };
        expect(other.some((candidate) => close(candidate, straightOn))).toBe(true);
      }
    }
  });
});

describe("patternSvg", () => {
  const svg = patternSvg();
  const paths = [...svg.matchAll(/<path d="([^"]+)" pathLength="1" style="--order:([\d.]+)"\/>/g)];

  it("is one accessible image, sized by its viewBox", () => {
    expect(svg).toMatch(
      new RegExp(`^<svg [^>]*viewBox="0 0 ${String(DRAWING_WIDTH)} ${String(DRAWING_HEIGHT)}"`),
    );
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/<title id="pattern-title">[^<]+<\/title>/);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("gives every line a length of 1 and an order from the centre, 0, to the edge, 1", () => {
    expect(paths.length).toBe(svg.split("<path").length - 1);
    const orders = paths.map((match) => Number(match[2]));
    expect(Math.min(...orders)).toBe(0);
    expect(Math.max(...orders)).toBe(1);
  });

  it("draws the tiling, the small stars and the large stars, in that order", () => {
    const groups = [...svg.matchAll(/<g class="([^"]+)">/g)].map((match) => match[1]);
    expect(groups).toEqual([
      "pattern-tiling",
      "pattern-stars pattern-stars-small",
      "pattern-stars pattern-stars-large",
    ]);
  });

  it("writes only finite coordinates, centred in the drawing", () => {
    const numbers = paths.flatMap((match) => (match[1] ?? "").match(/-?[\d.]+/g) ?? []).map(Number);
    expect(numbers.every(Number.isFinite)).toBe(true);
    const centre = paths.find(
      (match) => match[2] === "0" && (match[1] ?? "").split("L").length === 16,
    );
    expect(centre, "the centre star, sixteen points").toBeDefined();
    const coordinates = (centre?.[1] ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(coordinates.filter((_, index) => index % 2 === 0))).toBeCloseTo(
      DRAWING_WIDTH / 2,
      0,
    );
    expect(mean(coordinates.filter((_, index) => index % 2 === 1))).toBeCloseTo(
      DRAWING_HEIGHT / 2,
      0,
    );
  });
});
