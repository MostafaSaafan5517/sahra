import { BufferGeometry, Float32BufferAttribute } from "three";

/** Half the grid's width, in scene units; the grid is centred on x = 0. */
export const GRID_HALF_WIDTH = 6;
/** The grid runs from z = GRID_NEAR_Z (closest to the camera) to GRID_FAR_Z. */
export const GRID_NEAR_Z = 2;
export const GRID_FAR_Z = -10;

/** A flat grid of points on the ground plane (y = 0), receding from the camera. */
export function createGrid(columns: number, rows: number): BufferGeometry {
  const positions = new Float32Array(columns * rows * 3);
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const z = GRID_NEAR_Z + (row / (rows - 1)) * (GRID_FAR_Z - GRID_NEAR_Z);
    for (let column = 0; column < columns; column++) {
      positions[index++] = (column / (columns - 1)) * 2 * GRID_HALF_WIDTH - GRID_HALF_WIDTH;
      positions[index++] = 0;
      positions[index++] = z;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}
