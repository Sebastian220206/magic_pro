import { GPUDevice } from '../gpu/GPUDevice';

// Placeholder viewport state to fulfill the interface
export interface ViewportState {
  startBeat: number;
  pixelsPerBeat: number;
  startPitch?: number;
  pixelsPerPitch?: number;
}

export interface RenderPass {
  id: string;
  priority: number;

  initialize(device: GPUDevice): void;

  render(
    device: GPUDevice,
    viewport: Readonly<ViewportState>
  ): void;
}
