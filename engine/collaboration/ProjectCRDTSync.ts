import { CRDTProvider } from './CRDTProvider';
import { useProjectStore } from '@/store/projectStore';
import * as Y from 'yjs';

export class ProjectCRDTSync {
  private crdt: CRDTProvider;

  constructor(crdtProvider: CRDTProvider) {
    this.crdt = crdtProvider;
  }

  public initialize() {
    // 1. Observe CRDT changes (remote or local) and sync to Zustand
    this.crdt.tracks.observeDeep((events) => {
      // In a real app, we convert the Y.Array into a plain JSON object
      // and patch the zustand store to minimize re-renders.
      const plainTracks = this.crdt.tracks.toJSON();
      useProjectStore.setState({ tracks: plainTracks });
    });

    this.crdt.clips.observeDeep((events) => {
      const plainClips = this.crdt.clips.toJSON();
      useProjectStore.setState({ clips: plainClips });
    });

    // Note: To prevent infinite loops, we need a mechanism to distinguish
    // between "UI triggered state changes" and "CRDT triggered state changes".
    // Usually, we force the UI to ONLY mutate the CRDT, and let the CRDT 
    // observer exclusively drive the Zustand state.
  }

  /**
   * Called by the UI when a user drags a clip.
   */
  public updateClipPosition(clipId: string, newStartBeat: number) {
    const clipsArray = this.crdt.clips;
    
    // Yjs arrays require iterating to find the item
    // In production, an indexed map structure (Y.Map of Y.Maps) is faster
    for (let i = 0; i < clipsArray.length; i++) {
      const clipMap = clipsArray.get(i);
      if (clipMap.get('id') === clipId) {
        // This transaction will automatically sync over WebSockets 
        // and trigger the observer on all connected clients.
        clipMap.set('start', newStartBeat);
        break;
      }
    }
  }
}
