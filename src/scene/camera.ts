import { PerspectiveCamera } from "three";

export const FIELD_OF_VIEW = 35;
/** Distance from the camera to the nearest and the farthest dune line. */
export const NEAR_DEPTH = 1.2;
export const FAR_DEPTH = 40;
/** The camera stands this high above the sand and looks at the ground this far ahead. */
const CAMERA_HEIGHT = 1.4;
const LOOK_DISTANCE = 12;

/** The scene's camera: standing in the dunes, looking slightly down toward the horizon. */
export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.1, FAR_DEPTH * 2);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.lookAt(0, 0, -LOOK_DISTANCE);
  camera.updateMatrixWorld();
  return camera;
}
