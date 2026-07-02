import { ViewportState } from '../../navigation/types';

export interface RenderableOverlay {
  id: string;
  draw(ctx: CanvasRenderingContext2D, viewport: Readonly<ViewportState>): void;
}
