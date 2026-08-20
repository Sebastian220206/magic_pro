import type { Clip } from './Clip';

export type TrackType = 'audio' | 'midi' | 'software-instrument' | 'drummer' | 'external-midi' | 'folder' | 'bus' | 'output' | 'video';

export interface AutomationPoint {
    time: number;
    value: number; // 0 to 100
}

export interface AutomationLane {
    parameter: 'volume' | 'pan' | string;
    points: AutomationPoint[];
}

/** How a plugin's DSP is provided. */
export type PluginFormat =
    /** Built-in Web Audio implementation from `engine/effects/plugins`. */
    | 'builtin'
    /** Third-party Web Audio Module loaded at runtime. */
    | 'wam';

export interface PluginSetting {
    /** Instance id — unique per slot, stable across reorder. */
    id: string;
    /** Which plugin this is an instance of. */
    pluginId: string;
    name: string;
    /** False bypasses the plugin without removing it from the chain. */
    enabled: boolean;
    params: Record<string, number>;

    // --- Optional so existing saved projects load unchanged ---

    /** Defaults to 'builtin'. */
    format?: PluginFormat;
    /** Defaults to 'pre' (before the fader). */
    insertPoint?: 'pre' | 'post';
    /**
     * Latency the plugin introduces, written back by the engine so delay
     * compensation can realign the track. See `engine/audioEngine/latencyCompensation.ts`.
     */
    latencySamples?: number;
    /** Opaque plugin-owned state (WAM `getState()`), persisted verbatim. */
    state?: unknown;
    /** Where a WAM plugin was loaded from. */
    wam?: { url: string; identifier: string; version?: string };
    /**
     * Track whose signal keys this plugin — a compressor's sidechain input,
     * e.g. the sub ducking to the kick.
     */
    sidechainSourceId?: string;
}

export interface TrackAlternative {
    id: string;
    name: string;
}

export interface Track {
    id: string;
    name: string;
    type: TrackType;
    muted: boolean;
    soloed: boolean;
    /**
     * Keeps playing when another track is soloed.
     *
     * A reverb return or a click you always want to hear. Logic marks it with
     * a slash through the S; ours does the same.
     */
    soloSafe?: boolean;
    /**
     * Input format, shown on the strip's Channel Mode button.
     *
     * Decides how many columns the level meter draws: one for a mono or
     * single-side format, two for stereo. Logic puts this immediately above
     * the input slot because it changes what the meter means.
     */
    channelMode?: 'mono' | 'stereo' | 'left' | 'right';
    /**
     * How channel-strip moves are handled during playback.
     *
     * `off` ignores automation entirely; `read` plays it back; the write modes
     * record it. Only the first two change playback today - see the strip's
     * tooltip, which says so rather than implying the rest work.
     */
    automationMode?: 'off' | 'read' | 'touch' | 'latch' | 'write';
    /** VCA fader this track is assigned to, by id. */
    vcaId?: string | null;
    volume: number; // 0 to 1
    pan: number; // -1 to 1
    color: string;
    orderIndex: number;
    recordEnabled: boolean;
    inputMonitoring: boolean;
    protected: boolean;
    frozen: boolean;
    /**
     * Clips hidden by a freeze, so unfreezing can restore exactly what was
     * there. Absent when the track is not frozen.
     */
    frozenSourceClipIds?: string[];
    enabled: boolean; // On/Off
    freezeMode: 'Source Only' | 'Pre Fader';

    // --- Track Alternatives ---
    alternatives: TrackAlternative[];
    activeAlternativeId: string;
    showInactiveAlternatives: boolean;

    // --- Track Instrument (for MIDI/software-instrument tracks) ---
    instrument?: string; // e.g., "Grand Piano", "Deep Bass", "Trap Drum Kit"
    instrumentLoaded?: boolean;
    /**
     * `direct` sends the track straight to the monitor output, bypassing the
     * master chain — how a reference track is auditioned against the mix.
     */
    monitorMode?: 'normal' | 'direct';

    /** Set when the track's instrument is a Web Audio Module, so it can be reloaded. */
    wamInstrument?: { url: string; identifier: string; name: string };
    /**
     * Set when the track's instrument is a SoundFont preset.
     *
     * `instrument` alone only holds the preset's display name, which is not
     * enough to rebuild anything — the engine needs the bank and the preset
     * index. Without this a reload left the track showing "Grand Piano" while
     * playing the fallback synth.
     */
    soundFont?: { id?: string; url: string; presetIndex: number; presetName?: string };

    // --- Track Inspector Parameters (Logic Pro) ---
    icon?: string;
    channel?: string; // e.g. "Inst 1"
    midiInput?: 'All' | string;
    midiInChannel?: 'All' | number;
    midiOutChannel?: 'All' | number;
    keyLimit?: [number, number]; // [min, max] MIDI note
    velocityLimit?: [number, number];
    transpose: number; // in semitones
    velocityOffset: number; // -127 to 127
    delay: number; // in ms
    midiChannel?: number; // 1 to 16 for multi-timbral instruments
    noTranspose?: boolean;
    noReset?: boolean;

    // --- Internal MIDI Routing (Logic Pro Internal MIDI In) ---
    internalMidiInSourceId?: string;
    internalMidiInType?: 'Off' | 'MIDI to Track' | 'Instrument Input' | 'Instrument Output';
    internalMidiInRecordMode?: 'Internal Only' | 'Internal + External';
    midiOutToTrackSlot?: number; // For "MIDI to Track" tap point

    // --- Advanced Signal Chain ---
    plugins: PluginSetting[];
    sends: { busId: string; level: number }[];
    outputBusId: string; // "stereo-out" by default
    channelStripId?: string; // used for multiple tracks sharing the same mixer channel
    defaultRegionType?: 'midi' | 'pattern' | 'session-player';
    zoom: number; // individual vertical zoom factor

    // --- Clips ---
    clips?: Clip[];

    // --- Track Stacks & Automation (Professional Features) ---
    parentId?: string;
    isStack?: boolean;
    isCollapsed?: boolean;
    stackType?: 'Folder' | 'Summing';
    isGrooveTrack?: boolean;
    matchGrooveTrack?: boolean;
    automation?: AutomationLane[];
    hidden: boolean;
    articulationSetId?: string;
    currentArticulationId?: number;
}
