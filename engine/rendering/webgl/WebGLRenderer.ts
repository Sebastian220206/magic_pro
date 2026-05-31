import { WebGLBatcher } from './WebGLBatcher';
import { NOTE_VERTEX_SHADER, NOTE_FRAGMENT_SHADER } from './shaders/NoteShader';

export class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private batcher: WebGLBatcher;
  private program: WebGLProgram;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
    if (!gl) {
      throw new Error("WebGL2 not supported on this device.");
    }
    this.gl = gl;
    this.batcher = new WebGLBatcher(gl);
    
    this.program = this.compileProgram(NOTE_VERTEX_SHADER, NOTE_FRAGMENT_SHADER);
    this.setupGeometry();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error("Shader compilation error: " + this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  private compileProgram(vsSource: string, fsSource: string): WebGLProgram {
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource);
    
    const program = this.gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error("Program linking error: " + this.gl.getProgramInfoLog(program));
    }
    return program;
  }

  private setupGeometry() {
    const gl = this.gl;
    
    // Unit Quad Geometry (center anchored at top-left conceptually, or center)
    // For DAW coords, 0,0 top left to 1,1 bottom right is easiest to scale
    const quadVertices = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      0.0, 1.0,
      1.0, 0.0,
      1.0, 1.0
    ]);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Setup VAO (Vertex Array Object)
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Attribute 0: Geometry Position
    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Instances attributes are configured in the Batcher or immediately following
    // (In a full implementation, we'd map the batcher's instanceBuffer to locations 1 and 2 here,
    // and use vertexAttribDivisor to step per instance).
    // ...
  }

  public beginFrame(width: number, height: number) {
    this.gl.viewport(0, 0, width, height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Setup Orthographic Projection Matrix for 2D Viewport
    const projLoc = this.gl.getUniformLocation(this.program, "u_projectionMatrix");
    
    // Ortho matrix: left, right, bottom, top, near, far
    // Standard 2D canvas origin is Top-Left (0,0) down to (width, height)
    const ortho = new Float32Array([
      2/width, 0, 0, 0,
      0, -2/height, 0, 0,
      0, 0, -1, 0,
      -1, 1, 0, 1
    ]);
    
    this.gl.uniformMatrix4fv(projLoc, false, ortho);
  }

  public drawRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
    this.batcher.pushRect(x, y, w, h, r, g, b, a);
  }

  public endFrame() {
    this.batcher.flush();
  }
}
