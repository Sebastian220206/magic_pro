import {
  createAutomationPoint,
  parseParameterPath,
  clampValue,
} from '@/engine/automation/types';
import {
  findSurroundingPoints,
  getValueAtBeat,
  interpolateAutomation,
} from '@/engine/automation/curves';

describe('Automation Playback Smoke Tests', () => {
  describe('Automation Types', () => {
    test('createAutomationPoint creates point with correct values', () => {
      const point = createAutomationPoint(0, 0.5, 'linear');
      expect(point.beat).toBe(0);
      expect(point.value).toBe(0.5);
      expect(point.curve).toBe('linear');
      expect(point.id).toBeDefined();
    });
  });

  describe('Value Interpolation', () => {
    test('findSurroundingPoints returns correct neighbors', () => {
      const pts = [
        createAutomationPoint(0, 0),
        createAutomationPoint(4, 0.5),
        createAutomationPoint(8, 1.0),
        createAutomationPoint(12, 0.5),
        createAutomationPoint(16, 0),
      ];

      const at2 = findSurroundingPoints(pts, 2);
      expect(at2.prev).toBeDefined();
      expect(at2.next).toBeDefined();
      expect(at2.prev!.beat).toBe(0);
      expect(at2.next!.beat).toBe(4);

      const exactlyAt8 = findSurroundingPoints(pts, 8);
      expect(exactlyAt8.prev!.beat).toBe(8);
      expect(exactlyAt8.next!.beat).toBe(12);
    });

    test('getValueAtBeat returns correct interpolated values', () => {
      const pts = [
        createAutomationPoint(0, 0),
        createAutomationPoint(4, 0.5),
        createAutomationPoint(8, 1.0),
        createAutomationPoint(12, 0.5),
        createAutomationPoint(16, 0),
      ];

      expect(getValueAtBeat(pts, 0)).toBe(0);
      expect(getValueAtBeat(pts, 4)).toBe(0.5);
      expect(getValueAtBeat(pts, 8)).toBe(1.0);
      expect(getValueAtBeat(pts, 2)).toBeCloseTo(0.25, 4);
      expect(getValueAtBeat(pts, 6)).toBeCloseTo(0.75, 4);
    });

    test('getValueAtBeat clamps to first/last value outside range', () => {
      const pts = [
        createAutomationPoint(0, 0),
        createAutomationPoint(16, 1),
      ];

      expect(getValueAtBeat(pts, -1)).toBe(0);
      expect(getValueAtBeat(pts, 20)).toBe(1);
    });

    test('getValueAtBeat returns default for empty points', () => {
      expect(getValueAtBeat([], 0)).toBe(0);
    });

    test('getValueAtBeat returns first/last for single point', () => {
      const pts = [createAutomationPoint(0, 0.7)];
      expect(getValueAtBeat(pts, 50)).toBe(0.7);
    });

    test('interpolateAutomation interpolates between two points', () => {
      const a = createAutomationPoint(0, 0);
      const b = createAutomationPoint(4, 0.5);
      const val = interpolateAutomation(a, b, 2);
      expect(val).toBeCloseTo(0.25, 4);
    });
  });

  describe('playback position mapping', () => {
    test('automation values change smoothly across playback positions', () => {
      const pts = [
        createAutomationPoint(0, 0),
        createAutomationPoint(16, 1),
      ];

      const positions = [0, 4, 8, 12, 16];
      const expected = [0, 0.25, 0.5, 0.75, 1];

      positions.forEach((pos, i) => {
        expect(getValueAtBeat(pts, pos)).toBeCloseTo(expected[i], 4);
      });
    });

    test('values stay within valid range', () => {
      const pts = [
        createAutomationPoint(0, -1),
        createAutomationPoint(8, 1),
      ];

      for (let beat = 0; beat <= 8; beat += 0.5) {
        const val = getValueAtBeat(pts, beat);
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Utility functions', () => {
    test('parseParameterPath parses track parameter', () => {
      const path = parseParameterPath('track.track-1.volume');
      expect(path).toBeDefined();
      if (path) {
        expect(path.target).toBe('track');
        expect(path.parameterId).toBe('volume');
      }
    });

    test('parseParameterPath returns null for invalid path', () => {
      expect(parseParameterPath('invalid')).toBeNull();
    });

    test('clampValue clamps within range', () => {
      expect(clampValue(0.5, 0, 1)).toBe(0.5);
      expect(clampValue(-1, 0, 1)).toBe(0);
      expect(clampValue(2, 0, 1)).toBe(1);
    });
  });
});
