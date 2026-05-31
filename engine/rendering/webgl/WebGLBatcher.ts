export class WebGLBatcher {
  private gl: WebGL2RenderingContext;
  private maxInstances: number;
  
  // Instance Data: x, y, width, height, r, g, b, a
  private instanceData: Float32Array;
  private instanceCount: number = 0;
  
  private instanceBuffer: WebGLBuffer;

  constructor(gl: WebGL2RenderingContext, maxInstances = 100000) {
    this.gl = gl;
    this.maxInstances = maxInstances;
    this.instanceData = new Float32Array(maxInstances * 8);

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("Failed to create WebGL buffer");
    this.instanceBuffer = buffer;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
  }

  public pushRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
    if (this.instanceCount >= this.maxInstances) {
      this.flush(); // Auto-flush if batch is full
    }

    const offset = this.instanceCount * 8;
    this.instanceData[offset] = x;
    this.instanceData[offset + 1] = y;
    this.instanceData[offset + 2] = w;
    this.instanceData[offset + 3] = h;
    this.instanceData[offset + 4] = r;
    this.instanceData[offset + 5] = g;
    this.instanceData[offset + 6] = b;
    this.instanceData[offset + 7] = a;

    this.instanceCount++;
  }

  public flush() {
    if (this.instanceCount === 0) return;

    const gl = this.gl;
    
    // Upload the modified portion of the instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData, 0, this.instanceCount * 8);

    // Draw instanced arrays (assumes shaders and VAO are already bound by the renderer)
    // 6 vertices per quad
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount);

    this.instanceCount = 0; // Reset batch
  }
}
