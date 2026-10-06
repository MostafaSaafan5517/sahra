void main() {
  // Round, soft-edged points instead of the default squares.
  float distanceFromCenter = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.15, distanceFromCenter);
  gl_FragColor = vec4(0.85, 0.76, 0.62, alpha * 0.8);
}
