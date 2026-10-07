uniform vec3 uHorizon;
uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;
varying float vHaze;
varying float vSoft;

void main() {
  // Round grains instead of the default squares; near grains get softer edges, as if out of focus.
  float distanceFromCenter = length(gl_PointCoord - 0.5);
  float edge = smoothstep(0.5, mix(0.2, 0.0, vSoft), distanceFromCenter);
  // Far sand takes on the colour of the horizon's glow.
  vec3 color = mix(vColor, uHorizon, vHaze * 0.85);
  gl_FragColor = vec4(color, edge * vAlpha * uOpacity * mix(1.0, 0.75, vSoft));
}
