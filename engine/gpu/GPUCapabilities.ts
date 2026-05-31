export class GPUCapabilities {
  public static detect(gl: WebGL2RenderingContext) {
    return {
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxInstances: gl.getParameter(gl.MAX_DRAW_BUFFERS),
      maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
    };
  }
}
