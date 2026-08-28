/**
 * The Audio settings tree, with values.
 *
 * `globalSettings.audio` starts life as `{}`, so every Audio panel read through
 * a chain of `?.` and fell back to a literal typed into the JSX. Two costs: the
 * panels showed blanks where the reference shows real values (the surround
 * grids rendered empty dropdowns), and the same default was written in several
 * places and drifted.
 *
 * One tree, merged over whatever the project holds.
 */

import {
    defaultAssignments, defaultExtensions, type SurroundChannel,
} from './surroundLayout';

export const DEFAULT_SURROUND_FORMAT = '7.1.4';

/** Bytes of RAM a streaming sampler holds open, for the given settings.
 *
 * Modelled rather than measured: a streaming voice keeps a pre-roll buffer in
 * memory, so the cost is `voices × seconds × channels × 4 bytes × rate`. Shown
 * because a figure that moves when the settings move tells the user something;
 * the old panel had "81.0 MB" typed into it, which did not.
 */
export function virtualMemoryBytes(
    bufferRange: string,
    hostDiskActivity: string,
    sampleRate: number,
): number {
    const VOICES = 64;
    const CHANNELS = 2;
    const BYTES_PER_SAMPLE = 4;
    const seconds: Record<string, number> = { Small: 2, Medium: 4, Large: 8 };
    // A busier disk needs a deeper buffer to survive the same seek.
    const activityFactor: Record<string, number> = { Low: 0.75, Average: 1, High: 1.5, Turbo: 2 };
    const preroll = (seconds[bufferRange] ?? 4) * (activityFactor[hostDiskActivity] ?? 1);
    return VOICES * CHANNELS * BYTES_PER_SAMPLE * preroll * (sampleRate || 48000);
}

export function formatMegabytes(bytes: number): string {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function mappingFor(prefix: 'Output' | 'Input'): Partial<Record<SurroundChannel, string>> {
    return defaultAssignments(DEFAULT_SURROUND_FORMAT, prefix, 'Default');
}

/** Everything the Audio panels read, before the project's own values. */
export function audioSettingsDefaults() {
    return {
        coreAudioEnabled: true,
        outputDevice: 'default',
        inputDevice: 'default',
        /*
         * What those devices are called.
         *
         * A `deviceId` is an opaque handle salted per origin, and the salt
         * rotates — replugging an interface is enough. Stored alone it stops
         * resolving, and then `setSinkId` reports "device not found" while
         * `getUserMedia` throws OverconstrainedError. The label survives, so
         * the same hardware can be found again and the fresh id written back.
         */
        outputDeviceLabel: null as string | null,
        inputDeviceLabel: null as string | null,
        ioBufferSize: 256,
        sampleRate: 48000,
        recordingDelay: 0,
        processingThreads: 'Automatic (Recommended)',
        processBufferRange: 'Medium',
        multithreading: 'Playback & Live Tracks',
        summing: 'Standard (32-bit)',

        displayOverloadMessage: true,
        sampleAccurateAutomation: 'All',
        automaticBusAssignment: 'All Busses',
        softwareMonitoring: true,
        inputMonitoringOnlyFocused: false,
        independentMonitoringLevel: false,
        dimLevel: -20,
        pluginLatencyCompensation: 'All',
        playbackPreRoll: true,
        lowLatencyMonitoring: false,
        lowLatencyLimitMs: 5,

        samplerActiveSubTab: 'Misc' as 'Misc' | 'Virtual Memory',
        sampler: {
            sampleStorage: 'Original',
            searchSamplesOn: 'Local Volumes',
            readRootKeyFrom: 'File/Analysis',
            rootKeyFilenamePosition: 'Auto',
            keepCommonSamplesInMemory: true,
            virtualMemory: {
                active: true,
                bufferRange: 'Medium',
                hostDiskActivity: 'Average',
            },
        },

        editing: {
            crossfadeTime: 20,
            crossfadeCurve: 0,
            scrubbingEnabled: false,
            maxScrubSpeed: 'Normal',
            scrubResponse: 'Normal',
        },

        ioAssignments: {
            activeSubTab: 'Output' as 'Output' | 'Bounce Extensions' | 'Input',
            stereoOutput: 'Output 1-2',
            stereoMirroring: false,
            initializeOrder: 'Default' as 'Default' | 'ITU' | 'WG-4',
            outputMapping: mappingFor('Output'),
            inputMapping: mappingFor('Input'),
            bounceExtensions: {
                stereoLeft: '.L',
                stereoRight: '.R',
                mapping: defaultExtensions(DEFAULT_SURROUND_FORMAT),
            },
        },

        fileEditor: {
            warnBeforeProcessing: true,
            // On by default, unlike the reference, because undo here restores a
            // whole-store snapshot: history kept past a close would let an undo
            // pull the closed project's tracks into the empty one that replaced
            // it. Turning it off is a deliberate choice, not the default.
            clearUndoOnClose: true,
            recordSelectionChanges: true,
            recordNormalizeInUndo: false,
            undoSteps: 5,
            externalSampleEditorPath: '',
        },

        mp3: {
            bitRateMono: '128 kbit/s',
            bitRateStereo: '320 kbit/s',
            useVBR: true,
            quality: 'Highest',
            useBestEncoding: true,
            filterBelow10Hz: true,
            stereoMode: 'Joint Stereo',
        },
    };
}

export type AudioSettings = ReturnType<typeof audioSettingsDefaults>;

/**
 * Merge a project's stored Audio settings over the defaults.
 *
 * Deep for the nested groups only — those are the ones a panel writes a single
 * key into, and a shallow spread there would drop every sibling.
 */
export function withAudioDefaults(stored: Record<string, any> | undefined): AudioSettings {
    const defaults = audioSettingsDefaults();
    const audio = stored ?? {};
    return {
        ...defaults,
        ...audio,
        sampler: {
            ...defaults.sampler,
            ...audio.sampler,
            virtualMemory: { ...defaults.sampler.virtualMemory, ...audio.sampler?.virtualMemory },
        },
        editing: { ...defaults.editing, ...audio.editing },
        ioAssignments: {
            ...defaults.ioAssignments,
            ...audio.ioAssignments,
            outputMapping: { ...defaults.ioAssignments.outputMapping, ...audio.ioAssignments?.outputMapping },
            inputMapping: { ...defaults.ioAssignments.inputMapping, ...audio.ioAssignments?.inputMapping },
            bounceExtensions: {
                ...defaults.ioAssignments.bounceExtensions,
                ...audio.ioAssignments?.bounceExtensions,
                mapping: {
                    ...defaults.ioAssignments.bounceExtensions.mapping,
                    ...audio.ioAssignments?.bounceExtensions?.mapping,
                },
            },
        },
        fileEditor: { ...defaults.fileEditor, ...audio.fileEditor },
        mp3: { ...defaults.mp3, ...audio.mp3 },
    };
}
