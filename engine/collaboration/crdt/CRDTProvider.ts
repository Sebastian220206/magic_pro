import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

function getCrdtUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CRDT_URL) {
    return process.env.NEXT_PUBLIC_CRDT_URL;
  }
  if (typeof window !== 'undefined' && typeof (window as any).__NEXT_DATA__ !== 'undefined') {
    const pub = (window as any).__NEXT_DATA__.runtimeConfig?.NEXT_PUBLIC_CRDT_URL;
    if (pub) return pub;
  }
  return '';
}

export class CRDTProvider {
  private doc: Y.Doc;
  private provider: WebsocketProvider | null = null;

  public tracks: Y.Array<Y.Map<any>>;
  public clips: Y.Array<Y.Map<any>>;

  constructor(roomName: string, serverUrl?: string) {
    this.doc = new Y.Doc();

    this.tracks = this.doc.getArray('tracks');
    this.clips = this.doc.getArray('clips');

    const url = serverUrl || getCrdtUrl();
    if (!url) {
      console.warn(
        '[CRDTProvider] No WebSocket URL configured. ' +
        'Set NEXT_PUBLIC_CRDT_URL environment variable to enable collaboration. ' +
        'The app will work without it.'
      );
      return;
    }

    try {
      this.provider = new WebsocketProvider(url, roomName, this.doc);
      this.provider.on('status', (event: { status: string }) => {
        console.log('[CRDTProvider] Status:', event.status);
      });
    } catch (err) {
      console.error('[CRDTProvider] Failed to connect:', err);
    }
  }

  getDoc() {
    return this.doc;
  }

  disconnect() {
    if (this.provider) {
      this.provider.disconnect();
    }
  }
}
