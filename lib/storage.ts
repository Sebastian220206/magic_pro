import { supabase } from './supabase';

export interface StorageAdapter {
  uploadBuffer(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string>;
  uploadFile(bucket: string, path: string, file: File): Promise<string>;
  deleteFile(bucket: string, path: string): Promise<void>;
  getPublicUrl(bucket: string, path: string): string;
  listFiles(bucket: string, prefix: string): Promise<string[]>;
}

async function uploadBuffer(
  bucket: string,
  path: string,
  buffer: Buffer,
  _contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: _contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('[Storage] Upload error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data?.path || path);

  return publicUrl;
}

async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('[Storage] Upload error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data?.path || path);

  return publicUrl;
}

async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('[Storage] Delete error:', error);
    throw error;
  }
}

function getPublicUrl(bucket: string, path: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
  return publicUrl;
}

async function listFiles(bucket: string, prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix);

  if (error) {
    console.error('[Storage] List error:', error);
    return [];
  }

  return data?.map((f: any) => f.name) || [];
}

export const storage: StorageAdapter = {
  uploadBuffer,
  uploadFile,
  deleteFile,
  getPublicUrl,
  listFiles,
};

export const uploadAudio = async (file: File, path: string): Promise<string> => {
  return storage.uploadFile('audio-assets', path, file);
};
