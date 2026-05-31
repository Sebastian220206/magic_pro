export const CURVE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position; // Instance quad spanning bounding box of the curve

// Bezier Control points
layout(location = 1) in vec2 a_p0;
layout(location = 2) in vec2 a_p1;
layout(location = 3) in vec2 a_p2;
layout(location = 4) in vec2 a_p3;
layout(location = 5) in vec4 a_color;

uniform mat4 u_projectionMatrix;

out vec2 v_uv;
out vec2 v_p0;
out vec2 v_p1;
out vec2 v_p2;
out vec2 v_p3;
out vec4 v_color;

void main() {
  // A single quad completely encompasses the maximum bounding box of the cubic bezier curve.
  // The fragment shader mathematically evaluates the distance to the curve.
  
  vec2 minBound = min(min(a_p0, a_p1), min(a_p2, a_p3));
  vec2 maxBound = max(max(a_p0, a_p1), max(a_p2, a_p3));
  
  // Add padding for line thickness
  minBound -= vec2(2.0);
  maxBound += vec2(2.0);
  
  vec2 size = maxBound - minBound;
  vec2 worldPos = minBound + (a_position * size);
  
  gl_Position = u_projectionMatrix * vec4(worldPos, 0.0, 1.0);
  
  // Pass world coordinates to fragment shader
  v_uv = worldPos;
  v_p0 = a_p0;
  v_p1 = a_p1;
  v_p2 = a_p2;
  v_p3 = a_p3;
  v_color = a_color;
}
`;

export const CURVE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec2 v_p0;
in vec2 v_p1;
in vec2 v_p2;
in vec2 v_p3;
in vec4 v_color;

out vec4 outColor;

// Computes the approximate minimum distance from point 'p' to the cubic bezier curve
float distanceToCubicBezier(vec2 p, vec2 p0, vec2 p1, vec2 p2, vec2 p3) {
  // Analytical distance to a cubic bezier requires solving a 5th degree polynomial.
  // In real-time graphics, we use an iterative approach or numerical approximation.
  // For standard DAW curves (which are typically monotonic in X), we can approximate by solving for t given X, then checking Y.
  
  // Simplified placeholder distance function:
  return length(p - p0); // REPLACE WITH REAL BEZIER DISTANCE SOLVER
}

void main() {
  float dist = distanceToCubicBezier(v_uv, v_p0, v_p1, v_p2, v_p3);
  
  float lineThickness = 1.5;
  
  // Anti-aliasing using smoothstep
  float alpha = 1.0 - smoothstep(lineThickness - 0.5, lineThickness + 0.5, dist);
  
  if (alpha <= 0.0) {
    discard;
  }
  
  outColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;
