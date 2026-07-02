import { LoudnessMeter } from '../loudnessMeter';

(globalThis as any).requestAnimationFrame = () => 0;
(globalThis as any).cancelAnimationFrame = () => {};

function createMockAudioContext(): any {
  return {
    sampleRate: 48000,
    createAnalyser: () => ({
      fftSize: 2048,
      smoothingTimeConstant: 0,
      frequencyBinCount: 1024,
      getFloatTimeDomainData: (arr: Float32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = 0;
      },
      connect: jest.fn(),
      disconnect: jest.fn(),
    }),
    createGain: () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      gain: { value: 1 },
    }),
  };
}

function createMockSourceNode(): any {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

describe('LoudnessMeter', () => {
  test('creates with default options', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    const opts = meter.getOptions();
    expect(opts.updateInterval).toBe(100);
    expect(opts.peakHoldDuration).toBe(3000);
    expect(opts.clipThreshold).toBe(-1);
    meter.dispose();
  });

  test('initial data is all -Infinity and 0', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    const data = meter.getCurrentData();
    expect(data.momentary).toBe(-Infinity);
    expect(data.shortTerm).toBe(-Infinity);
    expect(data.integrated).toBe(-Infinity);
    expect(data.truePeakLeft).toBe(-Infinity);
    expect(data.truePeakRight).toBe(-Infinity);
    expect(data.loudnessRange).toBe(0);
    expect(data.peakHoldLeft).toBe(-Infinity);
    meter.dispose();
  });

  test('truePeakLeft and truePeakRight accessible', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    expect(meter.getTruePeakLeft()).toBe(-Infinity);
    expect(meter.getTruePeakRight()).toBe(-Infinity);
    meter.dispose();
  });

  test('start and stop do not throw', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    const callback = jest.fn();
    expect(() => meter.start(callback)).not.toThrow();
    expect(() => meter.stop()).not.toThrow();
    meter.dispose();
  });

  test('resetIntegrated clears block buffer', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    expect(() => meter.resetIntegrated()).not.toThrow();
    expect(meter.getIntegrated()).toBe(-Infinity);
    meter.dispose();
  });

  test('resetPeakHold clears peak holds', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    expect(() => meter.resetPeakHold()).not.toThrow();
    expect(meter.getCurrentData().peakHoldLeft).toBe(-Infinity);
    meter.dispose();
  });

  test('setUpdateInterval changes interval', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    meter.setUpdateInterval(200);
    expect(meter.getOptions().updateInterval).toBe(200);
    meter.dispose();
  });

  test('multiple dispose safe', () => {
    const ctx = createMockAudioContext();
    const source = createMockSourceNode();
    const meter = new LoudnessMeter(ctx, source);
    expect(() => {
      meter.dispose();
      meter.dispose();
    }).not.toThrow();
  });
});
