export const GRID_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position; // Unit quad (-1 to 1 to cover screen)

out vec2 v_screenPos;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // Map -1..1 to 0..1
  v_screenPos = a_position * 0.5 + 0.5;
}
`;

export const GRID_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_screenPos;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_offset; // Scroll position (e.g. startBeat, topPitch)
uniform vec2 u_zoom;   // pixelsPerBeat, pixelsPerPitch

void main() {
  // Convert screen coordinates to absolute DAW world coordinates
  vec2 pixelPos = v_screenPos * u_resolution;
  
  // Calculate the logical beat and pitch at this pixel
  float beat = u_offset.x + (pixelPos.x / u_zoom.x);
  float pitch = u_offset.y - (pixelPos.y / u_zoom.y); // Y is inverted in MIDI

  // Calculate distance to the nearest grid line using fract()
  // fract(x) returns the fractional part of x. 
  // If fract(beat) is very close to 0 or 1, we are on a beat line.
  float beatFraction = fract(beat);
  float pitchFraction = fract(pitch);
  
  // Define line thickness (e.g., 1 pixel)
  float beatLineWidth = 1.0 / u_zoom.x;
  float pitchLineWidth = 1.0 / u_zoom.y;

  // Determine if we are drawing a beat line
  bool isBeatLine = beatFraction < beatLineWidth || beatFraction > (1.0 - beatLineWidth);
  
  // Determine if we are drawing a pitch line
  bool isPitchLine = pitchFraction < pitchLineWidth || pitchFraction > (1.0 - pitchLineWidth);

  // Background Piano Roll banding (Darker rows for black keys)
  // pitch % 12 determines the note. 1, 3, 6, 8, 10 are black keys.
  int noteInOctave = int(mod(pitch, 12.0));
  bool isBlackKey = noteInOctave == 1 || noteInOctave == 3 || noteInOctave == 6 || noteInOctave == 8 || noteInOctave == 10;
  
  vec3 bgColor = isBlackKey ? vec3(0.1) : vec3(0.15);

  if (isBeatLine || isPitchLine) {
    outColor = vec4(1.0, 1.0, 1.0, 0.1); // Grid line color
  } else {
    outColor = vec4(bgColor, 1.0);
  }
}
`;
