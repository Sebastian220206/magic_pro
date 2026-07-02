import { ViewportState } from '../types';

export enum ViewportChannelId {
  ARRANGEMENT = 'ARRANGEMENT',
  PIANO_ROLL = 'PIANO_ROLL',
  AUTOMATION = 'AUTOMATION',
}

export class SharedViewportGroup {
  private channels = new Map<ViewportChannelId, ViewportState>();
  private horizontalLinks = new Map<ViewportChannelId, ViewportChannelId[]>();

  registerChannel(id: ViewportChannelId, state: ViewportState) {
    this.channels.set(id, state);
  }

  linkHorizontal(source: ViewportChannelId, targets: ViewportChannelId[]) {
    this.horizontalLinks.set(source, targets);
  }

  commitTransaction(source: ViewportChannelId, state: ViewportState) {
    this.channels.set(source, state);
    const links = this.horizontalLinks.get(source);
    if (links) {
      for (const target of links) {
        const targetState = this.channels.get(target);
        if (targetState) {
          targetState.startBeat = state.startBeat;
        }
      }
    }
  }
}

export const globalViewportGroup = new SharedViewportGroup();
