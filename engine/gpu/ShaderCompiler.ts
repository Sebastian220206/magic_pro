export class ShaderCompiler {
  public static compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${log}`);
    }
    return shader;
  }

  public static createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
    const vertexShader = this.compile(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compile(gl, gl.FRAGMENT_SHADER, fsSource);
    
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program linking error: ${log}`);
    }
    return program;
  }
}
