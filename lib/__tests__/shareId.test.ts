import { generateShareId } from '@/lib/shareId';

describe('generateShareId', () => {
  test('returns a 7-character string', () => {
    const id = generateShareId();
    expect(id.length).toBe(7);
  });

  test('contains only alphanumeric characters', () => {
    const id = generateShareId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  test('generates unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateShareId()));
    expect(ids.size).toBe(100);
  });
});
