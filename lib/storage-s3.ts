import type { StorageAdapter } from './storage';

interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function createS3Adapter(config: S3Config): StorageAdapter {
  const endpoint = config.endpoint.replace(/\/+$/, '');

  async function signUrl(method: string, path: string, contentType?: string): Promise<string> {
    const objectPath = path.startsWith('/') ? path.slice(1) : path;
    const url = `${endpoint}/${config.bucket}/${objectPath}`;

    if (method === 'GET') {
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const stringToSign = `GET\n\n\n${expires}\n/${config.bucket}/${objectPath}`;
      const signature = await hmacSha1(stringToSign, config.secretAccessKey);
      return `${url}?AWSAccessKeyId=${config.accessKeyId}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
    }

    return url;
  }

  return {
    async uploadBuffer(bucket: string, path: string, buffer: Buffer, contentType: string) {
      const url = `${endpoint}/${bucket}/${path}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-amz-acl': 'public-read',
        },
        body: new Uint8Array(buffer),
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
      }

      return url;
    },

    async uploadFile(bucket: string, path: string, file: File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      return this.uploadBuffer(bucket, path, buffer, file.type);
    },

    async deleteFile(bucket: string, path: string) {
      const url = `${endpoint}/${bucket}/${path}`;
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`S3 delete failed: ${response.status}`);
      }
    },

    getPublicUrl(bucket: string, path: string) {
      return `${endpoint}/${bucket}/${path}`;
    },

    async listFiles(bucket: string, prefix: string) {
      const url = `${endpoint}/${bucket}?prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const text = await response.text();
      const keys: string[] = [];
      const regex = /<Key>([^<]+)<\/Key>/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        keys.push(match[1]);
      }
      return keys;
    },
  };
}

async function hmacSha1(str: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(str));
  return arrayBufferToBase64(signature);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
