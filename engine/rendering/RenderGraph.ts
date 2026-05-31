import { RenderPass } from './RenderPass';
import { GPUDevice } from '../gpu/GPUDevice';

export class RenderGraph {
  private passes: RenderPass[] = [];

  public addPass(pass: RenderPass) {
    this.passes.push(pass);
    this.passes.sort((a, b) => a.priority - b.priority);
  }

  public execute(device: GPUDevice, viewport: any) {
    for (const pass of this.passes) {
      pass.render(device, viewport);
    }
  }
}
