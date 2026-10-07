// A full-screen quad drawn behind the dunes: the plane's corners are already in clip space.
varying vec2 vScreen;

void main() {
  vScreen = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
