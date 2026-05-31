export const NOTE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position; // Quad geometry (-0.5 to 0.5)

// Instanced attributes
layout(location = 1) in vec4 a_instanceRect;  // x, y, width, height
layout(location = 2) in vec4 a_instanceColor; // r, g, b, a

uniform mat4 u_projectionMatrix;

out vec4 v_color;
out vec2 v_uv;

void main() {
  vec2 size = a_instanceRect.zw;
  vec2 offset = a_instanceRect.xy;
  
  // Transform unit quad to instance rect
  vec2 worldPos = (a_position * size) + offset;
  
  gl_Position = u_projectionMatrix * vec4(worldPos, 0.0, 1.0);
  
  v_color = a_instanceColor;
  v_uv = a_position + 0.5; // Map from -0.5..0.5 to 0..1
}
`;

export const NOTE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_uv;

out vec4 outColor;

void main() {
  // Simple velocity gradient effect on the Y axis
  float gradient = mix(0.7, 1.0, v_uv.y);
  
  // Optional: GPU-calculated rounded corners using SDF (Signed Distance Fields)
  // For raw speed initially, we do standard fill
  outColor = vec4(v_color.rgb * gradient, v_color.a);
}
`;
