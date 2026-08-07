import { randomBytes } from 'crypto';

export function generateShareId(): string {
  return randomBytes(10)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 7)
    .toLowerCase();
}
