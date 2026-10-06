uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;
varying float vShade;

void main() {
  // Round, soft-edged grains instead of the default squares.
  float distanceFromCenter = length(gl_PointCoord - 0.5);
  float edge = smoothstep(0.5, 0.2, distanceFromCenter);
  gl_FragColor = vec4(uColor * vShade, edge * vAlpha * uOpacity);
}
