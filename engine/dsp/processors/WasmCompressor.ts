import { PluginAPI } from '../../plugins/PluginAPI';

export class WasmCompressor implements PluginAPI {
  constructor(private _runtime: any) {}
  initialize(_sampleRate: number): void {}
  process(_input: Float32Array[], _output: Float32Array[], _params: Record<string, number>): void {}
  dispose(): void {}
}
