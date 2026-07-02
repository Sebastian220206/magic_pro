import { MasteringChain, PRESETS } from '../masteringChain';

describe('MasteringChain', () => {
  test('creates with default preset (streaming)', () => {
    const chain = new MasteringChain();
    const state = chain.getState();
    expect(state.presetId).toBe('streaming');
    expect(state.presetName).toBe('Mastering for Streaming');
    expect(state.limiter.threshold).toBe(-1);
    expect(state.loudnessTarget).toBe(-14);
  });

  test('loadPreset returns false for unknown preset', () => {
    const chain = new MasteringChain();
    expect(chain.loadPreset('unknown' as any)).toBe(false);
  });

  test('all 6 presets have valid values', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      expect(preset.presetId).toBe(id);
      expect(preset.limiter.threshold).toBeLessThanOrEqual(0);
      expect(preset.limiter.attack).toBeGreaterThan(0);
      expect(preset.limiter.release).toBeGreaterThan(0);
      expect(preset.loudnessTarget).toBeLessThanOrEqual(0);
      expect(preset.stereoWidth).toBeGreaterThan(0);
      expect(preset.eq.lowShelfFreq).toBeGreaterThan(0);
    }
  });

  test('loadPreset switches to vinyl', () => {
    const chain = new MasteringChain();
    chain.loadPreset('vinyl');
    expect(chain.getState().presetId).toBe('vinyl');
    expect(chain.getState().limiter.threshold).toBe(-3);
  });

  test('setLimiter partially updates config', () => {
    const chain = new MasteringChain();
    chain.setLimiter({ threshold: -2 });
    expect(chain.getState().limiter.threshold).toBe(-2);
    expect(chain.getState().limiter.attack).toBe(0.003);
  });

  test('setEQ partially updates config', () => {
    const chain = new MasteringChain();
    chain.setEQ({ lowShelfGain: 2 });
    expect(chain.getState().eq.lowShelfGain).toBe(2);
    expect(chain.getState().eq.lowShelfFreq).toBe(60);
  });

  test('setMultiband partially updates config', () => {
    const chain = new MasteringChain();
    chain.setMultiband({ lowThreshold: -16 });
    expect(chain.getState().multiband.lowThreshold).toBe(-16);
    expect(chain.getState().multiband.midThreshold).toBe(-24);
  });

  test('setStereoWidth clamps to 0-2', () => {
    const chain = new MasteringChain();
    chain.setStereoWidth(3);
    expect(chain.getState().stereoWidth).toBe(2);
    chain.setStereoWidth(-1);
    expect(chain.getState().stereoWidth).toBe(0);
  });

  test('setLoudnessTarget clamps to -30 to 0', () => {
    const chain = new MasteringChain();
    chain.setLoudnessTarget(5);
    expect(chain.getState().loudnessTarget).toBe(0);
    chain.setLoudnessTarget(-40);
    expect(chain.getState().loudnessTarget).toBe(-30);
  });

  test('serialize returns plain object', () => {
    const chain = new MasteringChain();
    const serialized = chain.serialize();
    expect(serialized.presetId).toBe('streaming');
    expect(serialized.limiter).toBeDefined();
    expect(serialized.eq).toBeDefined();
    expect(serialized.multiband).toBeDefined();
  });

  test('deserialize restores state', () => {
    const original = new MasteringChain();
    original.loadPreset('club');
    const data = original.serialize();
    const restored = MasteringChain.deserialize(data);
    expect(restored.getState().presetId).toBe('club');
    expect(restored.getState().limiter.threshold).toBe(-0.5);
  });

  test('getPresets returns list of all presets', () => {
    const chain = new MasteringChain();
    const presets = chain.getPresets();
    expect(presets.length).toBe(6);
    expect(presets.map(p => p.id)).toContain('streaming');
    expect(presets.map(p => p.id)).toContain('vinyl');
    expect(presets.map(p => p.id)).toContain('club');
    expect(presets.map(p => p.id)).toContain('acoustic');
    expect(presets.map(p => p.id)).toContain('broadcast');
    expect(presets.map(p => p.id)).toContain('drums-bass');
  });
});
