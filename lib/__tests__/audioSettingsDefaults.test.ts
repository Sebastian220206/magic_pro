import {
    audioSettingsDefaults,
    withAudioDefaults,
    virtualMemoryBytes,
    formatMegabytes,
} from '../audioSettingsDefaults';

describe('audio settings defaults', () => {
    it('gives an empty project a complete tree', () => {
        // `globalSettings.audio` is `{}` on every project, which is what left
        // the surround grids rendering empty dropdowns.
        const audio = withAudioDefaults(undefined);
        expect(audio.ioAssignments.outputMapping.left).toBe('Output 1');
        expect(audio.ioAssignments.inputMapping.left).toBe('Input 1');
        expect(audio.ioAssignments.bounceExtensions.mapping.lfe).toBe('.LFE');
        expect(audio.mp3.bitRateStereo).toBe('320 kbit/s');
        expect(audio.fileEditor.undoSteps).toBe(5);
        // Clearing on close is the existing behaviour; keeping history is the
        // opt-in, because undo restores a whole-store snapshot.
        expect(audio.fileEditor.clearUndoOnClose).toBe(true);
        expect(audio.sampler.virtualMemory.bufferRange).toBe('Medium');
    });

    it('keeps a stored value and its untouched siblings', () => {
        const audio = withAudioDefaults({ mp3: { bitRateStereo: '128 kbit/s' } });
        expect(audio.mp3.bitRateStereo).toBe('128 kbit/s');
        expect(audio.mp3.stereoMode).toBe('Joint Stereo');
    });

    it('merges the nested groups deeply enough to survive one-key writes', () => {
        // A panel writes a single channel; the rest of the mapping must remain.
        const audio = withAudioDefaults({
            ioAssignments: { outputMapping: { left: 'Output 7' } },
        });
        expect(audio.ioAssignments.outputMapping.left).toBe('Output 7');
        expect(audio.ioAssignments.outputMapping.right).toBe('Output 2');
        expect(audio.ioAssignments.stereoOutput).toBe('Output 1-2');
    });

    it('merges the sampler two levels down', () => {
        const audio = withAudioDefaults({
            sampler: { virtualMemory: { bufferRange: 'Large' } },
        });
        expect(audio.sampler.virtualMemory.bufferRange).toBe('Large');
        expect(audio.sampler.virtualMemory.hostDiskActivity).toBe('Average');
        expect(audio.sampler.sampleStorage).toBe('Original');
    });

    it('does not share mutable state between calls', () => {
        const first = audioSettingsDefaults();
        first.ioAssignments.outputMapping.left = 'Output 99';
        expect(audioSettingsDefaults().ioAssignments.outputMapping.left).toBe('Output 1');
    });

    it('the RAM figure moves with the settings it is shown under', () => {
        const medium = virtualMemoryBytes('Medium', 'Average', 48000);
        expect(virtualMemoryBytes('Large', 'Average', 48000)).toBe(medium * 2);
        expect(virtualMemoryBytes('Small', 'Average', 48000)).toBe(medium / 2);
        expect(virtualMemoryBytes('Medium', 'Turbo', 48000)).toBe(medium * 2);
        expect(virtualMemoryBytes('Medium', 'Average', 96000)).toBe(medium * 2);
    });

    it('falls back rather than reporting NaN MB for an unknown setting', () => {
        expect(Number.isFinite(virtualMemoryBytes('Enormous', 'Frantic', 48000))).toBe(true);
        expect(formatMegabytes(virtualMemoryBytes('Medium', 'Average', 48000))).toMatch(/^\d+\.\d MB$/);
    });
});
