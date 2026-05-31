export class SharedTransportBuffer {
  public buffer: SharedArrayBuffer | null = null;
  public view: Float32Array | null = null;
  public isIsolated: boolean;
  public readonly SAB_SIZE = 65536;

  constructor() {
    this.isIsolated = typeof SharedArrayBuffer !== 'undefined';
  }

  initialize(): boolean {
    if (this.buffer) return true;

    if (!this.isIsolated) {
      console.warn(
        '[SharedTransportBuffer] SharedArrayBuffer unavailable. ' +
        'The page is not cross-origin isolated. ' +
        'Set Cross-Origin-Opener-Policy: same-origin and ' +
        'Cross-Origin-Embedder-Policy: require-corp to enable.'
      );
      return false;
    }

    try {
      this.buffer = new SharedArrayBuffer(this.SAB_SIZE);
      this.view = new Float32Array(this.buffer);
      this.view.fill(0);
      return true;
    } catch (err) {
      console.error('[SharedTransportBuffer] Failed to allocate SharedArrayBuffer:', err);
      this.isIsolated = false;
      return false;
    }
  }

  getTransportState(): number {
    return this.view?.[0] ?? -1;
  }

  setTransportState(state: number): void {
    if (this.view) this.view[0] = state;
  }

  getPlayhead(): number {
    return this.view?.[1] ?? 0;
  }

  setPlayhead(beat: number): void {
    if (this.view) this.view[1] = beat;
  }

  getTempo(): number {
    return this.view?.[2] ?? 120;
  }

  setTempo(bpm: number): void {
    if (this.view) this.view[2] = bpm;
  }

  destroy(): void {
    this.buffer = null;
    this.view = null;
  }
}

export const globalSharedTransport = new SharedTransportBuffer();
