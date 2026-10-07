// Each point packs its layout into `position` (see dunes.ts):
//   x: place along its line, -1 (left) to 1 (right)
//   y: which line, 0 (farthest) to 1 (nearest)
//   z: a random number 0..1, fixed per point
// Everything else, including all motion, is computed here.

uniform float uTime;
uniform float uPixelRatio;
uniform float uAspect;
uniform float uTanHalfFov;
uniform float uNearDepth;
uniform float uFarDepth;
uniform float uWindSpeed;
uniform float uFlowStrength;
uniform float uDuneHeight;
uniform float uPointSize;
// Per gust: ground x, ground z, start time, strength (0..1).
uniform vec4 uGustOrigins[MAX_GUSTS];
// Per gust: direction on the ground (unit x, z), unused, unused.
uniform vec4 uGustDirections[MAX_GUSTS];
uniform float uGustStrength;
uniform float uGustRadius;
uniform float uGustLife;
uniform vec3 uSandLit;
uniform vec3 uSandShade;
// Direction toward the sun, seen from the camera: x left to right, y up (a unit vector).
uniform vec2 uSun;

varying vec3 vColor;
varying float vAlpha;
// 0 near, 1 at the far edge: how much a grain fades into the horizon's glow.
varying float vHaze;
// 1 for the nearest grains, which are drawn softer, as if out of focus.
varying float vSoft;

// Dune height at a ground position: ridged noise for sharp crests and soft troughs, a warp so
// crest lines curve, and a slow drift so the dunes creep downwind.
float duneHeight(vec2 ground) {
  vec2 p = ground * 0.11 + vec2(uTime * 0.004, 0.0);
  p += 0.55 * vec2(snoise(p * 0.45 + 3.1), snoise(p * 0.45 - 7.4));
  float crest = 1.0 - abs(snoise(vec2(p.x * 0.8, p.y * 1.7)));
  float swell = snoise(p * 0.3 + 11.0) * 0.5 + 0.5;
  return (crest * crest * 0.75 + swell * 0.45) * uDuneHeight;
}

void main() {
  float along = position.x;
  float line = position.y;
  float seed = position.z;

  // Lines are spaced evenly in inverse depth, which spaces them evenly on screen: wide apart up
  // close, gathering toward the horizon. Each line is as wide as the view at its depth.
  float depth = 1.0 / mix(1.0 / uFarDepth, 1.0 / uNearDepth, line);
  float halfWidth = depth * uTanHalfFov * uAspect * 1.25;

  // Grains stream downwind along their line at slightly different speeds, wrapping at the edges.
  float speed = uWindSpeed * (0.8 + 0.4 * seed);
  float x = mod(along * halfWidth + uTime * speed + halfWidth, 2.0 * halfWidth) - halfWidth;
  vec3 world = vec3(x, 0.0, -depth + (seed - 0.5) * 0.004 * depth);

  // The flow field: slow noise currents carry grains sideways off their line and back.
  vec2 current = world.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.03);
  world.xz += vec2(snoise(current), snoise(current + 19.7)) * uFlowStrength;

  // Right in front of the camera the sand is flatter, as if standing in a trough, so the nearest
  // lines stay below the bottom edge of the view instead of rising into it.
  float flatten = mix(0.3, 1.0, smoothstep(uNearDepth, uNearDepth * 3.5, depth));
  float rawHeight = duneHeight(world.xz);
  float height = rawHeight * flatten;
  float crestiness = clamp(height / max(uDuneHeight, 0.001), 0.0, 1.0);
  // The slope along the view's left-right axis gives each grain's surface a normal; the sun
  // lights the faces turned toward it. One extra height sample, a small step downwind.
  float slope = (duneHeight(world.xz + vec2(0.15, 0.0)) - rawHeight) / 0.15 * flatten;
  float sunlight = clamp(dot(normalize(vec2(-slope, 1.0)), uSun), 0.0, 1.0);
  world.y = height;
  // Near the crests, some grains lift off a little, as blown sand does.
  world.y += max(0.0, snoise(world.xz * 1.3 + vec2(uTime * 0.25, 0.0))) * uFlowStrength * 0.25 * crestiness;

  // Gusts from the visitor's pointer: each one pushes nearby sand along its direction, scatters
  // it a little and lifts it, then lets it settle back over the gust's life.
  vec2 scatter = vec2(cos(seed * 6.2832), sin(seed * 6.2832));
  float lift = 0.25 + 0.35 * fract(seed * 7.13);
  vec3 push = vec3(0.0);
  for (int i = 0; i < MAX_GUSTS; i++) {
    vec4 origin = uGustOrigins[i];
    float age = uTime - origin.z;
    if (age < 0.0 || age > uGustLife) continue;
    vec2 offset = world.xz - origin.xy;
    float falloff = exp(-dot(offset, offset) / (uGustRadius * uGustRadius));
    float envelope = smoothstep(0.0, 0.18, age) * exp(-age * 4.6 / uGustLife)
      * (1.0 - smoothstep(0.8 * uGustLife, uGustLife, age));
    float amount = falloff * envelope * origin.w * uGustStrength;
    push.xz += (uGustDirections[i].xy * 0.8 + scatter * 0.35) * amount;
    push.y += lift * amount;
  }
  world += push;

  // Faces toward the sun are lit, crests a little more; the rest falls into the shade colour.
  vColor = mix(uSandShade, uSandLit, clamp(sunlight * 0.85 + crestiness * 0.25, 0.0, 1.0));
  vHaze = smoothstep(uFarDepth * 0.25, uFarDepth, depth);
  vSoft = 1.0 - smoothstep(uNearDepth, uNearDepth * 2.5, depth);

  vec4 viewPosition = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  // Points shrink with distance. Below one CSS pixel they stay one pixel and fade instead, which
  // avoids shimmer. The farthest lines dissolve into the horizon.
  float size = uPointSize * uPixelRatio * 4.0 / -viewPosition.z;
  gl_PointSize = max(size, uPixelRatio);
  vAlpha = clamp(size / uPixelRatio, 0.0, 1.0) * (1.0 - smoothstep(uFarDepth * 0.6, uFarDepth, depth));
}
