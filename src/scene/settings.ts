/** The scene's look and motion. Units are scene units (about a metre) and seconds. */
export const SCENE_SETTINGS = {
  /** Same seed, same sand: the layout of the points never changes between visits. */
  seed: 1,
  lines: 96,
  pointsPerLine: 512,
  /** How fast grains stream downwind along their lines. */
  windSpeed: 0.35,
  /** How far the noise currents carry grains off their lines. */
  flowStrength: 0.12,
  duneHeight: 0.9,
  /** Grain size in CSS pixels at four units from the camera. */
  pointSize: 2,
};
