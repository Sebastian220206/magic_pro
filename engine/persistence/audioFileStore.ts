import { getIndexedDBAdapter, type AssetMetadata } from '@/engine/filesystem/indexedDBAdapter';

export interface AudioFileRecord {
  id: string;
  storageKey: string;
  originalName: string;
  fileHash?: string;
  size: number;
  sampleRate?: number;
  duration?: number;
  channels?: number;
}

const STORAGE_KEY_PREFIX = 'audio-';

export async function storeAudioFile(
  file: File | Blob,
  originalName: string,
  storageKey?: string
): Promise<AudioFileRecord> {
  const adapter = getIndexedDBAdapter();
  await adapter.initialize();

  const key = storageKey || `${STORAGE_KEY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const arrayBuffer = await file.arrayBuffer();

  const metadata: AssetMetadata = {
    id: key,
    type: 'audio',
    name: originalName,
    hash: '',
    size: arrayBuffer.byteLength,
    duration: 0,
    sampleRate: 0,
    channels: 0,
    createdAt: Date.now(),
    usedBy: [],
  };

  await adapter.saveAsset(key, arrayBuffer, metadata);

  return {
    id: key,
    storageKey: key,
    originalName,
    size: arrayBuffer.byteLength,
  };
}

export async function loadAudioBuffer(storageKey: string): Promise<ArrayBuffer | null> {
  const adapter = getIndexedDBAdapter();
  await adapter.initialize();

  const asset = await adapter.loadAsset(storageKey);
  if (!asset) return null;
  return asset.buffer;
}

export async function deleteAudioFile(storageKey: string): Promise<void> {
  const adapter = getIndexedDBAdapter();
  await adapter.initialize();
  await adapter.deleteAsset(storageKey);
}

export async function listAudioFiles(): Promise<AudioFileRecord[]> {
  const adapter = getIndexedDBAdapter();
  await adapter.initialize();

  const assets = await adapter.listAssets();
  return assets
    .filter(a => a.type === 'audio')
    .map(a => ({
      id: a.id,
      storageKey: a.id,
      originalName: a.name,
      size: a.size,
      sampleRate: (a as any).sampleRate,
      duration: (a as any).duration,
      channels: (a as any).channels,
    }));
}
