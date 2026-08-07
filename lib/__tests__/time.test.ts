import { formatTimeAgo } from '@/lib/time';

describe('formatTimeAgo', () => {
  test('returns empty string for null or undefined', () => {
    expect(formatTimeAgo(null)).toBe('');
    expect(formatTimeAgo(undefined)).toBe('');
  });

  test('returns "Just now" for dates less than 1 minute ago', () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe('Just now');
  });

  test('returns minutes for dates less than 1 hour ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('5m ago');
  });

  test('returns hours for dates less than 24 hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('3h ago');
  });

  test('returns days for dates less than 7 days ago', () => {
    const date = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('4d ago');
  });

  test('returns weeks for dates less than 4 weeks ago', () => {
    const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('2w ago');
  });

  test('returns months for dates less than 12 months ago', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('2mo ago');
  });

  test('returns years for dates 12+ months ago', () => {
    const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('1y ago');
  });

  test('accepts ISO date string', () => {
    const date = new Date(Date.now() - 60 * 1000);
    expect(formatTimeAgo(date.toISOString())).toBe('1m ago');
  });
});
