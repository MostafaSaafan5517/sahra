import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createGrid, GRID_FAR_Z, GRID_HALF_WIDTH, GRID_NEAR_Z } from "./grid";

describe("createGrid", () => {
  it("makes one point per column and row", () => {
    expect(createGrid(200, 60).getAttribute("position").count).toBe(12_000);
  });

  it("lays the points flat across the whole ground area, corner to corner", () => {
    const geometry = createGrid(5, 4);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox).toEqual(
      new Box3(
        new Vector3(-GRID_HALF_WIDTH, 0, GRID_FAR_Z),
        new Vector3(GRID_HALF_WIDTH, 0, GRID_NEAR_Z),
      ),
    );
  });

  it("starts with the row nearest the camera", () => {
    const positions = createGrid(5, 4).getAttribute("position");
    expect([positions.getX(0), positions.getZ(0)]).toEqual([-GRID_HALF_WIDTH, GRID_NEAR_Z]);
    expect([positions.getX(19), positions.getZ(19)]).toEqual([GRID_HALF_WIDTH, GRID_FAR_Z]);
  });
});
