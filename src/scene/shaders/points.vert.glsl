uniform float uTime;
uniform float uPixelRatio;

void main() {
  vec3 moved = position;
  // Two slow travelling waves lift the flat grid into rolling lines.
  moved.y += sin(moved.x * 0.7 + uTime * 0.4) * 0.18;
  moved.y += sin(moved.z * 1.1 - uTime * 0.25) * 0.12;

  vec4 viewPosition = modelViewMatrix * vec4(moved, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  // Points shrink with distance, so the far rows read as depth.
  gl_PointSize = 8.0 * uPixelRatio / -viewPosition.z;
}
