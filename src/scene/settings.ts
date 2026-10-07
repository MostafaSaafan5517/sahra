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
  /** How far a full-strength gust pushes the sand. */
  gustStrength: 0.8,
  /** How far a gust reaches across the sand. */
  gustRadius: 1.4,
  /** Seconds from a gust's start until its sand has settled back. */
  gustLife: 2.4,
  /** Seconds for the light to go from dawn through midday and dusk back to dawn. */
  cycleSeconds: 180,
  /** Where in that cycle a visit starts: 0 dawn, 1/3 midday, 2/3 dusk. */
  startPhase: 0.62,
  /**
   * The scene's clock reads this many seconds when a visit starts, so every visit's first frame is
   * the same picture: the poster (`pnpm poster` captures it). Change it, or anything else that
   * changes the first frame, and capture the poster again.
   */
  startTime: 12,
};
