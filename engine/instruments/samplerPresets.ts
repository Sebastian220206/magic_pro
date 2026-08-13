/**
 * Which instrument names have a sample set, and where it lives.
 *
 * The single source of truth for the audio path. `instrumentRegistry` says an
 * instrument exists and what engine it claims; this says whether anything can
 * actually be loaded for it. The two are separate concerns and were separately
 * wrong: `'Grand Piano'` is in the registry with `engine: 'sampler'` and had no
 * entry here, so selecting it fell silently through to the oscillator synth —
 * a piano that sounded like a synth, with nothing logged.
 *
 * The map also used to be duplicated inline in two methods of
 * `AudioEngineAdapter`, which is how it drifted from the registry in the first
 * place.
 */
export const SAMPLER_PRESETS: Readonly<Record<string, string>> = {
    // The piano sample set, under both the registry's name and the older name
    // saved projects still carry.
    'Grand Piano': '/sound_sample/piano/Piano.dspreset',
    'Steinway Piano': '/sound_sample/piano/Piano.dspreset',
    'Nylon Guitar': '/sound_sample/guitar/MG%20Soft%20Nylon%20Guitar%20(Lite).dspreset',
};

/** The sample set for an instrument, or undefined if it has none. */
export function samplerPresetFor(instrument: string | undefined | null): string | undefined {
    return instrument ? SAMPLER_PRESETS[instrument] : undefined;
}

/** Whether an instrument plays from samples rather than the fallback synth. */
export function hasSamplerPreset(instrument: string | undefined | null): boolean {
    return samplerPresetFor(instrument) !== undefined;
}
