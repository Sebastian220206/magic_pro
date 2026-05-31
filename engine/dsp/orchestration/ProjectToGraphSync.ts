class GraphSync {
  private _workletPort: MessagePort | null = null;
  private _initialized = false;

  setWorkletPort(port: MessagePort): void {
    this._workletPort = port;
  }

  initialize(): void {
    if (this._initialized) return;
    console.log('[GraphSync] Engine graph sync initialized');
    this._initialized = true;
  }

  sendMessage(message: Record<string, unknown>): void {
    if (this._workletPort) {
      this._workletPort.postMessage(message);
    }
  }

  destroy(): void {
    this._workletPort = null;
    this._initialized = false;
  }
}

export const globalGraphSync = new GraphSync();
