import { SharedViewportGroup, ViewportChannelId } from './ViewportChannel';

export class AutomationViewportClient {
  constructor(private viewportGroup: SharedViewportGroup) {}

  public initialize() {
    this.viewportGroup.linkHorizontal(
      ViewportChannelId.ARRANGEMENT,
      [ViewportChannelId.AUTOMATION]
    );
  }
}
