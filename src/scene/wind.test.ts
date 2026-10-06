import { describe, expect, it } from "vitest";
import { createCamera } from "./camera";
import { GustField, GustTrail, MAX_GUSTS, groundPoint } from "./wind";

const WIDTH = 1600;
const HEIGHT = 900;

function slot(field: GustField, index: number) {
  const [x, z, startTime, strength] = field.origins.slice(index * 4, index * 4 + 4);
  const [directionX, directionZ] = field.directions.slice(index * 4, index * 4 + 2);
  return { x, z, startTime, strength, directionX, directionZ };
}

function activeSlots(field: GustField, now: number) {
  return Array.from({ length: MAX_GUSTS }, (_, index) => slot(field, index)).filter(
    (gust) => gust.startTime !== undefined && gust.startTime > now - 1000,
  );
}

function trail(interval = 0.2) {
  const field = new GustField();
  return { field, trail: new GustTrail(createCamera(WIDTH / HEIGHT), field, interval) };
}

describe("GustField", () => {
  it("starts with every slot long expired", () => {
    expect(activeSlots(new GustField(), 0)).toEqual([]);
  });

  it("writes a gust into the uniform arrays", () => {
    const field = new GustField();
    field.add({ x: 1, z: -5, directionX: 0, directionZ: -1, strength: 0.5, startTime: 3 });
    expect(slot(field, 0)).toEqual({
      x: 1,
      z: -5,
      startTime: 3,
      strength: 0.5,
      directionX: 0,
      directionZ: -1,
    });
  });

  it("replaces the oldest gust once every slot is used", () => {
    const field = new GustField();
    for (let index = 0; index <= MAX_GUSTS; index++) {
      field.add({ x: index, z: 0, directionX: 1, directionZ: 0, strength: 1, startTime: index });
    }
    expect(slot(field, 0).x).toBe(MAX_GUSTS);
    expect(slot(field, 1).x).toBe(1);
  });
});

describe("groundPoint", () => {
  const camera = createCamera(WIDTH / HEIGHT);

  it("finds the sand ahead of the camera at the centre of the screen", () => {
    const point = groundPoint(0, 0, camera);
    expect(point?.x).toBeCloseTo(0);
    expect(point?.z).toBeLessThan(-5);
  });

  it("finds sand to the left for points left of centre, and nearer sand lower on screen", () => {
    const centre = groundPoint(0, -0.5, camera);
    const left = groundPoint(-0.5, -0.5, camera);
    const lower = groundPoint(0, -0.9, camera);
    expect(left?.x).toBeLessThan(0);
    expect(lower?.z).toBeGreaterThan(centre?.z ?? 0);
  });

  it("finds nothing in the sky", () => {
    expect(groundPoint(0, 0.9, camera)).toBeNull();
  });
});

describe("GustTrail", () => {
  // Lower half of the screen, where the sand is.
  const y = HEIGHT * 0.8;

  it("blows a gust where a quickly moving pointer is, in the direction it moves", () => {
    const { field, trail: gusts } = trail();
    gusts.move(800, y, 10, WIDTH, HEIGHT);
    gusts.move(900, y, 10.05, WIDTH, HEIGHT);
    const [gust] = activeSlots(field, 10);
    expect(gust?.startTime).toBeCloseTo(10.05);
    expect(gust?.directionX).toBeCloseTo(1);
    expect(gust?.directionZ).toBeCloseTo(0);
    expect(gust?.x).toBeGreaterThan(0);
    expect(gust?.strength).toBeCloseTo(1);
  });

  it("makes gentle gusts from slow movement and none from a barely moving pointer", () => {
    const { field, trail: gusts } = trail();
    gusts.move(800, y, 10, WIDTH, HEIGHT);
    gusts.move(810, y, 10.1, WIDTH, HEIGHT);
    expect(activeSlots(field, 10)[0]?.strength).toBeLessThan(0.1);

    const { field: stillField, trail: stillGusts } = trail();
    stillGusts.move(800, y, 10, WIDTH, HEIGHT);
    stillGusts.move(801, y, 10.1, WIDTH, HEIGHT);
    expect(activeSlots(stillField, 10)).toEqual([]);
  });

  it("makes at most one gust per interval", () => {
    const { field, trail: gusts } = trail(0.12);
    for (let step = 0; step <= 10; step++) {
      gusts.move(400 + step * 50, y, 10 + step * 0.05, WIDTH, HEIGHT);
    }
    // Moves every 0.05 s from 10.05 to 10.5; a gust needs 0.12 s since the last one.
    expect(activeSlots(field, 10).map((gust) => gust.startTime)).toEqual(
      [10.05, 10.2, 10.35, 10.5].map(Math.fround),
    );
  });

  it("needs two movements of the same stroke before it knows a speed", () => {
    const { field, trail: gusts } = trail();
    gusts.move(800, y, 10, WIDTH, HEIGHT);
    // A long pause, then a jump: a new stroke, not a fast movement.
    gusts.move(1400, y, 11, WIDTH, HEIGHT);
    expect(activeSlots(field, 10)).toEqual([]);

    gusts.end();
    gusts.move(200, y, 11.01, WIDTH, HEIGHT);
    expect(activeSlots(field, 10)).toEqual([]);
  });

  it("makes no gust while the pointer moves through the sky", () => {
    const { field, trail: gusts } = trail();
    gusts.move(800, HEIGHT * 0.05, 10, WIDTH, HEIGHT);
    gusts.move(900, HEIGHT * 0.05, 10.05, WIDTH, HEIGHT);
    expect(activeSlots(field, 10)).toEqual([]);
  });
});
