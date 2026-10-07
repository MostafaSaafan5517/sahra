uniform vec3 uSkyTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
// The horizon's height on screen, 0 (bottom) to 1 (top).
uniform float uHorizonY;
uniform float uTime;
// Direction toward the sun (x left to right, y up), and how much brighter the sky gets where a
// low sun sits.
uniform vec2 uSun;
uniform float uSunGlow;

varying vec2 vScreen;

// A cheap per-pixel hash, 0..1.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float above = vScreen.y - uHorizonY;
  // A low sun brightens the horizon on its side of the sky: left at dawn, right at dusk, nowhere
  // at midday.
  float sunX = 0.5 + uSun.x * 0.5;
  float bloom = exp(-pow((vScreen.x - sunX) * 2.2, 2.0) - pow(above * 5.0, 2.0)) * (1.0 - uSun.y);
  vec3 horizon = uHorizon * (1.0 + uSunGlow * bloom);
  // Above the horizon its glow fades up into the dark sky. Below, it lingers as haze behind the far
  // dunes before giving way to the dark ground between the near lines.
  vec3 sky = mix(horizon, uSkyTop, smoothstep(0.0, 0.45, above));
  vec3 ground = mix(horizon, uGround, smoothstep(0.0, 0.35, -above));
  vec3 color = above >= 0.0 ? sky : ground;

  // Film grain: a faint noise that changes every frame. It also dithers the dark gradients,
  // which would otherwise show bands on 8-bit screens.
  color += (hash(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5) * (3.0 / 255.0);
  gl_FragColor = vec4(color, 1.0);
}
