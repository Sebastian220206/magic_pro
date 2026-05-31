import { ViewportState } from '../types';

export enum ViewportChannelId {
  ARRANGEMENT = 'ARRANGEMENT',
  PIANO_ROLL = 'PIANO_ROLL',
  AUTOMATION = 'AUTOMATION',
  MIXER = 'MIXER'
}

export class SharedViewportGroup {
  private channels = new Map<ViewportChannelId, ViewportState>();
  private linkages = new Map<ViewportChannelId, ViewportChannelId[]>();
  private listeners = new Map<ViewportChannelId, Array<(s: ViewportState) => void>>();

  public registerChannel(id: ViewportChannelId, initial: ViewportState) {
    this.channels.set(id, { ...initial });
    this.listeners.set(id, []);
  }

  public linkHorizontal(master: ViewportChannelId, targets: ViewportChannelId[]) {
    this.linkages.set(master, targets);
  }

  public getChannel(id: ViewportChannelId): Readonly<ViewportState> | undefined {
    return this.channels.get(id);
  }

  public commitTransaction(id: ViewportChannelId, nextState: ViewportState) {
    this.channels.set(id, nextState);
    this.notify(id, nextState);

    // Enforce linkages
    const linked = this.linkages.get(id);
    if (linked) {
      for (const targetId of linked) {
        const targetState = this.channels.get(targetId);
        if (targetState) {
          const newTargetState = {
            ...targetState,
            startBeat: nextState.startBeat,
            pixelsPerBeat: nextState.pixelsPerBeat
          };
          this.channels.set(targetId, newTargetState);
          this.notify(targetId, newTargetState);
        }
      }
    }
  }

  public subscribe(id: ViewportChannelId, fn: (s: ViewportState) => void): () => void {
    const arr = this.listeners.get(id);
    if (arr) arr.push(fn);
    return () => {
      const arr2 = this.listeners.get(id);
      if (arr2) {
        this.listeners.set(id, arr2.filter(l => l !== fn));
      }
    };
  }

  private notify(id: ViewportChannelId, state: ViewportState) {
    const arr = this.listeners.get(id);
    if (arr) {
      const frozen = Object.freeze({ ...state });
      for (const fn of arr) fn(frozen);
    }
  }
}

export const globalViewportGroup = new SharedViewportGroup();
