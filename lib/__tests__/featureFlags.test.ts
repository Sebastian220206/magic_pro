import { isFeatureEnabled } from '@/lib/featureFlags';

describe('isFeatureEnabled', () => {
  test('returns true for enabled features', () => {
    expect(isFeatureEnabled('audioEngine')).toBe(true);
    expect(isFeatureEnabled('mixer')).toBe(true);
    expect(isFeatureEnabled('saveProject')).toBe(true);
    expect(isFeatureEnabled('editMidi')).toBe(true);
  });

  test('returns false for disabled features', () => {
    expect(isFeatureEnabled('collaboration')).toBe(false);
    expect(isFeatureEnabled('videoTrack')).toBe(false);
    expect(isFeatureEnabled('scoreEditor')).toBe(false);
    expect(isFeatureEnabled('exportMp3')).toBe(false);
  });

  test('distinguishes between cloud and core features', () => {
    expect(isFeatureEnabled('cloudSave')).toBe(true);
    expect(isFeatureEnabled('s3Storage')).toBe(false);
    expect(isFeatureEnabled('stripeSubscriptions')).toBe(false);
    expect(isFeatureEnabled('printToPdf')).toBe(true);
  });
});
