import { create } from 'zustand';
import { audioEngine } from '@/engine/AudioEngineAdapter';
import { Track, TrackAlternative, PluginSetting } from '@/models/Track';
import { Clip, Note, ClipType } from '@/models/Clip';
import { recordedClipType } from '@/lib/trackKinds';
import { TimelineAnnotation } from '@/models/Annotation';
import { ArticulationSet, Articulation } from '@/models/Articulation';
import { libraryData, Preset } from '@/lib/libraryData';
import { serializeStoreState, deserializeState, saveToIndexedDB, loadFromIndexedDB, CURRENT_SCHEMA_VERSION } from '@/engine/persistence/projectPersistence';
import { rebuildEngine } from '@/engine/persistence/engineRebuilder';
import { storeAudioFile } from '@/engine/persistence/audioFileStore';
import { extractPeaksAsync } from '@/engine/waveform';
import { bufferCacheManager } from '@/engine/audioEngine/bufferCache';
import { getAudioContext } from '@/engine/audioEngine/audioContext';
import { renderTrackOffline, freezeBufferId, freezeClipId } from '@/engine/audioEngine/trackRender';
import { routingEngine } from '@/engine/audioEngine/routingEngine';
import { exportProjectAudio, downloadExport } from '@/engine/export/projectExport';
import { exportStems as renderStems } from '@/engine/export/stemExport';
import type { StemExportSettings, Stem } from '@/engine/export/stemExport';
import { analyseLoudness as measureLoudness, gainToMatchRms as rmsGain } from '@/engine/metering/offlineLoudness';
import type { LoudnessAnalysis } from '@/engine/metering/offlineLoudness';
import { tuneVocal, cleanVocal, alignmentOffset, SCALES } from '@/engine/audio/vocalEditing';
import type { ProjectExportSettings, ProjectExportResult } from '@/engine/export/projectExport';
import { initializeInstruments } from '@/engine/instruments/instrumentBootstrap';
import { BUILTIN_PLUGIN_IDS, BUILTIN_PLUGIN_NAMES, resolvePluginId } from '@/engine/plugins/pluginIds';
import { getGridSize } from '@/engine/midi/quantization';
import type { GridDivision } from '@/engine/midi/types';
import { NEON_TRACK_PALETTE } from '@/lib/trackColor'
import { MuteSoloGroupManager, type MuteSoloGroup } from '@/engine/mixer/muteSoloGroups'

interface GlobalTrackPoint {
    time: number; // beats
    value: number | string;
    type?: 'jump' | 'ramp';
}

interface BeatMappingEntry {
    id: string;
    clipId: string;
    noteId?: string;
    sourceTime: number; // source absolute beat time in the clip
    targetTime: number; // mapped beat position on ruler
}

interface EnvironmentLayer {
    id: string;
    name: string;
    protected: boolean;
    isGlobal: boolean;
}

interface EnvironmentObject {
    id: string;
    name: string;
    type: 'PhysicalInput' | 'SequencerInput' | 'Instrument' | 'MappedInstrument' | 'Fader' | 'Keyboard' | 'Monitor' | 'Macro' | 'Other';
    layerId: string;
    icon?: string;
    assignable: boolean;
    position: { x: number; y: number };
    size: { width: number; height: number };
    parameters: Record<string, any>;
    connections: string[]; // output connections to other object IDs
}

interface GlobalTracks {
    tempo: GlobalTrackPoint[];
    markers: { id: string; time: number; duration: number; text: string; color: string }[];
    signature: { time: number; numerator: number; denominator: number }[];
    key: { time: number; root: string; mode: 'major' | 'minor' }[];
    beatMapping: BeatMappingEntry[];
}

interface ProjectAlternative {
    id: string;
    name: string;
    createdAt: number;
    tracks: Track[];
    clips: Clip[];
}

interface ProjectSettings {
    sampleRate: 44100 | 48000 | 88200 | 96000 | 176400 | 192000;
    /** Bit depth for bounces and delivery. */
    bitDepth: 16 | 24 | 32;
    frameRate: number;
    metronome: {
        simpleMode: boolean;
        clickWhilePlaying: boolean;
        clickWhileRecording: boolean;
        onlyDuringCountIn: boolean;
        polyphonicClick: boolean;
        accentLevel: number;
        clickLevel: number;
    };
    assets: {
        copyAudioFiles: boolean;
        copySamplerFiles: boolean;
        copyMovieFiles: boolean;
    };
    projectStart: number; // in beats
    projectEnd: number;   // in beats
    autoProjectEnd: boolean;
    masterVolume: number; // 0.0 to 1.0 (or dB based)
    masterPan: number;
    masterMuted: boolean;
    midi: {
        chase: {
            notes: boolean;
            sustained: boolean;
            inNoTransposeInstruments: boolean;
            programChange: boolean;
            pitchBend: boolean;
            controlChanges: {
                cc0_15: boolean;
                cc64_71: boolean;
                allOther: boolean;
            };
            aftertouch: boolean;
            polyAftertouch: boolean;
            sysEx: boolean;
            textMeta: boolean;
            separateChannels: boolean;
            chaseOnCycleJump: boolean;
            chaseOnCycleNotes: boolean;
            sendReset: boolean;
        }
    }
}

export interface ControlBarSettings {
    showViews: boolean;
    showTransport: boolean;
    showDisplay: boolean;
    showModes: boolean;
    viewButtons: {
        library: boolean; inspector: boolean; quickHelp: boolean; toolbar: boolean;
        smartControls: boolean; mixer: boolean; editors: boolean; listEditors: boolean;
        notePad: boolean; appleLoops: boolean; browsers: boolean;
        musicalTyping: boolean;
    };
    transportButtons: {
        goBeginning: boolean; goPosition: boolean; goLeftLocator: boolean; goRightLocator: boolean; goSelectionStart: boolean;
        playBeginning: boolean; playLeftEdge: boolean; playLeftLocator: boolean; playRightLocator: boolean; playSelection: boolean;
        rewind: boolean; forward: boolean; stop: boolean; play: boolean; pause: boolean; record: boolean;
        freeTempo: boolean; flashback: boolean; skipCycle: boolean; cycle: boolean;
    };
    displayMode: 'Beats & Project' | 'Beats & Time' | 'Beats' | 'Time' | 'Custom';
    displayOptions: {
        position: boolean; locators: boolean; sampleRate: boolean; varispeed: boolean;
        tempo: boolean; timeSignature: boolean; keySignature: boolean; midiActivity: boolean; performanceMeter: boolean;
    };
    modes: {
        sync: boolean; replace: boolean; autopunch: boolean; setPunchByPlayhead: boolean;
        softwareMonitoring: boolean; autoInputMonitoring: boolean; preFaderMetering: boolean;
        lowLatency: boolean; tuner: boolean; solo: boolean; countIn: boolean; metronome: boolean;
        masterOutput: 'Volume' | 'Meter' | 'None';
    };
    floatingWindows: {
        giantBeats: boolean;
        giantTime: boolean;
    };
    smpteViewOffset: boolean;
    displayTimeAs: 'With Bits' | 'Without Bits' | 'With Quarter Frames' | 'Feet Frames 35' | 'Feet Frames 16' | 'With Milliseconds' | 'With Samples' | 'With Frames and Samples';
    zerosAsSpaces: boolean;
    displayTempoAs: 'BPM' | 'BPM No Decimal' | 'FPC Eighths' | 'FPC Decimals';
    clockFormat: '1 1 1 1' | '1 1 1 1.00';
}

interface GlobalKeyCommand {
    id: string;
    name: string;
    description: string;
    category?: 'Transport' | 'Editing' | 'Navigation' | 'MIDI' | 'View' | 'Recording' | 'Project' | 'Window' | 'Other';
    shortcut: string;
    defaultShortcut: string;
    isCustom: boolean;
}

export interface ControlSurfaceDevice {
    id: string;
    name: string;
    type: 'MIDI' | 'OSC' | 'Generic';
    inputId?: string;
    outputId?: string;
    enabled: boolean;
}

export interface ControlSurfaceAssignment {
    id: string;
    deviceId?: string;
    status: number; // MIDI status byte (e.g., 0x90 note on, 0x80 note off, 0xB0 cc)
    channel: number; // MIDI channel 0-15
    data1: number; // note number or CC number
    data2?: number; // optional value (for fixed matches) or ignore for wildcard
    mode: 'toggle' | 'direct' | 'relative';
    commandId: string;
}

interface GlobalSettings {
    startupAction: 'doNothing' | 'openMostRecent' | 'openExisting' | 'selectTemplate' | 'createNewEmpty' | 'createUsingDefaultTemplate' | 'ask';
    defaultTemplateId: string | null;
    openProjectBehavior: 'closeCurrent' | 'keepOpen' | 'ask';
    saveUndoHistoryWithProject: boolean;
    autoBackupCount: number;
    recentItemsLimit: number;
    includeInstrumentSettingsInReset: boolean;
    audio: Record<string, any>;
    recording: Record<string, any>;
    midi: Record<string, any>;
    score: Record<string, any>;
    movie: Record<string, any>;
    automation: Record<string, any>;
    general: Record<string, any>;
    view: Record<string, any>;
    advanced: Record<string, any>;
    myInfo: Record<string, any>;
    controlSurfaces: {
        bypassWhileInBackground: boolean;
        resolutionOfRelativeControls: number;
        maxMidiBandwidth: number;
        touchingFaderSelectsTrack: boolean;
        followTrackSelection: boolean;
        openPluginWindowOnSelection: boolean;
        jogResolutionDependsOnZoom: boolean;
        pickupMode: boolean;
        flashMuteSoloButtons: boolean;
        multipleControlsPerParameter: number;
        longerLabelsOnlyIfFit: boolean;
        showValueUnitsForInstrument: boolean;
        showValueUnitsForVolume: boolean;
        helpTags: {
            parameterName: boolean;
            parameterValue: boolean;
            displayDuration: number;
            showInfoMultiple: boolean;
            showInfoTrackSelection: boolean;
            showInfoVolume: boolean;
        };
        usbMidiControllers: any[];
        devices: ControlSurfaceDevice[];
        assignments: ControlSurfaceAssignment[];
        bypassed: boolean;
    };
    keyCommands: GlobalKeyCommand[];
    useProjectSettings: boolean; // if false, global settings are enforced and project settings are read-only
}

export interface MarqueeSelection {
    id: string;
    startBeat: number;
    endBeat: number;
    trackIds: string[];
    clipIds: string[];
    laneIds: string[];
}

interface ProjectState {
    id: string | null;
    name: string;
    schemaVersion: number;
    tempo: number;
    timeSignature: string;
    keySignature: string;
    playing: boolean;
    playhead: number;
    /**
     * Mute/solo groups.
     *
     * The store owns the list so it serializes with the project; the manager in
     * `engine/mixer/muteSoloGroups` supplies the logic. Keeping the groups in a
     * long-lived manager instance instead would put them outside the saved
     * project and outside undo.
     */
    muteSoloGroups: MuteSoloGroup[];
    /**
     * VCA faders.
     *
     * A VCA scales its member tracks without moving their own faders, so the
     * stored per-track volume stays the number the user set. `trackIds` is a
     * plain array rather than the manager's `Map` of offsets because the store
     * is serialized to JSON, and a Map silently persists as `{}`.
     */
    vcaFaders: { id: string; name: string; gain: number; color: string; trackIds: string[] }[];
    tracks: Track[];
    clips: Clip[];
    annotations: TimelineAnnotation[];
    alternatives: ProjectAlternative[];
    currentAlternativeId: string | null;
    globalTracks: GlobalTracks;
    settings: ProjectSettings;
    globalSettings: GlobalSettings;
    projectKeyCommands: GlobalKeyCommand[];
    environment: {
        layers: EnvironmentLayer[];
        objects: EnvironmentObject[];
        selectedLayerId: string;
        showGlobalObjects: boolean;
    };
    zoom: number;
    trackHeight: number;
    snap: 'bar' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
    controlBarSettings: ControlBarSettings;
    isDirty: boolean;
    loadError: string | null;
    history: Partial<ProjectState>[];
    future: Partial<ProjectState>[];

    showAutomation: boolean;
    showLibrary: boolean;
    showInspector: boolean;
    showToolbar: boolean;
    showSmartControls: boolean;
    showMixer: boolean;
    showEditors: boolean;
    showListEditors: boolean;
    showNotePad: boolean;
    showLoopBrowser: boolean;
    showBrowsers: boolean;
    showLiveLoopsGrid: boolean;
    showTracksArea: boolean;
    showGlobalTracks: boolean;
    beatMappingMode: boolean;
    metronomeEnabled: boolean;
    countInEnabled: boolean;
    countInBars: number;
    hideViewActive: boolean;
    selectedTrackIds: string[];
    focusedTrackId: string | null;
    selectedClipId: string | null;
    selectedClipIds: string[];
    regionClipboard: Clip[];
    selectedNoteId: string | null;
    projectFormat: 'stereo' | 'surround' | 'dolby-atmos';
    surroundFormat: 'Quadraphonic' | 'LCR (Pro Logic)' | '5.1 (ITU 775)' | '6.1 (ES/EX)' | '7.1' | '7.1 (SDDS)' | '5.1.2' | '5.1.4' | '7.1.2' | '7.1.4';
    spatialAudioMode: 'Off' | 'Dolby Atmos';
    bottomPanel: 'mixer' | 'pianoroll' | 'smartcontrols';
    bottomPanelHeight: number;
    pianoRollLinkMode: 'single' | 'selected' | 'folder' | 'project';
    pianoRollFocusClipId: string | null;

    // --- Automation Selection ---
    selectedAutomationPointId: string | null;
    selectedAutomationPointIds: string[];

    // --- Selection-Based Processing ---
    showSelectionBasedProcessing: boolean;
    marqueeSelection: MarqueeSelection | null;
    sbpState: {
        setA: PluginSetting[];
        setB: PluginSetting[];
        activeSet: 'A' | 'B';
        splitAtMarqueeBorders: boolean;
        createNewTake: boolean;
        addEffectTail: boolean;
        gainMode: 'No Change' | 'Loudness Compensation' | 'Overload Protection' | 'Normalize';
        previewVolume: number;
        previewEnablesSolo: boolean;
        previewEnablesCycle: boolean;
    };

    cycleEnabled: boolean;
    skipCycleEnabled: boolean;
    locatorLeft: number;
    locatorRight: number;
    autoSetLocators: 'off' | 'marquee' | 'region' | 'note' | 'marker';
    showToolsMenu: boolean;
    showNewTrackDialog: boolean;
    showCreateTrackUsing: boolean;
    showColorPalette: boolean;
    showIconBrowser: string | null; // trackId
    showDrumReplacement: boolean;
    drumReplacementTargetId: string | null;

    // --- Recording State ---
    recording: boolean;
    autopunchEnabled: boolean;
    autopunchStart: number;
    autopunchEnd: number;
    replaceMode: boolean;
    replaceModeType: 'Region Erase' | 'Region Punch' | 'Content Erase' | 'Content Punch';
    recordingOverlappingMode: 'Create Take Folder' | 'Merge' | 'Merge Current Recording Only' | 'Create Tracks' | 'Create Tracks and Mute';
    autoInputMonitoring: boolean;
    allowQuickPunchIn: boolean;
    recordingStartTime: number | null;
    liveRecordingClips: { [trackId: string]: string }; // trackId -> clipId

    flashback: boolean;
    flashbackBuffer: { trackId: string; pitch: number; velocity: number; time: number; duration: number; noteId: string }[];
    flashbackDuration: number;

    showBounceTrackDialog: string | null;
    showBounceRegionsDialog: string[] | null;
    showBounceAllTracksDialog: boolean;
    showExportDialog: 'track' | 'all' | 'regions' | null;
    showSettingsDialog: boolean;
    settingsActiveTab: string;
    settingsActiveSubTab: string;
    showShareDialog: boolean;
    showVirtualKeyboard: boolean;
    virtualKeyboardMode: 'musical-typing' | 'piano-keyboard';
    virtualKeyboardOctave: number; // Center C octave, e.g. 3 for C3
    virtualKeyboardVelocity: number;
    virtualKeyboardPitchBend: number;
    virtualKeyboardModulation: number;
    virtualKeyboardSustain: boolean;
    showTrackHeaderConfig: boolean;
    trackHeaderWidth: number;
    openPluginEditor: { trackId: string; pluginId: string } | null;
    hoveredHelpId: string | null;
    trackHeaderConfig: {
        showMute: boolean;
        showSolo: boolean;
        showRecord: boolean;
        showInput: boolean;
        showProtect: boolean;
        showFreeze: boolean;
        showOnOff: boolean;
        showVolume: boolean;
        showPan: boolean;
        showTrackNumbers: boolean;
        showColorBars: boolean;
        showTrackIcons: boolean;
        showAlternatives: boolean;
        showHide: boolean;
    };
    
    // --- Note Repeat & Spot Erase ---
    showNoteRepeatDialog: boolean;
    showSpotEraseDialog: boolean;
    noteRepeatSettings: {
        enabled: boolean;
        rate: string; // "1/16"
        velocity: 'As played' | number;
        gate: number; // percentage 0-100
        keyRemote: boolean;
        onOffButton: boolean; // if true, only active when remote key held
    };
    spotEraseSettings: {
        enabled: boolean;
        onOffButton: boolean;
    };

    // --- Step Input ---
    showStepInputKeyboard: boolean;
    stepInputSettings: {
        length: string; // "1/16"
        velocity: 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff';
        triplet: boolean;
        dot: boolean;
        sustain: boolean;
        chord: boolean;
        quantize: boolean;
    };

    // Channel Strip Presets, Copy/Paste, and Performance map
    channelStripSettings: {
        id: string;
        name: string;
        type: 'instrument' | 'audio' | 'output' | 'aux';
        settings: {
            plugins: PluginSetting[];
            sends: { busId: string; level: number }[];
            outputBusId: string;
            volume: number;
            pan: number;
        };
    }[];
    channelStripCopyBuffer: {
        plugins: PluginSetting[];
        sends: { busId: string; level: number }[];
        outputBusId: string;
        volume: number;
        pan: number;
    } | null;
    channelStripPerformances: {
        id: string;
        name: string;
        program: number;
        trackId: string;
        settings: {
            plugins: PluginSetting[];
            sends: { busId: string; level: number }[];
            outputBusId: string;
            volume: number;
            pan: number;
        };
    }[];

    draggedItems: any[] | null;
    dragPosition: { x: number, y: number } | null;
    dropTargetTrackId: string | null;
    newTrackDefaults: {
        mainCategory: 'MIDI' | 'Pattern' | 'Session Player' | 'Audio';
        subOption: string;
    };

    // Library State
    librarySearchQuery: string;
    libraryPatchMerging: boolean;
    libraryMergingOptions: {
        midiEffects: boolean;
        instruments: boolean;
        audioEffects: boolean;
        sends: boolean;
    };
    librarySelectedPresetId: string | null;

    // Articulation State
    articulationSets: ArticulationSet[];
    showArticulationEditor: boolean;
    editingArticulationSetId: string | null;

    recentProjects: { id: string; name: string; lastOpened: number; previewColor: string; tempo: number }[];
    demoProjects: { id: string; name: string; description: string; previewColor: string }[];

    // Actions
    play: () => void;
    stop: () => void;
    setTempo: (bpm: number) => void;
    /** e.g. "4/4", "3/4", "6/8". */
    setTimeSignature: (signature: string) => void;
    /** e.g. "C major", "A minor". */
    setKeySignature: (key: string) => void;
    movePlayhead: (position: number) => void;
    addAlternative: (name: string) => void;
    switchToAlternative: (id: string) => void;
    createTrackStack: (trackIds: string[], type: 'Folder' | 'Summing') => void;
    flattenStack: (stackId: string) => void;
    addMarker: (time: number, text: string, duration?: number) => void;
    updateTempoPoint: (index: number, updates: Partial<GlobalTrackPoint>) => void;
    updateControlBar: (updates: Partial<ControlBarSettings>) => void;
    toggleFloatingWindow: (type: 'giantBeats' | 'giantTime') => void;
    toggleNewTrackDialog: (show?: boolean) => void;
    setNewTrackDefaults: (updates: Partial<ProjectState['newTrackDefaults']>) => void;
    toggleCreateTrackUsing: (show: boolean, items?: any[]) => void;
    createTrackFromSamplerType: (type: 'Quick Sampler (Original)' | 'Quick Sampler (Optimized)' | 'Drum Machine Designer' | 'Sample Alchemy' | 'Sampler (Zone Per Note)', items: any[]) => void;
    // Ownership is derived from the server session; the client cannot choose it.
    audioToMidiTrack: (clipId: string) => Promise<void>;
    createVcaFader: (name: string, trackIds?: string[]) => void;
    deleteVcaFader: (vcaId: string) => void;
    setVcaFaderTracks: (vcaId: string, trackIds: string[]) => void;
    setVcaFaderGain: (vcaId: string, gainDb: number) => void;
    applyVcaGains: (trackIds?: string[]) => void;
    createMuteSoloGroup: (name: string, trackIds?: string[]) => void;
    deleteMuteSoloGroup: (groupId: string) => void;
    setMuteSoloGroupTracks: (groupId: string, trackIds: string[]) => void;
    toggleMuteSoloGroupMute: (groupId: string) => void;
    toggleMuteSoloGroupSolo: (groupId: string) => void;
    saveProject: () => Promise<void>;
    saveAs: (data: any) => Promise<void>;
    saveCopyAs: (data: any) => Promise<void>;
    saveAsTemplate: (name: string) => Promise<void>;
    revertTo: (version?: string) => void;
    loadProject: (projectId: string) => Promise<void>;
    closeProject: () => void;
    setDirty: (dirty: boolean) => void;
    saveHistorySnapshot: () => void;
    undo: () => void;
    redo: () => void;
    importLegacyProject: (legacyData: any) => void;

    // --- Recording Actions ---
    toggleRecording: () => void;
    startRecording: () => void;
    stopRecording: () => void;
    recordRepeat: () => void;
    discardAndReturn: () => void;
    toggleAutopunch: (enabled?: boolean) => void;
    setAutopunchLocators: (start: number, end: number) => void;
    toggleReplaceMode: (enabled?: boolean) => void;
    setReplaceModeType: (type: ProjectState['replaceModeType']) => void;
    setRecordingOverlappingMode: (mode: ProjectState['recordingOverlappingMode']) => void;
    toggleFlashback: (enabled?: boolean) => void;
    flashbackCapture: () => void;
    markTakeAsGood: (clipId: string) => void;
    setTakeColor: (clipId: string, color: string) => void;

    saveTakeFolderComp: (clipId: string, name?: string) => void;
    /** Fold several recorded takes into one take-folder region. */
    createTakeFolder: (trackId: string, clipIds: string[], name?: string) => string | null;
    createTakeFolderComp: (clipId: string, name?: string) => void;
    selectTakeFolderComp: (clipId: string, compId: string) => void;
    renameTakeFolderComp: (clipId: string, compId: string, name: string) => void;
    deleteTakeFolderComp: (clipId: string, compId: string) => void;

    // Channel strip settings actions
    loadChannelStripSetting: (trackId: string, settingId: string) => void;
    chooseNextChannelStripSetting: (trackId: string) => void;
    choosePreviousChannelStripSetting: (trackId: string) => void;
    copyChannelStripSetting: (trackId: string) => void;
    pasteChannelStripSetting: (trackId: string) => void;
    pasteChannelStripPluginsOnly: (trackId: string) => void;
    pasteChannelStripSendsOnly: (trackId: string) => void;
    removeAllChannelStripPlugins: (trackId: string) => void;
    removeEmptyInsertSlots: (trackId: string) => void;
    removeBypassedPlugins: (trackId: string) => void;
    removeAllChannelStripSends: (trackId: string) => void;
    resetChannelStrip: (trackId: string) => void;
    saveChannelStripSetting: (trackId: string, name: string) => void;
    deleteChannelStripSetting: (settingId: string) => void;
    saveChannelStripPerformance: (trackId: string, name: string, program: number) => void;
    loadChannelStripPerformance: (trackId: string, program: number) => void;

    toggleRecordEnable: (trackId: string) => void;
    toggleInputMonitoring: (trackId: string) => void;
    setAutoInputMonitoring: (enabled: boolean) => void;
    setAllowQuickPunchIn: (enabled: boolean) => void;
    setDragPosition: (pos: { x: number, y: number } | null) => void;
    setDropTargetTrackId: (id: string | null) => void;
    duplicateWithSharedChannelStrip: (trackId: string) => void;
    addTrack: (track: Partial<Track>) => void;
    /** Add several tracks in a single state update. */
    addTracks: (tracks: Partial<Track>[]) => void;
    updateTrack: (id: string, updates: Partial<Track>) => void;
    deleteTrack: (id: string) => void;
    /** Insert a plugin on a track. Accepts any registered plugin id. */
    addPlugin: (trackId: string, pluginType: string) => void;
    /** Inserts across the summed mix — bus compression, limiting. */
    masterPlugins: PluginSetting[];
    addMasterPlugin: (pluginType: string) => void;
    removeMasterPlugin: (pluginId: string) => void;
    toggleMasterPlugin: (pluginId: string) => void;
    updateMasterPluginParams: (pluginId: string, params: Record<string, number>) => void;
    /** Create or update a track's send to a bus. Level 0-1. */
    setTrackSend: (trackId: string, busId: string, level: number) => void;
    /** Route a track's main output into a bus (or 'stereo-out'). */
    routeTrackTo: (trackId: string, busId: string) => void;
    /** Playback offset in ms, for nudging a layer behind its partner. */
    setTrackDelay: (trackId: string, ms: number) => void;
    /** `direct` bypasses the master chain — used for reference tracks. */
    setTrackMonitorMode: (trackId: string, mode: 'normal' | 'direct') => void;
    /** Key a plugin (a compressor) from another track's signal. */
    setSidechainSource: (trackId: string, pluginId: string, sourceTrackId: string) => void;
    clearSidechainSource: (trackId: string, pluginId: string) => void;
    /** Repeat a region to fill [startBeat, endBeat). Returns the new clip ids. */
    duplicateClipAcross: (clipId: string, startBeat: number, endBeat: number) => string[];
    /** Interpolated value of an automation lane at a point in time. */
    automationValueAt: (trackId: string, parameter: string, time: number) => number | undefined;
    /** Monitor path: 'stereo' normally, 'mono' for a phase check. */
    monitorMode: 'stereo' | 'mono';
    setMonitorMode: (mode: 'stereo' | 'mono') => void;
    /** Current peak level of a track or bus, in dBFS. */
    getBusPeakDb: (trackId: string) => number;
    /** Offline loudness analysis of rendered channel data. */
    analyseLoudness: (channels: Float32Array[], sampleRate: number) => LoudnessAnalysis;
    /** Gain needed to bring a buffer to a target RMS, for reference matching. */
    gainToMatchRms: (samples: Float32Array, targetRmsDb: number) => number;
    /** Render one aligned audio file per bus. */
    exportStems: (settings?: StemExportSettings) => Promise<Stem[]>;

    // --- Vocal editing (Session 5) ---
    /** Tune a vocal clip in place, snapping to the project key. */
    tuneVocalClip: (clipId: string, options?: {
        strength?: number; retuneSeconds?: number; scale?: number[];
    }) => Promise<boolean>;
    /** Nudge `clipId` into time with `referenceClipId`. Returns the offset in seconds. */
    alignClipTo: (clipId: string, referenceClipId: string) => Promise<number | null>;
    /** Duck breaths and repair mouth clicks on a clip. */
    cleanVocalClip: (clipId: string, options?: {
        breathReductionDb?: number; breathThresholdDb?: number;
    }) => Promise<boolean>;
    removeTrackSend: (trackId: string, busId: string) => void;
    togglePlugin: (trackId: string, pluginId: string) => void;
    addClip: (clip: Clip) => void;
    currentTool: 'select' | 'split' | 'draw' | 'erase' | 'zoom' | 'mute'
        | 'text' | 'pointer' | 'pencil' | 'scissors' | 'glue' | 'solo'
        | 'fade' | 'automation-select' | 'automation-curve' | 'marquee' | 'flex';
    setCurrentTool: (tool: 'select' | 'split' | 'draw' | 'erase' | 'zoom' | 'mute' | 'text' | 'pointer' | 'pencil' | 'scissors' | 'glue' | 'solo' | 'fade' | 'automation-select' | 'automation-curve' | 'marquee' | 'flex') => void;
    contextMenu: { visible: boolean; x: number; y: number; clipId: string | null };
    showContextMenu: (x: number, y: number, clipId: string) => void;
    hideContextMenu: () => void;
    selectClip: (id: string | null) => void;
    deselectClip: (clipId: string) => void;
    deselectAllClips: () => void;
    toggleClipSelection: (clipId: string) => void;
    moveClip: (clipId: string, newStartTime: number, newTrackId?: string) => void;
    moveSelectedClips: (deltaBeats: number, deltaTrackIndex?: number, trackIds?: string[]) => void;
    splitClip: (clipId: string, splitBeat: number) => void;
    duplicateSelectedClips: (offsetBeats?: number) => void;
    updateClipFade: (clipId: string, fadeType: 'in' | 'out', settings: any) => void;
    stretchClip: (clipId: string, newDuration: number, newPlaybackRate: number) => void;
    setClipPlaybackRate: (clipId: string, playbackRate: number) => void;
    setClipPitch: (clipId: string, pitchOffset: number) => void;
    reverseClip: (clipId: string) => void;
    renameClip: (clipId: string, newName: string) => void;
    setClipColor: (clipId: string, color: string) => void;
    toggleClipMute: (clipId: string) => void;
    duplicateClip: (clipId: string) => void;
    addMediaFile: (file: File, trackId?: string) => void;
    makeAlias: (sourceClipId: string, trackId: string, start: number, aliasName?: string) => void;
    makeAliasesFromSelection: (trackId?: string, start?: number) => void;
    reassignAlias: (aliasClipId: string, newSourceClipId: string) => void;
    selectOriginalOfAlias: (aliasClipId: string) => void;
    selectAliasesOfRegion: (regionClipId: string) => void;
    selectOrphanAliases: () => void;
    deleteOrphanAliases: () => void;
    convertAliasToRegionCopy: (aliasClipId: string) => void;
    convertOrphanAliasesToCopies: () => void;

    // Logic Pro-like region processing
    splitRegionBySilence: (clipId: string, options?: { threshold?: number; minSilence?: number; preAttack?: number; postRelease?: number; zeroCross?: boolean }) => void;
    stemSplitter: (clipId: string, options?: { preset?: string; selectedStems?: string[]; includeSubmix?: boolean }) => void;

    // Audio Track Editor state and actions
    showAudioTrackEditor: boolean;
    audioTrackEditorTrackId: string | null;
    audioTrackEditorZoom: number;
    audioTrackEditorHeight: number;
    audioTrackEditorWaveformZoom: number;
    setShowAudioTrackEditor: (show: boolean) => void;
    setAudioTrackEditorTrackId: (trackId: string | null) => void;
    setAudioTrackEditorZoom: (zoom: number) => void;
    setAudioTrackEditorHeight: (height: number) => void;
    setAudioTrackEditorWaveformZoom: (zoom: number) => void;

    splitClipAtTime: (clipId: string, time: number) => void;
    splitClipAtPlayhead: (clipId: string) => void;
    joinClips: (clipIds: string[]) => void;
    trimClip: (clipId: string, trimLeft: number, trimRight: number) => void;

    copySelectedClips: () => void;
    cutSelectedClips: () => void;
    pasteClipsAtPlayhead: () => void;
    deleteSelectedClips: () => void;
    updateClip: (id: string, updates: Partial<Clip>) => void;
    deleteClip: (id: string) => void;
    addNote: (clipId: string, note: Note) => void;
    /**
     * Quantize every note in a region to a grid.
     * `division` is 4 for quarter notes, 16 for sixteenths, and so on.
     */
    quantizeClipNotes: (
        clipId: string,
        division: GridDivision,
        strength?: number,
        swing?: number,
    ) => void;
    updateNote: (clipId: string, noteId: string, updates: Partial<Note>) => void;
    deleteNote: (clipId: string, noteId: string) => void;
    addAnnotation: (annotation: TimelineAnnotation) => void;
    updateAnnotation: (id: string, updates: Partial<TimelineAnnotation>) => void;
    deleteAnnotation: (id: string) => void;
    setZoom: (zoom: number) => void;
    setTrackHeight: (height: number) => void;
    setSnap: (snap: ProjectState['snap']) => void;
    toggleAutomation: () => void;
    addAutomationPoint: (trackId: string, parameter: string, time: number, value: number) => void;
    updateAutomationPoint: (trackId: string, laneIndex: number, pointIndex: number, updatedPoint: any) => void;
    deleteAutomationPoint: (trackId: string, laneIndex: number, pointIndex: number) => void;
    toggleToolsMenu: (show?: boolean) => void;
    toggleLibrary: () => void;
    toggleInspector: () => void;
    toggleToolbar: () => void;
    toggleSmartControls: () => void;
    toggleMixer: () => void;
    toggleEditors: () => void;
    toggleListEditors: () => void;
    toggleNotePad: () => void;
    toggleLoopBrowser: () => void;
    toggleBrowsers: () => void;
    toggleLiveLoops: () => void;
    toggleTracksArea: () => void;
    toggleGlobalTracks: () => void;
    toggleHideView: () => void;
    setTrackHidden: (trackId: string, hidden: boolean) => void;
    unhideAllTracks: () => void;
    showSearchAndSelect: boolean;
    toggleSearchAndSelect: (show: boolean) => void;
    setBottomPanel: (panel: 'mixer' | 'pianoroll' | 'smartcontrols') => void;
    setBottomPanelHeight: (height: number) => void;
    setPianoRollLinkMode: (mode: 'single' | 'selected' | 'folder' | 'project') => void;
    setPianoRollFocusClipId: (clipId: string | null) => void;
    toggleBeatMapping: () => void;
    addBeatMappingEntry: (clipId: string, sourceTime: number, targetTime: number, noteId?: string) => void;
    removeBeatMappingEntry: (entryId: string) => void;
    clearBeatMapping: () => void;
    applyBeatMappingToTempo: () => void;
    toggleMetronome: () => void;
    toggleCountIn: () => void;
    setCountInBars: (bars: number) => void;
    setMetronomeSetting: (key: keyof ProjectSettings['metronome'], value: any) => void;
    selectTrack: (id: string | null, isMulti?: boolean, isShift?: boolean) => void;
    selectTracks: (ids: string[], focusedId: string | null) => void;
    duplicateTracks: (mode: 'settings' | 'content' | 'shared') => void;
    createTrackForSelectedRegions: () => void;
    createTrackForOverlappedRegions: (trackId: string) => void;
    reorderTracks: (draggedIndex: number, hoverIndex: number) => void;
    sortTracks: (by: 'name' | 'type' | 'instrument' | 'output' | 'midi') => void;
    toggleColorPalette: (show: boolean) => void;
    toggleIconBrowser: (trackId: string | null) => void;
    toggleDrumReplacement: (trackId: string | null) => void;
    toggleTrackHeaderConfig: (show: boolean) => void;
    updateTrackHeaderConfig: (config: Partial<ProjectState['trackHeaderConfig']>) => void;
    setTrackHeaderWidth: (width: number) => void;
    confirmDrumReplacement: (settings: any) => void;
    updateTrackZoom: (trackId: string, zoom: number) => void;
    resetAllTrackZoom: () => void;

    // Library Actions
    setLibrarySearchQuery: (query: string) => void;
    toggleLibraryPatchMerging: (enabled?: boolean) => void;
    setLibraryMergingOption: (option: keyof ProjectState['libraryMergingOptions'], enabled: boolean) => void;
    setLibrarySelectedPresetId: (id: string | null) => void;
    applyPatch: (trackId: string, presetId: string) => void;

    // --- New Professional Track Actions ---
    updateTrackParameter: (trackId: string, params: Partial<Pick<Track, 'protected' | 'frozen' | 'enabled' | 'freezeMode'>>) => void;
    /** Render a track offline and play the render instead of its source. */
    freezeTrack: (trackId: string) => Promise<void>;
    /** Restore a frozen track's source material. */
    unfreezeTrack: (trackId: string) => void;
    /** Tracks currently rendering, for progress UI. */
    freezingTrackIds: string[];
    addTrackAlternative: (trackId: string, options?: { duplicate?: boolean, nameByRegion?: boolean }) => void;
    deleteInactiveAlternatives: (trackId: string) => void;
    setActiveAlternative: (trackId: string, alternativeId: string) => void;
    toggleInactiveAlternatives: (trackId: string) => void;
    renameAlternative: (trackId: string, alternativeId: string, name: string) => void;
    swapWithActiveAlternative: (trackId: string, inactiveId: string) => void;
    selectNote: (id: string | null) => void;
    toggleCycle: () => void;
    toggleSkipCycle: () => void;
    setLocators: (left: number, right: number) => void;
    setLoopEnabled: (enabled: boolean) => void;
    setLoop: (start: number, end: number, enable?: boolean) => void;
    clearLoop: () => void;
    setAutoSetLocators: (mode: ProjectState['autoSetLocators']) => void;
    updateLocatorsBySelection: () => void;
    chaseEvents: (position: number) => void;
    updateProjectSettings: (updates: Partial<ProjectSettings>) => void;
    updateGlobalSettings: (updates: Partial<GlobalSettings>) => void;
    loadGlobalSettings: () => void;
    assignKeyCommand: (commandId: string, shortcut: string) => void;
    removeKeyCommand: (commandId: string) => void;
    resetKeyCommands: () => void;
    importKeyCommands: (payload: GlobalKeyCommand[]) => void;
    exportKeyCommands: () => string;

    addControlSurface: (device: ControlSurfaceDevice) => void;
    updateControlSurface: (id: string, updates: Partial<ControlSurfaceDevice>) => void;
    removeControlSurface: (id: string) => void;
    addControlSurfaceAssignment: (assignment: ControlSurfaceAssignment) => void;
    updateControlSurfaceAssignment: (id: string, updates: Partial<ControlSurfaceAssignment>) => void;
    removeControlSurfaceAssignment: (id: string) => void;
    toggleControlSurfacesBypass: () => void;

    assignProjectKeyCommand: (commandId: string, shortcut: string) => void;
    removeProjectKeyCommand: (commandId: string) => void;
    resetProjectKeyCommands: () => void;
    importProjectKeyCommands: (payload: GlobalKeyCommand[]) => void;
    exportProjectKeyCommands: () => string;

    addEnvironmentLayer: (name: string, isGlobal?: boolean) => void;
    renameEnvironmentLayer: (layerId: string, name: string) => void;
    deleteEnvironmentLayer: (layerId: string) => void;
    selectEnvironmentLayer: (layerId: string) => void;
    toggleEnvironmentGlobalObjectVisibility: () => void;
    addEnvironmentObject: (object: Omit<EnvironmentObject, 'id'>) => void;
    updateEnvironmentObject: (objectId: string, updates: Partial<EnvironmentObject>) => void;
    deleteEnvironmentObject: (objectId: string) => void;
    connectEnvironmentObjects: (sourceId: string, targetId: string) => void;
    disconnectEnvironmentObjects: (sourceId: string, targetId: string) => void;

    initializeProject: (settings: { tempo: number, keySignature: string, timeSignature: string }) => void;
    openProject: (id: string) => Promise<void>;

    // Articulation Actions
    toggleArticulationEditor: (show?: boolean, setId?: string | null) => void;
    addArticulationSet: (trackId: string) => void;
    updateArticulationSet: (id: string, updates: Partial<ArticulationSet>) => void;
    deleteArticulationSet: (id: string) => void;
    setArticulationForNotes: (clipId: string, noteIds: string[], articulationId: number) => void;

    // Selection-Based Processing Actions
    toggleSelectionBasedProcessing: (show?: boolean) => void;
    updateSBPState: (updates: Partial<ProjectState['sbpState']>) => void;
    setMarqueeSelection: (selection: ProjectState['marqueeSelection']) => void;
    applySelectionBasedProcessing: () => void;
    addPluginToSBP: (set: 'A' | 'B', pluginType: string) => void;
    removePluginFromSBP: (setSide: 'A' | 'B', pluginId: string) => void;
    updatePluginParams: (trackId: string, pluginId: string, params: Record<string, number>) => void;
    /** Track the plugin browser is adding to, or null when closed. */
    pluginBrowserTrackId: string | null;
    /** Which half of the catalogue to show: effects, instruments, or both. */
    pluginBrowserMode: 'all' | 'instrument' | 'effect';
    setPluginBrowserTrack: (
        trackId: string | null,
        mode?: 'all' | 'instrument' | 'effect',
    ) => void;
    /** Load a Web Audio Module instrument onto a track. Returns success. */
    setWamInstrument: (
        trackId: string,
        entry: { identifier: string; name: string; url: string },
    ) => Promise<boolean>;
    /** Insert a Web Audio Module plugin. Returns the new instance id. */
    addWamPlugin: (
        trackId: string,
        entry: { identifier: string; name: string; url: string },
    ) => string;
    /** Remove one plugin instance from a track's chain. */
    removePlugin: (trackId: string, pluginId: string) => void;
    /** Move a plugin within a track's chain, changing processing order. */
    reorderPlugins: (trackId: string, fromIndex: number, toIndex: number) => void;

    // Stacks & Groove
    toggleStackCollapse: (trackId: string, recursive?: boolean) => void;
    convertStackType: (trackId: string, type: 'Folder' | 'Summing') => void;
    setGrooveTrack: (trackId: string | null) => void;
    toggleMatchGroove: (trackId: string) => void;

    // Bounce Actions
    toggleBounceTrackDialog: (trackId?: string | null) => void;
    toggleBounceRegionsDialog: (clipIds?: string[] | null) => void;
    toggleBounceAllTracksDialog: (show?: boolean) => void;
    /** Render a track to audio on a new track. Awaitable: it renders offline. */
    bounceTrackInPlace: (trackId: string, settings: any) => Promise<void>;
    bounceRegionsInPlace: (clipIds: string[], settings: any) => void;
    bounceReplaceAllTracks: (settings: any) => void;
    toggleExportDialog: (type: ProjectState['showExportDialog']) => void;
    setShowSettingsDialog: (show: boolean, tab?: string, subTab?: string) => void;
    exportAsAudioFiles: (settings: any) => void;
    /** Render the project offline and return the buffer plus an encoded file. */
    exportProject: (settings?: ProjectExportSettings) => Promise<ProjectExportResult>;
    toggleShareDialog: (show?: boolean) => void;
    shareProject: (options: { format: 'project' | 'song' | 'aaf' | 'xml' | 'musicxml'; destination: 'download' | 'web-share'; includeAssets: boolean; compress: boolean; customName: string}) => Promise<void>;
    setOpenPluginEditor: (editor: { trackId: string; pluginId: string } | null) => void;
    toggleVirtualKeyboard: (show?: boolean) => void;
    setVirtualKeyboardMode: (mode: ProjectState['virtualKeyboardMode']) => void;
    updateVirtualKeyboardParams: (updates: Partial<{ octave: number, velocity: number, pitchBend: number, modulation: number, sustain: boolean }>) => void;
    triggerNote: (pitch: number, velocity: number, trackId?: string, depth?: number) => void;
    releaseNote: (pitch: number, trackId?: string, depth?: number) => void;
    toggleNoteRepeat: (show?: boolean) => void;
    updateNoteRepeatSettings: (updates: Partial<ProjectState['noteRepeatSettings']>) => void;
    toggleSpotErase: (show?: boolean) => void;
    updateSpotEraseSettings: (updates: Partial<ProjectState['spotEraseSettings']>) => void;
    toggleStepInput: (show?: boolean) => void;
    updateStepInputSettings: (updates: Partial<ProjectState['stepInputSettings']>) => void;
    selectClips: (ids: string[]) => void;

    // --- Automation Selection Actions ---
    selectAutomationPoint: (pointId: string, additive?: boolean) => void;
    deselectAutomationPoint: (pointId: string) => void;
    toggleAutomationPointSelection: (pointId: string) => void;
    selectAutomationPoints: (ids: string[]) => void;
    deselectAllAutomationPoints: () => void;

    // --- Internal MIDI Routing Actions ---
    setInternalMidiIn: (trackId: string, sourceId: string | undefined, type: Track['internalMidiInType']) => void;
    setInternalMidiInRecordMode: (trackId: string, mode: Track['internalMidiInRecordMode']) => void;
    setMidiOutToTrackSlot: (trackId: string, slotIndex: number) => void;
}

const MAX_HISTORY = 50;
const MAX_SNAPSHOT_SIZE = 1024 * 1024; // 1MB

function estimatedSize(obj: unknown): number {
    const seen = new WeakSet();
    function size(v: unknown): number {
        if (typeof v === 'string') return v.length * 2;
        if (typeof v === 'number' || typeof v === 'boolean') return 8;
        if (v === null || v === undefined) return 0;
        if (typeof v === 'object') {
            if (seen.has(v as object)) return 0;
            seen.add(v as object);
            if (Array.isArray(v)) return v.reduce((s, x) => s + size(x), 0);
            return Object.values(v as Record<string, unknown>).reduce((s: number, x: unknown) => s + size(x), 0);
        }
        return 0;
    }
    return size(obj);
}

function createHistorySnapshot(state: ProjectState): Partial<ProjectState> {
    return {
        id: state.id,
        name: state.name,
        schemaVersion: state.schemaVersion,
        tempo: state.tempo,
        timeSignature: state.timeSignature,
        keySignature: state.keySignature,
        tracks: (state.tracks ?? []).map(t => ({ ...t })),
        clips: (state.clips ?? []).map(c => ({ ...c })),
        annotations: state.annotations ? state.annotations.map(a => ({ ...a })) : undefined,
        // An alternative restored from a project that predates track/clip
        // snapshots has neither array; mapping them unguarded threw and took
        // undo down with it.
        muteSoloGroups: (state.muteSoloGroups ?? []).map(g => ({ ...g, trackIds: [...g.trackIds] })),
        vcaFaders: (state.vcaFaders ?? []).map(v => ({ ...v, trackIds: [...v.trackIds] })),
        alternatives: state.alternatives
            ? state.alternatives.map(a => ({
                ...a,
                tracks: (a.tracks ?? []).map(t => ({ ...t })),
                clips: (a.clips ?? []).map(c => ({ ...c })),
            }))
            : undefined,
        currentAlternativeId: state.currentAlternativeId,
        globalTracks: state.globalTracks ? JSON.parse(JSON.stringify(state.globalTracks)) : undefined,
        settings: state.settings ? { ...state.settings } : undefined,
        globalSettings: undefined,
        // `GET /api/project/[id]` returns `environment: {}` when a project has
        // none — truthy, but with no layers/objects to map.
        environment: state.environment
            ? {
                ...state.environment,
                layers: (state.environment.layers ?? []).map(l => ({ ...l })),
                objects: (state.environment.objects ?? []).map(o => ({ ...o })),
            }
            : undefined,
        projectKeyCommands: state.projectKeyCommands ? state.projectKeyCommands.map(k => ({ ...k })) : undefined,
        zoom: state.zoom,
        trackHeight: state.trackHeight,
        snap: state.snap,
        controlBarSettings: state.controlBarSettings ? { ...state.controlBarSettings } : undefined,
        isDirty: state.isDirty,
        showAutomation: state.showAutomation,
        showLibrary: state.showLibrary,
        showInspector: state.showInspector,
        showToolbar: state.showToolbar,
        showSmartControls: state.showSmartControls,
        showMixer: state.showMixer,
        showEditors: state.showEditors,
        showListEditors: state.showListEditors,
        showNotePad: state.showNotePad,
        showLoopBrowser: state.showLoopBrowser,
        showBrowsers: state.showBrowsers,
        showLiveLoopsGrid: state.showLiveLoopsGrid,
        showTracksArea: state.showTracksArea,
        showGlobalTracks: state.showGlobalTracks,
        beatMappingMode: state.beatMappingMode,
        metronomeEnabled: state.metronomeEnabled,
        countInEnabled: state.countInEnabled,
        countInBars: state.countInBars,
        hideViewActive: state.hideViewActive,
        selectedTrackIds: state.selectedTrackIds ? [...state.selectedTrackIds] : undefined,
        focusedTrackId: state.focusedTrackId,
        selectedClipId: state.selectedClipId,
        selectedClipIds: state.selectedClipIds ? [...state.selectedClipIds] : undefined,
        regionClipboard: state.regionClipboard ? state.regionClipboard.map(c => ({ ...c })) : undefined,
        selectedNoteId: state.selectedNoteId,
        projectFormat: state.projectFormat,
        surroundFormat: state.surroundFormat,
        spatialAudioMode: state.spatialAudioMode,
        bottomPanel: state.bottomPanel,
        bottomPanelHeight: state.bottomPanelHeight,
        pianoRollLinkMode: state.pianoRollLinkMode,
        pianoRollFocusClipId: state.pianoRollFocusClipId,
        selectedAutomationPointId: state.selectedAutomationPointId,
        selectedAutomationPointIds: state.selectedAutomationPointIds ? [...state.selectedAutomationPointIds] : undefined,
        showSelectionBasedProcessing: state.showSelectionBasedProcessing,
        marqueeSelection: state.marqueeSelection ? { ...state.marqueeSelection } : undefined,
        sbpState: state.sbpState ? { ...state.sbpState } : undefined,
        cycleEnabled: state.cycleEnabled,
        skipCycleEnabled: state.skipCycleEnabled,
        locatorLeft: state.locatorLeft,
        locatorRight: state.locatorRight,
        autoSetLocators: state.autoSetLocators,
        showNewTrackDialog: state.showNewTrackDialog,
        showCreateTrackUsing: state.showCreateTrackUsing,
        showColorPalette: state.showColorPalette,
        showIconBrowser: state.showIconBrowser,
        showDrumReplacement: state.showDrumReplacement,
        drumReplacementTargetId: state.drumReplacementTargetId,
        showBounceTrackDialog: state.showBounceTrackDialog,
        showBounceRegionsDialog: state.showBounceRegionsDialog,
        showBounceAllTracksDialog: state.showBounceAllTracksDialog,
        showExportDialog: state.showExportDialog,
        showSettingsDialog: state.showSettingsDialog,
        settingsActiveTab: state.settingsActiveTab,
        settingsActiveSubTab: state.settingsActiveSubTab,
        showShareDialog: state.showShareDialog,
        showVirtualKeyboard: state.showVirtualKeyboard,
        virtualKeyboardMode: state.virtualKeyboardMode,
        virtualKeyboardOctave: state.virtualKeyboardOctave,
        virtualKeyboardVelocity: state.virtualKeyboardVelocity,
        virtualKeyboardPitchBend: state.virtualKeyboardPitchBend,
        virtualKeyboardModulation: state.virtualKeyboardModulation,
        virtualKeyboardSustain: state.virtualKeyboardSustain,
        showTrackHeaderConfig: state.showTrackHeaderConfig,
        trackHeaderWidth: state.trackHeaderWidth,
        openPluginEditor: state.openPluginEditor ? { ...state.openPluginEditor } : undefined,
        hoveredHelpId: state.hoveredHelpId,
        trackHeaderConfig: state.trackHeaderConfig ? { ...state.trackHeaderConfig } : undefined,
        showNoteRepeatDialog: state.showNoteRepeatDialog,
        showSpotEraseDialog: state.showSpotEraseDialog,
        noteRepeatSettings: state.noteRepeatSettings ? { ...state.noteRepeatSettings } : undefined,
        spotEraseSettings: state.spotEraseSettings ? { ...state.spotEraseSettings } : undefined,
        showStepInputKeyboard: state.showStepInputKeyboard,
        stepInputSettings: state.stepInputSettings ? { ...state.stepInputSettings } : undefined,
        channelStripSettings: state.channelStripSettings ? state.channelStripSettings.map(c => ({ ...c, settings: { ...c.settings, plugins: c.settings.plugins.map(p => ({ ...p })), sends: c.settings.sends.map(s => ({ ...s })) } })) : undefined,
        channelStripCopyBuffer: state.channelStripCopyBuffer
            ? {
                ...state.channelStripCopyBuffer,
                plugins: (state.channelStripCopyBuffer.plugins ?? []).map(p => ({ ...p })),
                sends: (state.channelStripCopyBuffer.sends ?? []).map(s => ({ ...s })),
            }
            : undefined,
        channelStripPerformances: state.channelStripPerformances ? state.channelStripPerformances.map(p => ({ ...p, settings: { ...p.settings, plugins: p.settings.plugins.map(p2 => ({ ...p2 })), sends: p.settings.sends.map(s => ({ ...s })) } })) : undefined,
        librarySearchQuery: state.librarySearchQuery,
        libraryPatchMerging: state.libraryPatchMerging,
        libraryMergingOptions: state.libraryMergingOptions ? { ...state.libraryMergingOptions } : undefined,
        librarySelectedPresetId: state.librarySelectedPresetId,
        articulationSets: state.articulationSets ? state.articulationSets.map(a => ({ ...a })) : undefined,
        showArticulationEditor: state.showArticulationEditor,
        editingArticulationSetId: state.editingArticulationSetId,
        recentProjects: state.recentProjects ? state.recentProjects.map(r => ({ ...r })) : undefined,
        demoProjects: state.demoProjects ? state.demoProjects.map(d => ({ ...d })) : undefined,
    };
}

/**
 * Push the project's click-track preferences into the audio engine and switch
 * the click on or off for the transport mode we are entering.
 *
 * Logic Pro semantics: in simple mode `metronomeEnabled` is the only switch; in
 * advanced mode playback and recording have independent toggles.
 */
function syncMetronome(
    settings: ProjectSettings,
    metronomeEnabled: boolean,
    mode: 'play' | 'record' | 'stop',
): void {
    const m = settings.metronome;

    audioEngine.configureMetronome({
        accentLevel: m.accentLevel,
        clickLevel: m.clickLevel,
        polyphonicClick: m.polyphonicClick,
    });

    if (mode === 'stop') {
        audioEngine.setMetronomeEnabled(false);
        return;
    }

    const active = m.simpleMode
        ? metronomeEnabled
        : (mode === 'record' ? m.clickWhileRecording : m.clickWhilePlaying);

    audioEngine.setMetronomeEnabled(active);
}


/** Scale degrees implied by a key signature string like "A minor". */
function scaleFromKeySignature(key: string): { tonic: number; scale: number[] } {
    const PITCH_CLASSES: Record<string, number> = {
        C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
        'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
    };
    const match = /^([A-G][#b]?)\s*(.*)$/.exec(key.trim());
    if (!match) return { tonic: 0, scale: SCALES.chromatic };

    const tonic = PITCH_CLASSES[match[1]] ?? 0;
    const mode = match[2].toLowerCase();
    const scale = mode.startsWith('min') ? SCALES.minor
        : mode.startsWith('maj') || mode === '' ? SCALES.major
            : SCALES.chromatic;
    return { tonic, scale };
}

/** The decoded audio behind a clip, if it has been loaded. */
function clipBuffer(get: () => ProjectState, clipId: string): AudioBuffer | null {
    const clip = get().clips.find(c => c.id === clipId);
    if (!clip) return null;
    return bufferCacheManager.getBuffer(clip.storageKey ?? clip.sampleId ?? clip.id) ?? null;
}

/**
 * Run a per-channel edit over a clip's audio and put the result back in the
 * buffer cache, so playback and export both pick it up.
 *
 * Destructive by design — these are print-style edits, and the take folder is
 * what preserves the original.
 */
async function editClipSamples(
    get: () => ProjectState,
    clipId: string,
    edit: (samples: Float32Array, sampleRate: number) => Float32Array,
): Promise<boolean> {
    const ctx = audioEngine.getContext();
    const source = clipBuffer(get, clipId);
    const clip = get().clips.find(c => c.id === clipId);
    if (!ctx || !source || !clip) return false;

    const edited = ctx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
    for (let channel = 0; channel < source.numberOfChannels; channel++) {
        const result = edit(source.getChannelData(channel), source.sampleRate);
        edited.getChannelData(channel).set(result.subarray(0, source.length));
    }

    bufferCacheManager.addBuffer(clip.storageKey ?? clip.sampleId ?? clip.id, edited, clip.name);
    return true;
}

/** A track with every default filled in; `overrides` wins. */
function buildNewTrack(overrides: Partial<Track>, orderIndex: number): Track {
    const trackId = overrides.id || Date.now().toString();
    return {
        id: trackId, name: 'Audio Track', type: 'audio', muted: false, soloed: false,
        volume: 0.8, pan: 0, color: '#888', orderIndex,
        recordEnabled: false, inputMonitoring: false,
        protected: false, frozen: false, enabled: true,
        freezeMode: 'Source Only',
        alternatives: [{ id: 'alt-1', name: 'A' }],
        activeAlternativeId: 'alt-1',
        showInactiveAlternatives: false,
        transpose: 0, velocityOffset: 0, delay: 0, plugins: [], sends: [],
        outputBusId: 'stereo-out',
        channelStripId: trackId,
        zoom: 1,
        hidden: false,
        isCollapsed: false,
        isGrooveTrack: false,
        matchGrooveTrack: false,
        ...overrides,
    } as Track;
}

/** Guards against stacked transport loops; see `play()`. */
let transportLoopGeneration = 0;

/**
 * Notes currently held down while recording, keyed `trackId:pitch`.
 *
 * Note-off used to find its note by scanning the clip for `duration === 0.25`,
 * the value note-on wrote as a placeholder. That matched any note that merely
 * happened to be a sixteenth long, and `.map` rewrote every match rather than
 * the one being released — so re-playing a pitch corrupted the earlier note.
 * Transient by nature, so it lives outside the serialized store.
 */
const heldRecordingNotes = new Map<string, { clipId: string; noteId: string; startBeat: number }>();

/** Unique within a millisecond, which `Date.now()` alone is not. */
let recordedNoteSeq = 0;

/** Floor for a recorded note, so a stray tap is still visible and audible. */
const MIN_RECORDED_NOTE_BEATS = 0.125;

/** Pending count-in, so cancelling record does not start the transport late. */
let countInTimer: ReturnType<typeof setTimeout> | null = null;

function cancelCountIn(): void {
    if (countInTimer !== null) {
        clearTimeout(countInTimer);
        countInTimer = null;
    }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    id: null,
    name: "Logic Pro Project",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tempo: 120,
    timeSignature: '4/4',
    keySignature: 'C major',
    playing: false,
    playhead: 0,
    tracks: [],
    clips: [],
    masterPlugins: [],
    monitorMode: 'stereo',
    annotations: [],
    alternatives: [],
    currentAlternativeId: null,
    globalTracks: {
        tempo: [{ time: 0, value: 120, type: 'jump' }],
        markers: [],
        signature: [{ time: 0, numerator: 4, denominator: 4 }],
        key: [{ time: 0, root: 'C', mode: 'major' }],
        beatMapping: []
    },
    settings: {
        sampleRate: 48000,
        bitDepth: 24,
        frameRate: 25,
        metronome: {
            simpleMode: false, clickWhilePlaying: true, clickWhileRecording: true, onlyDuringCountIn: false,
            polyphonicClick: false, accentLevel: 10, clickLevel: 5,
        },
        assets: { copyAudioFiles: true, copySamplerFiles: true, copyMovieFiles: false },
        projectStart: 0,
        projectEnd: 128,
        autoProjectEnd: true,
        masterVolume: 0.8,
        masterPan: 0,
        masterMuted: false,
        midi: {
            chase: {
                notes: true, sustained: true, inNoTransposeInstruments: false, programChange: true, pitchBend: true,
                controlChanges: { cc0_15: true, cc64_71: true, allOther: true },
                aftertouch: true, polyAftertouch: true, sysEx: true, textMeta: false,
                separateChannels: true, chaseOnCycleJump: true, chaseOnCycleNotes: false, sendReset: false
            }
        }
    },
    globalSettings: {
        startupAction: 'openMostRecent',
        defaultTemplateId: null,
        openProjectBehavior: 'ask',
        saveUndoHistoryWithProject: true,
        autoBackupCount: 5,
        recentItemsLimit: 10,
        includeInstrumentSettingsInReset: true,
        audio: {},
        recording: {},
        midi: {},
        score: {},
        movie: {},
        automation: {},
        general: {},
        view: {},
        advanced: {},
        myInfo: {},
        controlSurfaces: {
            bypassWhileInBackground: false,
            resolutionOfRelativeControls: 0,
            maxMidiBandwidth: 100,
            touchingFaderSelectsTrack: false,
            followTrackSelection: true,
            openPluginWindowOnSelection: true,
            jogResolutionDependsOnZoom: false,
            pickupMode: true,
            flashMuteSoloButtons: true,
            multipleControlsPerParameter: 0,
            longerLabelsOnlyIfFit: false,
            showValueUnitsForInstrument: true,
            showValueUnitsForVolume: true,
            helpTags: {
                parameterName: true,
                parameterValue: true,
                displayDuration: 3,
                showInfoMultiple: true,
                showInfoTrackSelection: true,
                showInfoVolume: true,
            },
            usbMidiControllers: [],
            devices: [],
            assignments: [],
            bypassed: false,
        },
        useProjectSettings: true,
        keyCommands: [
            { id: 'play_stop', name: 'Play/Stop', description: 'Start/stop playback', shortcut: 'Space', defaultShortcut: 'Space', isCustom: false },
            { id: 'bypass_control_surfaces', name: 'Bypass Control Surfaces', description: 'Ignore incoming control surface messages', shortcut: '', defaultShortcut: '', isCustom: false },
            { id: 'play', name: 'Play', description: 'Start playback', shortcut: 'NumpadEnter', defaultShortcut: 'NumpadEnter', isCustom: false },
            { id: 'stop', name: 'Stop', description: 'Stop playback', shortcut: 'Numpad0', defaultShortcut: 'Numpad0', isCustom: false },
            { id: 'record', name: 'Record', description: 'Record toggle', shortcut: 'R', defaultShortcut: 'R', isCustom: false },
            { id: 'open_environment', name: 'Open Environment', description: 'Open environment', shortcut: 'Ctrl+0', defaultShortcut: 'Ctrl+0', isCustom: false },
            { id: 'record_toggle', name: 'Record Toggle', description: 'Record toggle from numpad', shortcut: 'Numpad*', defaultShortcut: 'Numpad*', isCustom: false },
            { id: 'discard_and_return', name: 'Discard Recording and Return', description: 'Discard recording and return to last position', shortcut: 'Ctrl+.', defaultShortcut: 'Ctrl+.', isCustom: false },
            { id: 'record_into_cell', name: 'Record Into Cell', description: 'Record into cell', shortcut: 'Alt+R', defaultShortcut: 'Alt+R', isCustom: false },
            { id: 'flashback_capture', name: 'Flashback Capture', description: 'Flashback capture as recording', shortcut: 'Shift+R', defaultShortcut: 'Shift+R', isCustom: false },
            { id: 'preview_selection_processing', name: 'Preview Selection-Based Processing', description: 'Preview SBP action', shortcut: 'Alt+Shift+Space', defaultShortcut: 'Alt+Shift+Space', isCustom: false },
            { id: 'rewind', name: 'Rewind', description: 'Move playhead backward', shortcut: ',', defaultShortcut: ',', isCustom: false },
            { id: 'forward', name: 'Forward', description: 'Move playhead forward', shortcut: '.', defaultShortcut: '.', isCustom: false },
            { id: 'fast_rewind', name: 'Fast Rewind', description: 'Fast rewind', shortcut: 'Shift+,', defaultShortcut: 'Shift+,', isCustom: false },
            { id: 'fast_forward', name: 'Fast Forward', description: 'Fast forward', shortcut: 'Shift+.', defaultShortcut: 'Shift+.', isCustom: false },
            { id: 'forward_by_transient', name: 'Forward by Transient', description: 'Forward to next transient-marker position', shortcut: 'Ctrl+.', defaultShortcut: 'Ctrl+.', isCustom: false },
            { id: 'rewind_by_transient', name: 'Rewind by Transient', description: 'Rewind to previous transient', shortcut: 'Ctrl+,', defaultShortcut: 'Ctrl+,', isCustom: false },
            { id: 'play_from_left_edge', name: 'Play from Left Window Edge', description: 'Play from left window edge', shortcut: 'Shift+Enter', defaultShortcut: 'Shift+Enter', isCustom: false },
            { id: 'go_to_left_locator', name: 'Go to Left Locator', description: 'Move playhead to left locator', shortcut: 'Ctrl+Shift+,', defaultShortcut: 'Ctrl+Shift+,', isCustom: false },
            { id: 'go_to_right_locator', name: 'Go to Right Locator', description: 'Move playhead to right locator', shortcut: 'Ctrl+Shift+.', defaultShortcut: 'Ctrl+Shift+.', isCustom: false },
            { id: 'go_to_position', name: 'Go to Position', description: 'Go to position prompt', shortcut: '/', defaultShortcut: '/', isCustom: false },
            { id: 'set_punch_in', name: 'Set Punch In Locator', description: 'Set punch in to playhead', shortcut: 'Ctrl+Alt+I', defaultShortcut: 'Ctrl+Alt+I', isCustom: false },
            { id: 'set_punch_in_rounded', name: 'Set Punch In Rounded', description: 'Set punch in rounded', shortcut: 'Ctrl+Alt+Shift+I', defaultShortcut: 'Ctrl+Alt+Shift+I', isCustom: false },
            { id: 'set_punch_out', name: 'Set Punch Out Locator', description: 'Set punch out to playhead', shortcut: 'Ctrl+Alt+O', defaultShortcut: 'Ctrl+Alt+O', isCustom: false },
            { id: 'set_punch_out_rounded', name: 'Set Punch Out Rounded', description: 'Set punch out rounded', shortcut: 'Ctrl+Alt+Shift+O', defaultShortcut: 'Ctrl+Alt+Shift+O', isCustom: false },
            { id: 'set_locators_by_regions', name: 'Set Locators/Loop by Regions', description: 'Set locators by selected regions', shortcut: 'Ctrl+U', defaultShortcut: 'Ctrl+U', isCustom: false },
            { id: 'set_rounded_locators', name: 'Set Rounded Locators', description: 'Set locators rounded', shortcut: 'U', defaultShortcut: 'U', isCustom: false },
            { id: 'play_from_selection', name: 'Play from Selection', description: 'Play from selection', shortcut: 'Shift+Space', defaultShortcut: 'Shift+Space', isCustom: false },
            { id: 'skip_cycle', name: 'Skip Cycle', description: 'Toggle skip cycle', shortcut: 'Numpad=', defaultShortcut: 'Numpad=', isCustom: false },
            { id: 'move_locators_forward', name: 'Move Locators Forward', description: 'Move locators forward', shortcut: 'Ctrl+Shift+.', defaultShortcut: 'Ctrl+Shift+.', isCustom: false },
            { id: 'move_locators_backward', name: 'Move Locators Backward', description: 'Move locators backward', shortcut: 'Ctrl+Shift+,', defaultShortcut: 'Ctrl+Shift+,', isCustom: false },
            { id: 'double_cycle_length', name: 'Double Cycle Length', description: 'Double cycle length', shortcut: 'Ctrl+Alt+Shift+.', defaultShortcut: 'Ctrl+Alt+Shift+.', isCustom: false },
            { id: 'halve_cycle_length', name: 'Halve Cycle Length', description: 'Halve cycle length', shortcut: 'Ctrl+Alt+Shift+,', defaultShortcut: 'Ctrl+Alt+Shift+,', isCustom: false },
            { id: 'go_to_selection_start', name: 'Go to Selection Start', description: 'Go to selection start', shortcut: 'Ctrl+Home', defaultShortcut: 'Ctrl+Home', isCustom: false },
            { id: 'go_to_selection_end', name: 'Go to Selection End', description: 'Go to selection end', shortcut: 'Ctrl+End', defaultShortcut: 'Ctrl+End', isCustom: false },
            { id: 'go_to_end_last_region', name: 'Go to End of Last Region', description: 'Go to end of last region', shortcut: 'Alt+Enter', defaultShortcut: 'Alt+Enter', isCustom: false },
            { id: 'go_to_beginning', name: 'Go to Beginning', description: 'Go to start', shortcut: 'Enter', defaultShortcut: 'Enter', isCustom: false },
            { id: 'create_marker', name: 'Create Marker', description: 'Create marker', shortcut: "Alt+'", defaultShortcut: "Alt+'", isCustom: false },
            { id: 'create_marker_no_round', name: 'Create Marker Without Rounding', description: 'Create marker no rounding', shortcut: "Ctrl+Alt+'", defaultShortcut: "Ctrl+Alt+'", isCustom: false },
            { id: 'create_marker_selection', name: 'Create Marker for Selection', description: 'Create marker for selection', shortcut: "Alt+Shift+'", defaultShortcut: "Alt+Shift+'", isCustom: false },
            { id: 'delete_marker', name: 'Delete Marker', description: 'Delete selected marker', shortcut: 'Alt+Delete', defaultShortcut: 'Alt+Delete', isCustom: false },
            { id: 'set_locators_by_marker', name: 'Set Locators by Marker', description: 'Set locators using marker', shortcut: 'Ctrl+Alt+C', defaultShortcut: 'Ctrl+Alt+C', isCustom: false },
            { id: 'go_to_previous_marker', name: 'Go to Previous Marker', description: 'Go to previous marker', shortcut: 'Alt+,', defaultShortcut: 'Alt+,', isCustom: false },
            { id: 'go_to_next_marker', name: 'Go to Next Marker', description: 'Go to next marker', shortcut: 'Alt+.', defaultShortcut: 'Alt+.', isCustom: false },
            { id: 'go_to_marker_number', name: 'Go to Marker Number', description: 'Go to marker number', shortcut: 'Alt+/', defaultShortcut: 'Alt+/', isCustom: false },
            { id: 'rename_marker', name: 'Rename Marker', description: 'Rename marker', shortcut: "Shift+'", defaultShortcut: "Shift+'", isCustom: false },
            { id: 'go_to_marker_1', name: 'Go to Marker 1', description: 'Jump to marker 1', shortcut: 'Numpad1', defaultShortcut: 'Numpad1', isCustom: false },
            { id: 'go_to_marker_2', name: 'Go to Marker 2', description: 'Jump to marker 2', shortcut: 'Numpad2', defaultShortcut: 'Numpad2', isCustom: false },
            { id: 'go_to_marker_3', name: 'Go to Marker 3', description: 'Jump to marker 3', shortcut: 'Numpad3', defaultShortcut: 'Numpad3', isCustom: false },
            { id: 'go_to_marker_4', name: 'Go to Marker 4', description: 'Jump to marker 4', shortcut: 'Numpad4', defaultShortcut: 'Numpad4', isCustom: false },
            { id: 'go_to_marker_5', name: 'Go to Marker 5', description: 'Jump to marker 5', shortcut: 'Numpad5', defaultShortcut: 'Numpad5', isCustom: false },
            { id: 'go_to_marker_6', name: 'Go to Marker 6', description: 'Jump to marker 6', shortcut: 'Numpad6', defaultShortcut: 'Numpad6', isCustom: false },
            { id: 'go_to_marker_7', name: 'Go to Marker 7', description: 'Jump to marker 7', shortcut: 'Numpad7', defaultShortcut: 'Numpad7', isCustom: false },
            { id: 'go_to_marker_8', name: 'Go to Marker 8', description: 'Jump to marker 8', shortcut: 'Numpad8', defaultShortcut: 'Numpad8', isCustom: false },
            { id: 'go_to_marker_9', name: 'Go to Marker 9', description: 'Jump to marker 9', shortcut: 'Numpad9', defaultShortcut: 'Numpad9', isCustom: false },
            { id: 'go_to_marker_10', name: 'Go to Marker 10', description: 'Jump to marker 10', shortcut: 'Ctrl+0', defaultShortcut: 'Ctrl+0', isCustom: false },
            { id: 'toggle_autopunch', name: 'Toggle Autopunch', description: 'Toggle autopunch', shortcut: 'Ctrl+Alt+P', defaultShortcut: 'Ctrl+Alt+P', isCustom: false },
            { id: 'solo_selected_tracks', name: 'Solo Selected Tracks', description: 'Solo selected tracks', shortcut: 'Ctrl+S', defaultShortcut: 'Ctrl+S', isCustom: false },
            { id: 'clear_solo', name: 'Clear Solo', description: 'Clear all solo', shortcut: 'Alt+S', defaultShortcut: 'Alt+S', isCustom: false },
            { id: 'mute_off_all', name: 'Mute Off for All', description: 'Mute off for all tracks', shortcut: 'Ctrl+Shift+M', defaultShortcut: 'Ctrl+Shift+M', isCustom: false },
            { id: 'toggle_cycle_preview', name: 'Toggle Cycle Preview', description: 'Toggle cycle preview', shortcut: 'Ctrl+C', defaultShortcut: 'Ctrl+C', isCustom: false },
            { id: 'toggle_count_in', name: 'Toggle Count-In', description: 'Toggle count-in', shortcut: 'Shift+K', defaultShortcut: 'Shift+K', isCustom: false },
            { id: 'undo', name: 'Undo', description: 'Undo last action', shortcut: 'Ctrl+Z', defaultShortcut: 'Ctrl+Z', isCustom: false },
            { id: 'redo', name: 'Redo', description: 'Redo', shortcut: 'Ctrl+Shift+Z', defaultShortcut: 'Ctrl+Shift+Z', isCustom: false },
            { id: 'cut', name: 'Cut', description: 'Cut selection', shortcut: 'Ctrl+X', defaultShortcut: 'Ctrl+X', isCustom: false },
            { id: 'copy', name: 'Copy', description: 'Copy selection', shortcut: 'Ctrl+C', defaultShortcut: 'Ctrl+C', isCustom: false },
            { id: 'paste', name: 'Paste', description: 'Paste', shortcut: 'Ctrl+V', defaultShortcut: 'Ctrl+V', isCustom: false },
            { id: 'select_all', name: 'Select All', description: 'Select all', shortcut: 'Ctrl+A', defaultShortcut: 'Ctrl+A', isCustom: false },
            { id: 'deselect_all', name: 'Deselect All', description: 'Deselect all', shortcut: 'Shift+D', defaultShortcut: 'Shift+D', isCustom: false },
            { id: 'invert_selection', name: 'Invert Selection', description: 'Invert selection', shortcut: 'Shift+I', defaultShortcut: 'Shift+I', isCustom: false },
            { id: 'show_tool_menu', name: 'Show Tool Menu', description: 'Show tool menu', shortcut: 'T', defaultShortcut: 'T', isCustom: false },
            { id: 'zoom_horizontal_out', name: 'Zoom Horizontal Out', description: 'Zoom horizontal out', shortcut: 'Ctrl+ArrowLeft', defaultShortcut: 'Ctrl+ArrowLeft', isCustom: false },
            { id: 'zoom_horizontal_in', name: 'Zoom Horizontal In', description: 'Zoom horizontal in', shortcut: 'Ctrl+ArrowRight', defaultShortcut: 'Ctrl+ArrowRight', isCustom: false },
            { id: 'zoom_vertical_out', name: 'Zoom Vertical Out', description: 'Zoom vertical out', shortcut: 'Ctrl+ArrowUp', defaultShortcut: 'Ctrl+ArrowUp', isCustom: false },
            { id: 'zoom_vertical_in', name: 'Zoom Vertical In', description: 'Zoom vertical in', shortcut: 'Ctrl+ArrowDown', defaultShortcut: 'Ctrl+ArrowDown', isCustom: false },
            { id: 'zoom_to_fit', name: 'Zoom to Fit', description: 'Zoom to fit', shortcut: 'Z', defaultShortcut: 'Z', isCustom: false },
            { id: 'preview', name: 'Preview', description: 'Preview selection', shortcut: 'Alt+Space', defaultShortcut: 'Alt+Space', isCustom: false },
            { id: 'split_at_playhead', name: 'Split at Playhead', description: 'Split selected regions at playhead', shortcut: 'Ctrl+T', defaultShortcut: 'Ctrl+T', isCustom: false },
            { id: 'toggle_automation', name: 'Show/Hide Automation', description: 'Show/hide automation', shortcut: 'A', defaultShortcut: 'A', isCustom: false },
            { id: 'new_tracks', name: 'New Tracks', description: 'New tracks dialog', shortcut: 'Alt+Ctrl+N', defaultShortcut: 'Alt+Ctrl+N', isCustom: false },
            { id: 'new_audio_track', name: 'New Audio Track', description: 'New audio track', shortcut: 'Alt+Ctrl+A', defaultShortcut: 'Alt+Ctrl+A', isCustom: false },
            { id: 'new_instrument_track', name: 'New Software Instrument Track', description: 'New instrument track', shortcut: 'Alt+Ctrl+S', defaultShortcut: 'Alt+Ctrl+S', isCustom: false },
            { id: 'delete_track', name: 'Delete Track', description: 'Delete selected track', shortcut: 'Ctrl+Delete', defaultShortcut: 'Ctrl+Delete', isCustom: false },
            { id: 'import_audio', name: 'Import Audio File', description: 'Import audio file', shortcut: 'Shift+Ctrl+I', defaultShortcut: 'Shift+Ctrl+I', isCustom: false },
            { id: 'loop_regions', name: 'Loop Regions', description: 'Loop selected regions', shortcut: 'L', defaultShortcut: 'L', isCustom: false },
            { id: 'flex_tempo', name: 'Flex Tempo On/Off', description: 'Toggle flex tempo', shortcut: 'Ctrl+F', defaultShortcut: 'Ctrl+F', isCustom: false },
            { id: 'reverse', name: 'Reverse', description: 'Reverse selected region', shortcut: 'Ctrl+Shift+R', defaultShortcut: 'Ctrl+Shift+R', isCustom: false },
            { id: 'quantize', name: 'Quantize', description: 'Quantize selection', shortcut: 'Q', defaultShortcut: 'Q', isCustom: false },
            { id: 'repeat_regions', name: 'Repeat Regions', description: 'Repeat selected regions', shortcut: 'Ctrl+R', defaultShortcut: 'Ctrl+R', isCustom: false },
            { id: 'join_regions', name: 'Join Regions', description: 'Join regions', shortcut: 'Ctrl+J', defaultShortcut: 'Ctrl+J', isCustom: false },
            { id: 'transpose_up', name: 'Transpose +1', description: 'Transpose up 1 semitone', shortcut: 'Alt+ArrowUp', defaultShortcut: 'Alt+ArrowUp', isCustom: false },
            { id: 'transpose_down', name: 'Transpose -1', description: 'Transpose down 1 semitone', shortcut: 'Alt+ArrowDown', defaultShortcut: 'Alt+ArrowDown', isCustom: false },
            { id: 'move_region_right', name: 'Move Region Right', description: 'Move region right', shortcut: 'Alt+ArrowRight', defaultShortcut: 'Alt+ArrowRight', isCustom: false },
            { id: 'move_region_left', name: 'Move Region Left', description: 'Move region left', shortcut: 'Alt+ArrowLeft', defaultShortcut: 'Alt+ArrowLeft', isCustom: false },
            { id: 'mute_region', name: 'Mute Region', description: 'Mute region', shortcut: 'Ctrl+M', defaultShortcut: 'Ctrl+M', isCustom: false },
            { id: 'toggle_snap', name: 'Toggle Snap to Grid', description: 'Toggle snap', shortcut: 'Ctrl+G', defaultShortcut: 'Ctrl+G', isCustom: false },
            { id: 'bounce', name: 'Bounce', description: 'Bounce tracks', shortcut: 'Ctrl+B', defaultShortcut: 'Ctrl+B', isCustom: false },
            { id: 'cycle_mixer_modes', name: 'Cycle Mixer Modes', description: 'Cycle mixer modes', shortcut: 'Shift+X', defaultShortcut: 'Shift+X', isCustom: false },
            { id: 'select_audio_channels', name: 'Select Audio Channels', description: 'Select audio channels', shortcut: 'Shift+A', defaultShortcut: 'Shift+A', isCustom: false },
            { id: 'select_instrument_channels', name: 'Select Instrument Channels', description: 'Select Instrument channels', shortcut: 'Shift+S', defaultShortcut: 'Shift+S', isCustom: false },
            { id: 'select_aux_channels', name: 'Select Aux Channels', description: 'Select aux channels', shortcut: 'Shift+F', defaultShortcut: 'Shift+F', isCustom: false },
            { id: 'select_output_channels', name: 'Select Output Channels', description: 'Select output channels', shortcut: 'Shift+O', defaultShortcut: 'Shift+O', isCustom: false },
            { id: 'previous_channel_strip', name: 'Previous Channel Strip', description: 'Previous channel strip', shortcut: 'ArrowLeft', defaultShortcut: 'ArrowLeft', isCustom: false },
            { id: 'next_channel_strip', name: 'Next Channel Strip', description: 'Next channel strip', shortcut: 'ArrowRight', defaultShortcut: 'ArrowRight', isCustom: false },
            { id: 'create_new_aux', name: 'Create New Aux', description: 'Create new aux channel', shortcut: 'Ctrl+N', defaultShortcut: 'Ctrl+N', isCustom: false },
            { id: 'create_tracks_for_selected_channel', name: 'Create Tracks For Selected Channel', description: 'Create tracks for selected channel', shortcut: 'Ctrl+T', defaultShortcut: 'Ctrl+T', isCustom: false },
            { id: 'toggle_long_faders', name: 'Show/Hide Long Faders', description: 'Toggle long faders', shortcut: 'Ctrl+Shift+L', defaultShortcut: 'Ctrl+Shift+L', isCustom: false },
            { id: 'open_main_window', name: 'Open Main Window', description: 'Open main window', shortcut: 'Ctrl+1', defaultShortcut: 'Ctrl+1', isCustom: false },
            { id: 'open_mixer', name: 'Open Mixer', description: 'Open mixer', shortcut: 'Ctrl+2', defaultShortcut: 'Ctrl+2', isCustom: false },
            { id: 'open_step_sequencer', name: 'Open Step Sequencer', description: 'Open step sequencer', shortcut: 'Ctrl+3', defaultShortcut: 'Ctrl+3', isCustom: false },
            { id: 'open_piano_roll', name: 'Open Piano Roll', description: 'Open piano roll', shortcut: 'Ctrl+4', defaultShortcut: 'Ctrl+4', isCustom: false },
            { id: 'open_score_editor', name: 'Open Score Editor', description: 'Open score editor', shortcut: 'Ctrl+5', defaultShortcut: 'Ctrl+5', isCustom: false },
            { id: 'open_audio_file_editor', name: 'Open Audio File Editor', description: 'Open audio file editor', shortcut: 'Ctrl+6', defaultShortcut: 'Ctrl+6', isCustom: false },
            { id: 'open_event_list', name: 'Open Event List', description: 'Open event list', shortcut: 'Ctrl+7', defaultShortcut: 'Ctrl+7', isCustom: false },
            { id: 'open_project_audio', name: 'Open Project Audio', description: 'Open project audio', shortcut: 'Ctrl+8', defaultShortcut: 'Ctrl+8', isCustom: false },
            { id: 'open_transform', name: 'Open Transform', description: 'Open transform', shortcut: 'Ctrl+9', defaultShortcut: 'Ctrl+9', isCustom: false },
            { id: 'open_environment', name: 'Open Environment', description: 'Open environment', category: 'Window', shortcut: 'Ctrl+0', defaultShortcut: 'Ctrl+0', isCustom: false }
        ]
    },
    projectKeyCommands: [],
    environment: {
        layers: [
            { id: 'all-objects', name: 'All Objects', protected: true, isGlobal: false },
            { id: 'global-objects', name: 'Global Objects', protected: true, isGlobal: true },
            { id: 'layer-1', name: 'Layer 1', protected: false, isGlobal: false }
        ],
        objects: [
            { id: 'physical-input', name: 'Physical Input', type: 'PhysicalInput', layerId: 'global-objects', assignable: true, position: { x: 80, y: 80 }, size: { width: 120, height: 38 }, icon: 'input', parameters: { channel: 'All' }, connections: [] },
            { id: 'sequencer-input', name: 'Sequencer Input', type: 'SequencerInput', layerId: 'global-objects', assignable: true, position: { x: 300, y: 80 }, size: { width: 140, height: 38 }, icon: 'sequencer', parameters: { channelize: true }, connections: [] }
        ],
        selectedLayerId: 'layer-1',
        showGlobalObjects: true
    },
    zoom: 80,
    trackHeight: 70,
    snap: 'quarter',
    isDirty: false,
    muteSoloGroups: [],
    vcaFaders: [],
    loadError: null,
    controlBarSettings: {
        showViews: true, showTransport: true, showDisplay: true, showModes: true,
        viewButtons: {
            library: true, inspector: true, quickHelp: false, toolbar: true,
            smartControls: true, mixer: true, editors: true, listEditors: false,
            notePad: false, appleLoops: true, browsers: true,
            musicalTyping: true
        },
        transportButtons: {
            // Shown by default: without it the transport had no way back to bar 1.
            // Stop leaves the playhead where it is, so the next play resumed from
            // the middle of the project.
            goBeginning: true, goPosition: false, goLeftLocator: false, goRightLocator: false, goSelectionStart: false,
            playBeginning: false, playLeftEdge: false, playLeftLocator: false, playRightLocator: false, playSelection: false,
            rewind: true, forward: true, stop: true, play: true, pause: false, record: true,
            freeTempo: false, flashback: false, skipCycle: false, cycle: true
        },
        displayMode: 'Beats & Project',
        displayOptions: {
            position: true, locators: true, sampleRate: false, varispeed: false,
            tempo: true, timeSignature: true, keySignature: true, midiActivity: true, performanceMeter: true
        },
        modes: {
            sync: false, replace: true, autopunch: false, setPunchByPlayhead: false,
            softwareMonitoring: false, autoInputMonitoring: false, preFaderMetering: false,
            lowLatency: false, tuner: true, solo: true, countIn: true, metronome: true,
            masterOutput: 'Meter'
        },
        floatingWindows: { giantBeats: false, giantTime: false },
        smpteViewOffset: false,
        displayTimeAs: 'Without Bits',
        zerosAsSpaces: false,
        displayTempoAs: 'BPM',
        clockFormat: '1 1 1 1'
    },
    showAutomation: false,
    showLibrary: false,
    showInspector: false,
    showToolbar: false,
    showSmartControls: false,
    showMixer: false,
    showEditors: false,
    showListEditors: false,
    showNotePad: false,
    showLoopBrowser: false,
    showBrowsers: false,
    showLiveLoopsGrid: false,
    showTracksArea: true,
    projectFormat: 'stereo',
    surroundFormat: '5.1 (ITU 775)',
    spatialAudioMode: 'Off',
    history: [],
    future: [],
    showGlobalTracks: false,
    beatMappingMode: false,
    metronomeEnabled: true,
    freezingTrackIds: [],
    countInEnabled: false,
    countInBars: 1,
    hideViewActive: false,
    selectedTrackIds: [],
    focusedTrackId: null,
    selectedClipId: null,
    selectedClipIds: [],
    regionClipboard: [],
    selectedNoteId: null,
    selectedAutomationPointId: null,
    selectedAutomationPointIds: [],
    currentTool: 'pointer',
    contextMenu: { visible: false, x: 0, y: 0, clipId: null },
    bottomPanel: 'mixer',
    bottomPanelHeight: 320,
    showSearchAndSelect: false,
    cycleEnabled: false,
    skipCycleEnabled: false,
    locatorLeft: 32,
    locatorRight: 48,
    autoSetLocators: 'off',
    showToolsMenu: false,
    showNewTrackDialog: false,
    showCreateTrackUsing: false,
    showColorPalette: false,
    showIconBrowser: null,
    showDrumReplacement: false,
    drumReplacementTargetId: null,

    // Recording initialization
    recording: false,
    autopunchEnabled: false,
    autopunchStart: 8,
    autopunchEnd: 12,
    replaceMode: false,
    replaceModeType: 'Region Erase',
    recordingOverlappingMode: 'Create Take Folder',
    autoInputMonitoring: true,
    allowQuickPunchIn: true,
    recordingStartTime: null,
    liveRecordingClips: {},

    flashback: false,
    flashbackBuffer: [],
    flashbackDuration: 16,

    channelStripSettings: [],
    channelStripCopyBuffer: null,
    channelStripPerformances: [],

    showBounceTrackDialog: null,
    showBounceRegionsDialog: null,
    showBounceAllTracksDialog: false,
    showExportDialog: null,
    showSettingsDialog: false,
    settingsActiveTab: 'General',
    settingsActiveSubTab: '',
    showShareDialog: false,
    showNoteRepeatDialog: false,
    showSpotEraseDialog: false,
    noteRepeatSettings: {
        enabled: false,
        rate: '1/16',
        velocity: 'As played',
        gate: 100,
        keyRemote: true,
        onOffButton: false
    },
    spotEraseSettings: {
        enabled: false,
        onOffButton: false
    },
    showStepInputKeyboard: false,
    stepInputSettings: {
        length: '1/16',
        velocity: 'mf',
        triplet: false,
        dot: false,
        sustain: false,
        chord: false,
        quantize: false
    },
    showVirtualKeyboard: false,
    virtualKeyboardMode: 'musical-typing',
    virtualKeyboardOctave: 3,
    virtualKeyboardVelocity: 80,
    virtualKeyboardPitchBend: 0,
    virtualKeyboardModulation: 0,
    virtualKeyboardSustain: false,
    showTrackHeaderConfig: false,
    trackHeaderWidth: 280,
    openPluginEditor: null,
    hoveredHelpId: null,
    trackHeaderConfig: {
        showMute: true,
        showSolo: true,
        showRecord: true,
        showInput: true,
        showProtect: false,
        showFreeze: false,
        showOnOff: true,
        showVolume: true,
        showPan: true,
        showTrackNumbers: true,
        showColorBars: true,
        showTrackIcons: true,
        showAlternatives: false,
        showHide: true,
    },
    draggedItems: null,
    dragPosition: null,
    dropTargetTrackId: null,
    newTrackDefaults: {
        mainCategory: 'Session Player',
        subOption: 'Keyboard Player'
    },
    librarySearchQuery: '',
    libraryPatchMerging: false,
    libraryMergingOptions: {
        midiEffects: true,
        instruments: true,
        audioEffects: true,
        sends: true
    },
    librarySelectedPresetId: null,

    articulationSets: [],
    showArticulationEditor: false,
    editingArticulationSetId: null,

    recentProjects: [
        { id: 'demo-1', name: 'Neon Sunset', lastOpened: Date.now() - 3600000 * 2, previewColor: 'from-indigo-900/40 to-purple-900/40', tempo: 120 },
        { id: 'demo-2', name: 'Acoustic Idea', lastOpened: Date.now() - 3600000 * 24, previewColor: 'from-emerald-900/40 to-teal-900/40', tempo: 95 },
    ],
    demoProjects: [
        { id: 'demo-1', name: 'Neon Sunset', description: 'Synthwave production demo', previewColor: 'from-indigo-900/40 to-purple-900/40' },
        { id: 'beck-morning', name: 'Beck - Morning', description: 'Multi-track vocal and acoustic demo', previewColor: 'from-orange-900/40 to-yellow-900/40' },
        { id: 'ocean-eyes', name: 'Billie Eilish - Ocean Eyes', description: 'Minimalist pop production', previewColor: 'from-blue-900/40 to-cyan-900/40' }
    ],

    showSelectionBasedProcessing: false,
    marqueeSelection: null,
    showAudioTrackEditor: false,
    audioTrackEditorTrackId: null,
    audioTrackEditorZoom: 1,
    audioTrackEditorHeight: 220,
    audioTrackEditorWaveformZoom: 1,
    pianoRollLinkMode: 'single',
    pianoRollFocusClipId: null,
    sbpState: {
        setA: [],
        setB: [
            { id: 'sbp-eq', pluginId: 'eq', name: 'Graphic EQ', enabled: true, params: {} },
            { id: 'sbp-bit', pluginId: 'bitcrusher', name: 'Bitcrusher', enabled: true, params: {} },
            { id: 'sbp-chroma', pluginId: 'reverb', name: 'Chroma', enabled: true, params: {} },
        ],
        activeSet: 'A',
        splitAtMarqueeBorders: false,
        createNewTake: false,
        addEffectTail: false,
        gainMode: 'No Change',
        previewVolume: 0.8,
        previewEnablesSolo: true,
        previewEnablesCycle: false,
    },

    play: () => {
        const { clips, playhead, metronomeEnabled, tracks, globalTracks, settings, recording } = get();
        set({ playing: true });
        const currentTempoIdx = globalTracks.tempo.reduce((prev, curr, idx) => curr.time <= playhead ? idx : prev, 0);
        // A project restored with an empty tempo track would otherwise index undefined.
        const activeTempo = typeof globalTracks.tempo[currentTempoIdx]?.value === 'number' ? globalTracks.tempo[currentTempoIdx].value as number : 120;
        audioEngine.setTempo(activeTempo);
        syncMetronome(settings, metronomeEnabled, recording ? 'record' : 'play');
        tracks.forEach(t => {
            audioEngine.getTrackNodes(t.id);
            audioEngine.updateFXChain(t.id, t.plugins);
            if (t.outputBusId.startsWith('stack-')) {
                const parentTrack = tracks.find(pt => pt.id === t.outputBusId);
                if (parentTrack) audioEngine.routeTrackToTrack(t.id, parentTrack.id);
            }
        });
        // routing and track-level mix state (mute/solo)
        const anySolo = tracks.some(t => t.soloed);
        tracks.forEach(t => {
            if (t.outputBusId && t.outputBusId !== 'stereo-out') {
                const parent = tracks.find(p => p.id === t.outputBusId);
                if (parent) {
                    audioEngine.routeTrackToTrack(t.id, parent.id);
                }
            } else if (t.parentId) {
                const parent = tracks.find(p => p.id === t.parentId);
                if (parent) {
                    audioEngine.routeTrackToTrack(t.id, parent.id);
                }
            }

            // sends
            if (t.sends?.length) {
                t.sends.forEach(send => {
                    const busTrack = tracks.find(bt => bt.id === send.busId);
                    if (busTrack) {
                        audioEngine.routeTrackToBus(t.id, send.busId, send.level);
                    }
                });
            }

            audioEngine.updateTrackParams(t.id, t.muted ? 0 : t.volume, t.pan);
        });

        if (playhead > 0) get().chaseEvents(playhead);

        // Both audio and MIDI clips are scheduled by useAudioPlayer via
        // advancedScheduler, which sequences MIDI notes across the whole region.
        // This used to call audioEngine.playRegion() once per clip, which fired
        // only the notes sounding under the playhead at this instant — so MIDI
        // regions never actually played.


        // One transport loop at a time. `play()` is reachable from the button,
        // the spacebar and the count-in, and each call used to spawn another
        // requestAnimationFrame chain that never exited while playing.
        const generation = ++transportLoopGeneration;

        const loop = () => {
            if (!get().playing) return;
            if (generation !== transportLoopGeneration) return;
            const state = get();
            const { playhead, globalTracks, cycleEnabled, skipCycleEnabled, locatorLeft, locatorRight, recording, autopunchEnabled, autopunchStart, autopunchEnd, liveRecordingClips, focusedTrackId } = state;
            
            const newIdx = globalTracks.tempo.reduce((p, c, i) => c.time <= playhead ? i : p, 0);
            const currentTempo = typeof globalTracks.tempo[newIdx]?.value === 'number' ? globalTracks.tempo[newIdx].value as number : 120;

            // Follow the audio clock. The scheduler derives this beat from
            // AudioContext.currentTime — the same value it schedules notes
            // against — so the visible playhead cannot drift from what is
            // heard. Accumulating a per-frame increment (the previous
            // approach) drifts whenever the frame rate deviates from 60fps.
            const engineBeat = audioEngine.isPlaying ? audioEngine.getCurrentBeat() : NaN;
            // Before the scheduler is armed there is no audio clock to read.
            // Hold position rather than accumulating frames: arming is async
            // (buffers have to decode first), and a playhead that advanced
            // during that gap was the value handed to `startPlayback`, so
            // playback began past where the user pressed play. Repeated over
            // several plays the start beat walked off the end of the project
            // and nothing sounded. Waiting a few frames is invisible; drifting
            // is not.
            let nextPlayhead = Number.isFinite(engineBeat) && engineBeat >= 0
                ? engineBeat
                : playhead;


            const wrapped = (skipCycleEnabled && nextPlayhead >= locatorLeft && playhead < locatorLeft) || (cycleEnabled && !skipCycleEnabled && nextPlayhead >= locatorRight);
            if (skipCycleEnabled && nextPlayhead >= locatorLeft && playhead < locatorLeft) nextPlayhead = locatorRight;
            else if (cycleEnabled && !skipCycleEnabled && nextPlayhead >= locatorRight) nextPlayhead = locatorLeft;

            if (wrapped) {
                audioEngine.seekTo(nextPlayhead);
            }

            set({ playhead: nextPlayhead });
            if (recording && nextPlayhead < playhead) {
                set({ liveRecordingClips: {} });
            }

            // --- Real-time Recording Logic ---
            if (recording) {
                const isWithinPunchRange = !autopunchEnabled || (nextPlayhead >= autopunchStart && nextPlayhead <= autopunchEnd);
                
                const recEnabledTracks = state.tracks.filter(t => t.recordEnabled || (t.id === focusedTrackId && !state.tracks.some(rt => rt.recordEnabled)));
                
                recEnabledTracks.forEach(track => {
                    const existingClipId = liveRecordingClips[track.id];
                    const startTime = nextPlayhead;

                    if (isWithinPunchRange) {
                        if (!existingClipId) {
                            const newClipId = `rec-${Date.now()}-${track.id}`;
                            const newClip: Clip = {
                                id: newClipId,
                                trackId: track.id,
                                name: `${track.name} Recording`,
                                start: startTime,
                                duration: 0.1,
                                type: recordedClipType(track.type),
                                color: track.color,
                                muted: false,
                                loop: false,
                                qSwing: 0,
                                transpose: 0,
                                velocityOffset: 0
                            } as any;

                            const overlapMode = state.recordingOverlappingMode;
                            if (overlapMode === 'Create Take Folder' && track.type === 'audio') {
                                const existingFolder = state.clips.find(c => c.trackId === track.id && c.isTakeFolder && c.start <= startTime && startTime < (c.start + c.duration));
                                if (existingFolder) {
                                    set(s => ({
                                        clips: s.clips.map(c => {
                                            if (c.id !== existingFolder.id) return c;
                                            const existingTakes = c.takes || [];
                                            const newTakes = [...existingTakes, { ...newClip }];
                                            const folderDuration = Math.max(...newTakes.map(t => (t.start + t.duration))) - c.start;
                                            return {
                                                ...c,
                                                takes: newTakes,
                                                activeTakeIndex: newTakes.length - 1,
                                                duration: Math.max(c.duration, folderDuration)
                                            };
                                        }),
                                        liveRecordingClips: { ...s.liveRecordingClips, [track.id]: newClipId }
                                    }));
                                    return;
                                }

                                const overlappingClip = state.clips.find(c => c.trackId === track.id && !c.isTakeFolder && c.start < (startTime + 0.001) && (c.start + c.duration) > startTime);
                                if (overlappingClip) {
                                    const folderClip: Clip = {
                                        id: `takefolder-${Date.now()}-${track.id}`,
                                        trackId: track.id,
                                        name: `${track.name} Take Folder`,
                                        color: '#84cc16',
                                        type: 'audio',
                                        start: Math.min(overlappingClip.start, newClip.start),
                                        duration: Math.max(overlappingClip.start + overlappingClip.duration, newClip.start + newClip.duration) - Math.min(overlappingClip.start, newClip.start),
                                        offset: overlappingClip.offset || 0,
                                        isTakeFolder: true,
                                        isTakeFolderOpen: true,
                                        quickSwipeComping: true,
                                        activeTakeIndex: 1,
                                        muted: false,
                                        loop: false,
                                        qSwing: 0,
                                        transpose: 0,
                                        velocityOffset: 0,
                                        takes: [
                                            { ...overlappingClip },
                                            { ...newClip }
                                        ]
                                    } as any;

                                    set(s => ({
                                        clips: [...s.clips.filter(c => c.id !== overlappingClip.id), folderClip],
                                        liveRecordingClips: { ...s.liveRecordingClips, [track.id]: newClipId }
                                    }));
                                    return;
                                }
                            }

                            // default behavior: append clip
                            set(s => ({
                                clips: [...s.clips, newClip],
                                liveRecordingClips: { ...s.liveRecordingClips, [track.id]: newClipId }
                            }));
                        } else {
                            set(s => ({
                                clips: s.clips.map(c => {
                                    if (c.id === existingClipId) {
                                        return { ...c, duration: nextPlayhead - c.start };
                                    }
                                    if (c.isTakeFolder && c.takes) {
                                        const takeIndex = c.takes.findIndex(t => t.id === existingClipId);
                                        if (takeIndex !== -1) {
                                            const updatedTakes = c.takes.map(t => t.id === existingClipId ? { ...t, duration: nextPlayhead - t.start } : t);
                                            const folderStart = c.start;
                                            const folderEnd = Math.max(...updatedTakes.map(t => t.start + t.duration));
                                            return {
                                                ...c,
                                                takes: updatedTakes,
                                                duration: Math.max(c.duration, folderEnd - folderStart)
                                            };
                                        }
                                    }
                                    return c;
                                })
                            }));
                        }
                    } else if (existingClipId) {
                        const { [track.id]: _, ...remaining } = state.liveRecordingClips;
                        set({ liveRecordingClips: remaining });
                    }
                });
            }

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    stop: () => {
        const s = get();
        cancelCountIn();
        if (s.recording) {
            // Finalize recordings
            set({ recording: false });
        }
        if (s.playing) {
            set({ playing: false, recording: false, recordingStartTime: null, liveRecordingClips: {} });
            audioEngine.stopAll();
            syncMetronome(s.settings, s.metronomeEnabled, 'stop');
        }
        else { set({ playhead: 0 }); }
    },

    setTempo: (bpm) => {
        set(s => {
            const existing = s.globalTracks?.tempo ?? [];
            const idx = existing.reduce((p, c, i) => c.time <= s.playhead ? i : p, 0);
            const updated = [...existing];
            if (updated[idx] && updated[idx].time <= s.playhead) {
                updated[idx] = { ...updated[idx], value: bpm };
            } else {
                updated.push({ time: s.playhead, value: bpm, type: 'jump' });
                updated.sort((a, b) => a.time - b.time);
            }
            return { tempo: bpm, globalTracks: { ...s.globalTracks, tempo: updated } };
        });
        audioEngine.setTempo(bpm);
    },

    /**
     * Set the project's time signature, e.g. "4/4".
     *
     * `timeSignature` and `keySignature` are top-level state read by the piano
     * roll, the ruler and the metronome, but `updateProjectSettings` only ever
     * merged into `settings` — so neither could be changed after the project
     * was created. Malformed input is ignored rather than left to blow up
     * `timeSignature.split('/')` downstream.
     */
    setTimeSignature: (signature) => {
        const match = /^(\d{1,2})\/(1|2|4|8|16|32)$/.exec(signature.trim());
        if (!match) {
            console.warn(`[Project] Ignoring malformed time signature "${signature}"`);
            return;
        }
        const numerator = Number(match[1]);
        if (numerator < 1 || numerator > 32) return;

        set({ timeSignature: `${numerator}/${match[2]}`, isDirty: true });

        // The metronome accents beat 1, so it has to know the new bar length.
        const { settings, metronomeEnabled, playing, recording } = get();
        if (playing) syncMetronome(settings, metronomeEnabled, recording ? 'record' : 'play');
    },

    setKeySignature: (key) => {
        const trimmed = key.trim();
        if (!trimmed) return;
        set({ keySignature: trimmed, isDirty: true });
    },

    movePlayhead: (position) => {
        if (get().playing) get().stop();
        set({ playhead: position });
    },

    addAlternative: (name) => set(s => {
        const newAlt: ProjectAlternative = { id: Date.now().toString(), name, createdAt: Date.now(), tracks: JSON.parse(JSON.stringify(s.tracks)), clips: JSON.parse(JSON.stringify(s.clips)) };
        return { alternatives: [...s.alternatives, newAlt], currentAlternativeId: newAlt.id };
    }),

    switchToAlternative: (id) => set(s => {
        const alt = s.alternatives.find(a => a.id === id);
        if (!alt) return {};
        return { tracks: alt.tracks, clips: alt.clips, currentAlternativeId: id };
    }),

    createTrackStack: (trackIds, type) => set(s => {
        const stackId = `stack-${Date.now()}`;
        const newTrack: Track = {
            id: stackId, name: type === 'Summing' ? 'Summing Stack' : 'Folder Stack', type: 'bus', isStack: true, stackType: type, muted: false, soloed: false, volume: 1, pan: 0, color: '#555', orderIndex: Math.min(...trackIds.map(tid => s.tracks.findIndex(t => t.id === tid))),
            recordEnabled: false, inputMonitoring: false,
            protected: false, frozen: false, enabled: true,
            freezeMode: 'Source Only',
            alternatives: [{ id: 'alt-1', name: 'A' }],
            activeAlternativeId: 'alt-1',
            showInactiveAlternatives: false,
            transpose: 0, velocityOffset: 0, delay: 0, plugins: [], sends: [], outputBusId: 'stereo-out', zoom: 1,
            hidden: false,
            isCollapsed: false,
            isGrooveTrack: false,
            matchGrooveTrack: false
        };
        const updatedTracks = s.tracks.map(t => trackIds.includes(t.id) ? { ...t, parentId: stackId, outputBusId: type === 'Summing' ? stackId : t.outputBusId } : t);
        updatedTracks.splice(newTrack.orderIndex, 0, newTrack);
        return { tracks: updatedTracks };
    }),

    flattenStack: (stackId) => set(s => ({ tracks: s.tracks.filter(t => t.id !== stackId).map(t => t.parentId === stackId ? { ...t, parentId: undefined, outputBusId: 'stereo-out' } : t) })),

    /**
     * Add a marker. `duration` makes it a section *region* rather than a point,
     * which is what an arrangement map needs — it used to hardcode 4 beats, so
     * every section marker claimed exactly one bar regardless of the section.
     */
    addMarker: (time, text, duration = 4) => set(s => ({
        globalTracks: {
            ...s.globalTracks,
            markers: [
                ...s.globalTracks.markers,
                { id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, time, duration, text, color: '#fbc02d' },
            ],
        },
    })),

    toggleBeatMapping: () => set(s => ({ beatMappingMode: !s.beatMappingMode })),

    addBeatMappingEntry: (clipId, sourceTime, targetTime, noteId) => set(s => {
        const entry = { id: `bm-${Date.now()}-${Math.random()}`, clipId, sourceTime, targetTime, noteId };
        const beatMapping = [...(s.globalTracks.beatMapping || []), entry];
        return { globalTracks: { ...s.globalTracks, beatMapping } };
    }),

    removeBeatMappingEntry: (entryId) => set(s => ({ globalTracks: { ...s.globalTracks, beatMapping: s.globalTracks.beatMapping.filter(e => e.id !== entryId) } })),

    clearBeatMapping: () => set(s => ({ globalTracks: { ...s.globalTracks, beatMapping: [] } })),

    applyBeatMappingToTempo: () => set(s => {
        const mappings = [...(s.globalTracks.beatMapping || [])].sort((a, b) => a.targetTime - b.targetTime);
        const baseTempo = typeof s.globalTracks.tempo[0]?.value === 'number' ? s.globalTracks.tempo[0].value as number : s.tempo;
        let lastSource = 0;
        let lastTarget = 0;
        let lastTempo = baseTempo;
        const tempoPoints = [...s.globalTracks.tempo];

        mappings.forEach(mapping => {
            const sourceDelta = Math.max(0.001, mapping.sourceTime - lastSource);
            const targetDelta = Math.max(0.001, mapping.targetTime - lastTarget);
            const ratio = sourceDelta / targetDelta;
            const newTempo = Math.min(300, Math.max(20, lastTempo * ratio));
            tempoPoints.push({ time: mapping.targetTime, value: newTempo, type: 'jump' });
            lastSource = mapping.sourceTime;
            lastTarget = mapping.targetTime;
            lastTempo = newTempo;
        });

        tempoPoints.sort((a, b) => a.time - b.time);
        return { globalTracks: { ...s.globalTracks, tempo: tempoPoints } };
    }),

    updateTempoPoint: (index, updates) => set(s => {
        const newTempo = [...s.globalTracks.tempo];
        newTempo[index] = { ...newTempo[index], ...updates };
        return { globalTracks: { ...s.globalTracks, tempo: newTempo } };
    }),

    updateControlBar: (updates) => set(s => ({ controlBarSettings: { ...s.controlBarSettings, ...updates } })),

    toggleFloatingWindow: (type) => set(s => ({ controlBarSettings: { ...s.controlBarSettings, floatingWindows: { ...s.controlBarSettings.floatingWindows, [type]: !s.controlBarSettings.floatingWindows[type] } } })),

    toggleNewTrackDialog: (show) => set(s => ({ showNewTrackDialog: show !== undefined ? show : !s.showNewTrackDialog })),

    setNewTrackDefaults: (updates) => set(s => ({ newTrackDefaults: { ...s.newTrackDefaults, ...updates } })),

    toggleCreateTrackUsing: (show, items) => set({ showCreateTrackUsing: show, draggedItems: items || null }),

    createTrackFromSamplerType: (type, items) => {
        const { addTrack, addClip } = get();
        const colors = { 'Quick Sampler (Original)': '#63ed63', 'Quick Sampler (Optimized)': '#63ed63', 'Drum Machine Designer': '#fbbf24', 'Sample Alchemy': '#a78bfa', 'Sampler (Zone Per Note)': '#34d399' };
        items.forEach((item, idx) => {
            const trackId = Date.now().toString() + idx;
            addTrack({ id: trackId, name: `${type} ${idx + 1}`, type: 'software-instrument', color: colors[type] || '#888', icon: (type === 'Drum Machine Designer' ? 'drum' : 'keyboard'), hidden: false } as any);
            addClip({ id: `clip-${trackId}`, trackId, name: item.name || 'Sample Region', start: 0, duration: 8, type: 'midi', color: colors[type] || '#888' } as any);
        });
        set({ showCreateTrackUsing: false, draggedItems: null });
    },

    /*
     * Mute/solo groups.
     *
     * Each action rebuilds a manager from stored state, calls it, then writes
     * both the group list and the affected tracks back. The manager is the
     * logic; the store stays the single source of truth, so groups persist with
     * the project and cannot drift from what the mixer shows.
     */
    /*
     * VCA faders.
     *
     * The gain is applied by re-sending each member's volume to the audio
     * engine scaled by the VCA, rather than by rewriting the track's stored
     * volume. Rewriting it would make the VCA destructive: pull a VCA down and
     * back up and every member's own fader would have been overwritten.
     */
    createVcaFader: (name, trackIds = []) => set(s => ({
        vcaFaders: [...s.vcaFaders, {
            id: `vca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            gain: 0,
            color: NEON_TRACK_PALETTE[s.vcaFaders.length % NEON_TRACK_PALETTE.length],
            trackIds: [...trackIds],
        }],
        isDirty: true,
    })),

    deleteVcaFader: (vcaId) => {
        const vca = get().vcaFaders.find(v => v.id === vcaId);
        set(s => ({ vcaFaders: s.vcaFaders.filter(v => v.id !== vcaId), isDirty: true }));
        // Restore the members to their own fader positions.
        if (vca) get().applyVcaGains(vca.trackIds);
    },

    setVcaFaderTracks: (vcaId, trackIds) => {
        const before = get().vcaFaders.find(v => v.id === vcaId)?.trackIds ?? [];
        set(s => ({
            vcaFaders: s.vcaFaders.map(v => (v.id === vcaId ? { ...v, trackIds: [...trackIds] } : v)),
            isDirty: true,
        }));
        get().applyVcaGains([...new Set([...before, ...trackIds])]);
    },

    setVcaFaderGain: (vcaId, gainDb) => {
        set(s => ({
            vcaFaders: s.vcaFaders.map(v => (v.id === vcaId ? { ...v, gain: gainDb } : v)),
            isDirty: true,
        }));
        const vca = get().vcaFaders.find(v => v.id === vcaId);
        if (vca) get().applyVcaGains(vca.trackIds);
    },

    /** Push each track's own volume, scaled by every VCA controlling it. */
    applyVcaGains: (trackIds) => {
        const { tracks, vcaFaders } = get();
        const targets = trackIds ?? tracks.map(t => t.id);
        for (const trackId of targets) {
            const track = tracks.find(t => t.id === trackId);
            if (!track) continue;
            const totalDb = vcaFaders
                .filter(v => v.trackIds.includes(trackId))
                .reduce((sum, v) => sum + v.gain, 0);
            const scaled = (track.volume ?? 1) * Math.pow(10, totalDb / 20);
            try {
                audioEngine.setTrackVolume(trackId, Math.max(0, Math.min(2, scaled)));
            } catch { /* engine not ready yet */ }
        }
    },

    createMuteSoloGroup: (name, trackIds = []) => set(s => {
        const mgr = new MuteSoloGroupManager();
        mgr.setState({ groups: s.muteSoloGroups.map(g => ({ ...g })) });
        const group = mgr.createGroup(name);
        if (!group) return {};
        for (const id of trackIds) mgr.addTrackToGroup(group.id, id);
        return { muteSoloGroups: [...mgr.getState().groups], isDirty: true };
    }),

    deleteMuteSoloGroup: (groupId) => set(s => {
        const mgr = new MuteSoloGroupManager();
        mgr.setState({ groups: s.muteSoloGroups.map(g => ({ ...g })) });
        if (!mgr.deleteGroup(groupId)) return {};
        return { muteSoloGroups: [...mgr.getState().groups], isDirty: true };
    }),

    setMuteSoloGroupTracks: (groupId, trackIds) => set(s => ({
        muteSoloGroups: s.muteSoloGroups.map(g =>
            g.id === groupId ? { ...g, trackIds: [...trackIds] } : g
        ),
        isDirty: true,
    })),

    toggleMuteSoloGroupMute: (groupId) => set(s => {
        const mgr = new MuteSoloGroupManager();
        mgr.setState({ groups: s.muteSoloGroups.map(g => ({ ...g })) });
        const group = mgr.getGroup(groupId);
        if (!group) return {};
        const affected = new Set(mgr.muteGroup(groupId, !group.muted));
        const muted = !group.muted;
        return {
            muteSoloGroups: [...mgr.getState().groups],
            tracks: s.tracks.map(t => (affected.has(t.id) ? { ...t, muted } : t)),
            isDirty: true,
        };
    }),

    toggleMuteSoloGroupSolo: (groupId) => set(s => {
        const mgr = new MuteSoloGroupManager();
        mgr.setState({ groups: s.muteSoloGroups.map(g => ({ ...g })) });
        const group = mgr.getGroup(groupId);
        if (!group) return {};
        const affected = new Set(mgr.soloGroup(groupId, !group.soloed));
        const soloed = !group.soloed;
        return {
            muteSoloGroups: [...mgr.getState().groups],
            tracks: s.tracks.map(t => (affected.has(t.id) ? { ...t, soloed } : t)),
            isDirty: true,
        };
    }),

    saveProject: async () => {
        const state = get();
        const { id, name, tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = state;

        // Local save to IndexedDB first (fast, offline-capable)
        if (id && typeof window !== 'undefined') {
            try {
                const serialized = serializeStoreState(get);
                await saveToIndexedDB(id, serialized);
            } catch (e) {
                console.warn('[Persistence] Local save failed:', e);
            }
        }

        // Remote save to server API
        try {
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));
            const res = await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    name,
                    tempo,
                    timeSignature,
                    keySignature,
                    projectFormat,
                    surroundFormat,
                    spatialAudioMode,
                    tracks: nestedTracks,
                    globalTracks,
                    settings,
                    currentAlternativeId,
                    alternatives,
                    globalSettings,
                    environment
                })
            });
            if (!res.ok) throw new Error(`Save failed: ${res.status}`);
            const apiResponse = await res.json();
            set({ id: apiResponse.id, isDirty: false });
        } catch (error) { console.error(error); throw error; }
    },

    saveAs: async (data) => {
        const state = get();
        const { tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = state;
        try {
            const newId = `proj-${Date.now()}`;
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));
            set({ id: newId, name: data.name });

            // Local save first
            if (typeof window !== 'undefined') {
                const serialized = serializeStoreState(get);
                saveToIndexedDB(newId, serialized).catch((e: any) =>
                    console.warn('[Persistence] Local saveAs failed:', e)
                );
            }

            // Remote save
            const res = await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: newId,
                    name: data.name,
                    tempo,
                    timeSignature,
                    keySignature,
                    projectFormat,
                    surroundFormat,
                    spatialAudioMode,
                    tracks: nestedTracks,
                    globalTracks,
                    settings,
                    currentAlternativeId,
                    alternatives,
                    globalSettings,
                    environment
                })
            });
            if (!res.ok) throw new Error(`Save failed: ${res.status}`);
            const result = await res.json();
            set({ id: result.id, isDirty: false });
        } catch (error) { console.error(error); throw error; }
    },

    saveCopyAs: async (data) => {
        const state = get();
        const { tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = state;
        try {
            const copyId = `copy-${Date.now()}`;
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));

            // Local save
            if (typeof window !== 'undefined') {
                const tempState = { ...serializeStoreState(get), id: copyId, name: data.name };
                await saveToIndexedDB(copyId, tempState);
            }

            await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: copyId,
                    name: data.name,
                    tempo,
                    timeSignature,
                    keySignature,
                    projectFormat,
                    surroundFormat,
                    spatialAudioMode,
                    tracks: nestedTracks,
                    globalTracks,
                    settings,
                    currentAlternativeId,
                    alternatives,
                    globalSettings,
                    environment,
                    isCopy: true
                })
            });
        } catch (error) { console.error(error); }
    },

    saveAsTemplate: async (name) => { console.log("Template saved:", name); },

    revertTo: (version) => { console.log("Reverting..."); },

    loadProject: async (projectId) => {
        get().loadGlobalSettings();
        let loaded = false;

        // If the requested project is already in memory (e.g. just created from
        // a template before autosave persisted it), keep it — the engine is
        // already wired and a reload would race the pending autosave.
        const inMemory = get();
        if (inMemory.id === projectId && (inMemory.tracks?.length || inMemory.clips?.length)) {
            loaded = true;
        }

        // Try IndexedDB first (fast, offline-capable).
        //
        // Skipped when the guard above matched. It used to run regardless, so
        // the `loaded` flag only ever protected the API fallback below: a
        // project just built in memory was overwritten by whatever IndexedDB
        // held for its id. For a new blank project that was an empty snapshot
        // autosave had written between `initializeProject` and `addTrack`, so
        // both starter tracks were wiped on the way into the studio.
        if (!loaded && typeof window !== 'undefined') {
            try {
                const persisted = await loadFromIndexedDB(projectId);
                if (persisted && persisted.state) {
                    const restored = deserializeState(persisted.state);
                    set({ globalSettings: { ...get().globalSettings, ...restored.globalSettings } });
                    set(restored);

                    const result = await rebuildEngine({
                        tracks: restored.tracks || [],
                        clips: restored.clips || [],
                        masterPlugins: restored.masterPlugins || [],
                        tempo: restored.tempo || 120,
                        projectFormat: restored.projectFormat,
                        surroundFormat: restored.surroundFormat,
                        spatialAudioMode: restored.spatialAudioMode,
                    });

                    if (!result.success) {
                        console.warn('[Persistence] Engine rebuild had issues:', result.errors);
                    }
                    loaded = true;
                    console.log(`[Persistence] Loaded project from IndexedDB: ${projectId}`);
                }
            } catch (e) {
                console.warn('[Persistence] IndexedDB load failed, falling back to API:', e);
            }
        }

        // Fallback to server API
        if (!loaded) {
            try {
                const resp = await fetch(`/api/project/${projectId}`);
                if (resp.ok) {
                    const data = await resp.json();
                    const tracks = data.tracks || [];
                    const clips = tracks.flatMap((t: any) => (t.clips || []).map((c: any) => ({ ...c, trackId: t.id })));

                    if (data.globalSettings) {
                        set({ globalSettings: { ...get().globalSettings, ...data.globalSettings } });
                    }

                    set({
                        id: data.id,
                        name: data.name,
                        tempo: data.tempo,
                        projectFormat: data.projectFormat || get().projectFormat,
                        surroundFormat: data.surroundFormat || get().surroundFormat,
                        spatialAudioMode: data.spatialAudioMode || get().spatialAudioMode,
                        tracks: tracks.map((t: any) => { const { clips, ...trackData } = t; return trackData; }),
                        clips,
                        globalTracks: { ...get().globalTracks, ...(data.globalTracks ?? {}) },
                        // Merge rather than replace: a stored payload may predate
                        // fields the engine now requires (masterVolume, metronome,
                        // …), and dropping them hands undefined to AudioParams.
                        settings: { ...get().settings, ...(data.settings ?? {}) },
                        globalSettings: { ...get().globalSettings, ...(data.globalSettings ?? {}) },
                        environment: data.environment || get().environment,
                        alternatives: data.alternatives || [],
                        currentAlternativeId: data.currentAlternativeId || null
                    });

                    const result = await rebuildEngine({
                        tracks: tracks.map((t: any) => { const { clips, ...trackData } = t; return trackData; }),
                        clips,
                        masterPlugins: data.masterPlugins || [],
                        tempo: data.tempo || 120,
                        projectFormat: data.projectFormat,
                        surroundFormat: data.surroundFormat,
                        spatialAudioMode: data.spatialAudioMode,
                    });

                    if (!result.success) {
                        console.warn('[Persistence] Engine rebuild had issues:', result.errors);
                    }
                    loaded = true;
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (!loaded) {
            console.warn(`[Persistence] Failed to load project: ${projectId}`);
            set({ loadError: `Project "${projectId}" not found. It may have been deleted.` });
        }
    },

    closeProject: () => {
        const s = get();
        // Save to IndexedDB before closing if dirty
        if (s.id && s.isDirty && typeof window !== 'undefined') {
            const serialized = serializeStoreState(get);
            saveToIndexedDB(s.id, serialized).catch((e: any) =>
                console.warn('[Persistence] Close save failed:', e)
            );
        }
        set({ id: null, name: 'Untitled Project', tracks: [], clips: [], isDirty: false, loadError: null, playing: false, playhead: 0, history: [], future: [] });
    },

    setDirty: (dirty) => set({ isDirty: dirty }),

    saveHistorySnapshot: () => {
        const state = get();
        const snapshot = createHistorySnapshot(state);
        const size = estimatedSize(snapshot);
        if (size > MAX_SNAPSHOT_SIZE) {
            console.warn('[History] Snapshot too large, skipping:', (size / 1024).toFixed(1) + 'KB');
            return;
        }
        set(s => {
            const nextHistory = [...(s.history || []), snapshot];
            if (nextHistory.length > MAX_HISTORY) nextHistory.shift();
            console.debug('[History] snapshot', (size / 1024).toFixed(1) + 'KB', 'history:', nextHistory.length);
            return { history: nextHistory, future: [] };
        });
    },

    undo: () => {
        const { history, future } = get();
        if (!history || history.length === 0) return;
        const lastState = history[history.length - 1];
        const prevHistory = history.slice(0, -1);
        const currentSnapshot = createHistorySnapshot(get());
        set({ ...lastState, history: prevHistory, future: [...(future || []), currentSnapshot] });
    },

    redo: () => {
        const { history, future } = get();
        if (!future || future.length === 0) return;
        const nextState = future[future.length - 1];
        const nextFuture = future.slice(0, -1);
        const currentSnapshot = createHistorySnapshot(get());
        const nextHistory = [...(history || []), currentSnapshot];
        if (nextHistory.length > MAX_HISTORY) nextHistory.shift();
        set({ ...nextState, history: nextHistory, future: nextFuture });
    },

    importLegacyProject: (legacyData) => {
        const migration = {
            id: legacyData.id || `proj-${Date.now()}`,
            name: legacyData.name || 'Legacy Project',
            tempo: legacyData.tempo || 120,
            timeSignature: legacyData.timeSignature || '4/4',
            keySignature: legacyData.keySignature || 'C Major',
            projectFormat: legacyData.projectFormat || 'stereo',
            surroundFormat: legacyData.surroundFormat || '5.1 (ITU 775)',
            spatialAudioMode: legacyData.spatialAudioMode || 'Off',
            tracks: legacyData.tracks?.map((t: any) => ({
                ...t,
                id: t.id || `track-${Date.now()}-${Math.random()}`,
            })) || [],
            clips: legacyData.clips || [],
            globalTracks: legacyData.globalTracks || {
                tempo: [{ time: 0, value: legacyData.tempo || 120, type: 'jump' }],
                markers: legacyData.markers || [],
                signature: legacyData.signature || [{ time: 0, numerator: 4, denominator: 4 }],
                key: legacyData.key || [{ time: 0, root: 'C', mode: 'major' }],
                beatMapping: legacyData.beatMapping || []
            },
            settings: { ...get().settings, ...(legacyData.settings ?? {}) },
            globalSettings: { ...get().globalSettings, ...(legacyData.globalSettings ?? {}) },
            environment: legacyData.environment || get().environment,
            alternatives: legacyData.alternatives || [],
            currentAlternativeId: legacyData.currentAlternativeId || null
        };

        set({
            ...migration,
            history: [],
            future: [],
            isDirty: true
        });
    },

    addTrack: (track) => {
        get().saveHistorySnapshot();
        set(s => ({
            tracks: [...s.tracks, buildNewTrack(track, s.tracks.length)],
            isDirty: true,
        }));
    },

    /**
     * Add several tracks in one update.
     *
     * Not a convenience: anything that subscribes to the store — autosave
     * above all — observes the state between two `addTrack` calls. A new blank
     * project was persisted after its first track and restored from that
     * snapshot, losing the second.
     */
    addTracks: (newTracks) => {
        if (!newTracks.length) return;
        get().saveHistorySnapshot();
        set(s => ({
            tracks: [...s.tracks, ...newTracks.map((t, i) => buildNewTrack(t, s.tracks.length + i))],
            isDirty: true,
        }));
    },

    duplicateWithSharedChannelStrip: (id) => set(s => {
        const original = s.tracks.find(t => t.id === id);
        if (!original) return {};
        const newTrack: Track = {
            ...JSON.parse(JSON.stringify(original)),
            id: Date.now().toString(),
            name: `${original.name} (Shared)`,
            orderIndex: s.tracks.indexOf(original) + 1,
            // Explicitly keep the same channelStripId
            channelStripId: original.channelStripId || original.id,
            zoom: original.zoom || 1, // Added zoom property
            hidden: false
        };
        const updated = [...s.tracks];
        updated.splice(newTrack.orderIndex, 0, newTrack);
        return { tracks: updated, isDirty: true };
    }),

    setDragPosition: (pos) => set({ dragPosition: pos }),
    setDropTargetTrackId: (id) => set({ dropTargetTrackId: id }),

    addAutomationPoint: (trackId, parameter, time, value) => set(s => ({
        tracks: s.tracks.map(t => {
            if (t.id !== trackId) return t;
            const existingAutomation = t.automation ? [...t.automation] : [];
            const laneIndex = existingAutomation.findIndex(l => l.parameter === parameter);
            const newPoint = { 
                id: `autopoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
                time, 
                value 
            };
            if (laneIndex === -1) {
                existingAutomation.push({ parameter, points: [newPoint] });
            } else {
                const points = [...existingAutomation[laneIndex].points, newPoint].sort((a, b) => a.time - b.time);
                existingAutomation[laneIndex] = { ...existingAutomation[laneIndex], points };
            }
            return { ...t, automation: existingAutomation };
        })
    })),

    updateAutomationPoint: (trackId, laneIndex, pointIndex, updatedPoint) => set(s => ({
        tracks: s.tracks.map(t => {
            if (t.id !== trackId) return t;
            const automation = t.automation ? [...t.automation] : [];
            if (!automation[laneIndex]) return t;
            const points = [...automation[laneIndex].points];
            points[pointIndex] = { ...points[pointIndex], ...updatedPoint };
            automation[laneIndex] = { ...automation[laneIndex], points: points.sort((a, b) => a.time - b.time) };
            return { ...t, automation };
        })
    })),

    deleteAutomationPoint: (trackId, laneIndex, pointIndex) => set(s => ({
        tracks: s.tracks.map(t => {
            if (t.id !== trackId) return t;
            const automation = t.automation ? [...t.automation] : [];
            if (!automation[laneIndex]) return t;
            const points = automation[laneIndex].points.filter((_, idx) => idx !== pointIndex);
            automation[laneIndex] = { ...automation[laneIndex], points };
            return { ...t, automation };
        })
    })),

    updateTrack: (id, updates) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === id ? { ...t, ...updates } : t), isDirty: true }));
        const t = get().tracks.find(t => t.id === id);
        if (t) audioEngine.updateTrackParams(id, t.volume, t.pan);
    },

    deleteTrack: (id) => {
        get().saveHistorySnapshot();
        audioEngine.removeTrack(id);
        set(s => ({ tracks: s.tracks.filter(t => t.id !== id), clips: s.clips.filter(c => c.trackId !== id), isDirty: true }));
    },

    addPlugin: (trackId, pluginType) => {
        // Store the canonical id so old and new spellings converge; existing
        // projects keep whatever they were saved with and are resolved on load.
        const pluginId = resolvePluginId(pluginType);
        const newPlugin: PluginSetting = {
            id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            pluginId,
            name: BUILTIN_PLUGIN_NAMES[pluginId] ?? pluginType,
            enabled: true,
            params: {},
            format: 'builtin',
            insertPoint: 'pre',
        };
        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: [...t.plugins, newPlugin] } : t),
            isDirty: true,
        }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
    },

    /**
     * Route some of a track's signal to a bus — the reverb/delay send that a
     * mix is normally built on.
     *
     * `Track.sends` existed in the model and the routing engine already builds
     * a gain node per send, but nothing could create one: there was no action,
     * so the only sends that ever appeared came from loading a saved channel
     * strip.
     */
    /**
     * Add a plugin to the master bus.
     *
     * There was no master insert chain at all: `addPlugin` only ever wrote to
     * a track, so the mastering step — light bus compression and a limiter
     * across the mix — had nowhere to live.
     */
    addMasterPlugin: (pluginType) => {
        const pluginId = resolvePluginId(pluginType);
        const plugin: PluginSetting = {
            id: `master-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            pluginId,
            name: BUILTIN_PLUGIN_NAMES[pluginId] ?? pluginType,
            enabled: true,
            params: {},
            format: 'builtin',
            insertPoint: 'pre',
        };
        set(s => ({ masterPlugins: [...(s.masterPlugins ?? []), plugin], isDirty: true }));
        audioEngine.updateMasterFXChain(get().masterPlugins);
    },

    removeMasterPlugin: (pluginId) => {
        set(s => ({
            masterPlugins: (s.masterPlugins ?? []).filter(p => p.id !== pluginId),
            isDirty: true,
        }));
        audioEngine.updateMasterFXChain(get().masterPlugins);
    },

    toggleMasterPlugin: (pluginId) => {
        set(s => ({
            masterPlugins: (s.masterPlugins ?? []).map(p =>
                p.id === pluginId ? { ...p, enabled: !p.enabled } : p),
            isDirty: true,
        }));
        audioEngine.updateMasterFXChain(get().masterPlugins);
    },

    updateMasterPluginParams: (pluginId, params) => {
        set(s => ({
            masterPlugins: (s.masterPlugins ?? []).map(p =>
                p.id === pluginId ? { ...p, params: { ...p.params, ...params } } : p),
            isDirty: true,
        }));
        const plugin = get().masterPlugins.find(p => p.id === pluginId);
        if (plugin) routingEngine.getMasterProcessor(pluginId)?.setParams(plugin.params);
    },

    /**
     * Route a track's output into a bus.
     *
     * `Track.outputBusId` existed, `engineRebuilder` restored it and the
     * routing engine acted on it — but nothing in the store could *set* it, so
     * a bus tree (drums → mix → master) could not be built at all.
     */
    routeTrackTo: (trackId, busId) => {
        if (trackId === busId) {
            console.warn('[Routing] Refusing to route a track into itself');
            return;
        }
        // Walk up from the destination; if we meet this track, the assignment
        // would close a loop and the graph would feed back on itself.
        const tracks = get().tracks;
        let hop: string | undefined = busId;
        const seen = new Set<string>();
        while (hop && hop !== 'stereo-out' && !seen.has(hop)) {
            if (hop === trackId) {
                console.warn(`[Routing] Refusing to create a feedback loop via ${busId}`);
                return;
            }
            seen.add(hop);
            hop = tracks.find(t => t.id === hop)?.outputBusId;
        }

        set(sx => ({
            tracks: sx.tracks.map(t => t.id === trackId ? { ...t, outputBusId: busId } : t),
            isDirty: true,
        }));
        audioEngine.routeTrackToTrack(trackId, busId);
    },

    setTrackDelay: (trackId, ms) => {
        const clamped = Number.isFinite(ms) ? Math.max(-500, Math.min(500, ms)) : 0;
        set(sx => ({
            tracks: sx.tracks.map(t => t.id === trackId ? { ...t, delay: clamped } : t),
            isDirty: true,
        }));
        audioEngine.setTrackDelay?.(trackId, clamped);
    },

    setTrackMonitorMode: (trackId, mode) => {
        set(sx => ({
            tracks: sx.tracks.map(t => t.id === trackId ? { ...t, monitorMode: mode } : t),
            isDirty: true,
        }));
        audioEngine.setTrackMonitorMode?.(trackId, mode);
    },

    setSidechainSource: (trackId, pluginId, sourceTrackId) => {
        if (trackId === sourceTrackId) {
            console.warn('[Sidechain] A track cannot key itself');
            return;
        }
        // Only the sidechain compressor has a key input; keying a plain
        // compressor would silently do nothing.
        const plugin = get().tracks.find(t => t.id === trackId)?.plugins
            .find(p => p.id === pluginId);
        if (plugin && plugin.pluginId !== BUILTIN_PLUGIN_IDS.sidechainCompressor) {
            console.warn(
                `[Sidechain] "${plugin.name}" has no key input — add a Sidechain Comp instead.`,
            );
            return;
        }
        set(sx => ({
            tracks: sx.tracks.map(t => t.id === trackId
                ? { ...t, plugins: t.plugins.map(p => p.id === pluginId ? { ...p, sidechainSourceId: sourceTrackId } : p) }
                : t),
            isDirty: true,
        }));
        audioEngine.setSidechainSource?.(trackId, pluginId, sourceTrackId);
    },

    clearSidechainSource: (trackId, pluginId) => {
        set(sx => ({
            tracks: sx.tracks.map(t => t.id === trackId
                ? { ...t, plugins: t.plugins.map(p => p.id === pluginId ? { ...p, sidechainSourceId: undefined } : p) }
                : t),
            isDirty: true,
        }));
        audioEngine.clearSidechainSource?.(trackId, pluginId);
    },

    /**
     * Repeat a region to fill a range — how a loop becomes an arrangement.
     * Copies are laid end to end and the last one is trimmed to the boundary.
     */
    duplicateClipAcross: (clipId, startBeat, endBeat) => {
        const source = get().clips.find(c => c.id === clipId);
        if (!source || !(source.duration > 0) || !(endBeat > startBeat)) return [];

        const copies: Clip[] = [];
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        let at = startBeat;
        let index = 0;

        // Guard the loop as well as the range: a tiny duration over a long span
        // would otherwise allocate an unbounded number of regions.
        const maxCopies = 2048;
        while (at < endBeat && index < maxCopies) {
            if (Math.abs(at - source.start) > 1e-9) {
                copies.push({
                    ...source,
                    id: `clip-${stamp}-${index}`,
                    start: at,
                    duration: Math.min(source.duration, endBeat - at),
                    notes: source.notes?.map(n => ({ ...n })),
                });
            }
            at += source.duration;
            index++;
        }

        if (copies.length === 0) return [];
        set(sx => ({ clips: [...sx.clips, ...copies], isDirty: true }));
        return copies.map(c => c.id);
    },

    /**
     * Interpolated automation value. The store could record points but nothing
     * could read a lane back, so an automation curve was write-only.
     */
    automationValueAt: (trackId, parameter, time) => {
        const lane = get().tracks.find(t => t.id === trackId)
            ?.automation?.find(a => a.parameter === parameter);
        const points = lane?.points;
        if (!points?.length) return undefined;

        const sorted = [...points].sort((a, b) => a.time - b.time);
        if (time <= sorted[0].time) return sorted[0].value;
        if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

        for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i], b = sorted[i + 1];
            if (time >= a.time && time <= b.time) {
                const span = b.time - a.time;
                if (span <= 0) return b.value;
                return a.value + (b.value - a.value) * ((time - a.time) / span);
            }
        }
        return sorted[sorted.length - 1].value;
    },

    setMonitorMode: (mode) => {
        set({ monitorMode: mode });
        audioEngine.setMonitorMode?.(mode);
    },

    getBusPeakDb: (trackId) => {
        const level = audioEngine.getTrackPeak?.(trackId) ?? 0;
        return level > 0 ? 20 * Math.log10(level) : -Infinity;
    },

    analyseLoudness: (channels, sampleRate) => measureLoudness(channels, sampleRate),

    gainToMatchRms: (samples, targetRmsDb) => rmsGain(samples, targetRmsDb),

    /**
     * Tune a vocal region.
     *
     * The scale comes from the project key unless one is given, so tuning
     * follows the song rather than needing to be set twice.
     */
    tuneVocalClip: async (clipId, options = {}) => {
        const edited = await editClipSamples(get, clipId, (samples, sampleRate) => {
            const { tonic, scale } = scaleFromKeySignature(get().keySignature);
            return tuneVocal(samples, {
                sampleRate,
                tonic,
                scale: options.scale ?? scale,
                strength: options.strength ?? 0.8,
                retuneSeconds: options.retuneSeconds ?? 0.06,
            });
        });
        return edited;
    },

    alignClipTo: async (clipId, referenceClipId) => {
        const ctx = audioEngine.getContext();
        const target = clipBuffer(get, clipId);
        const reference = clipBuffer(get, referenceClipId);
        if (!ctx || !target || !reference) return null;

        const offset = alignmentOffset(
            reference.getChannelData(0), target.getChannelData(0), target.sampleRate);
        const seconds = offset / target.sampleRate;

        // Move the region rather than rewriting its audio: non-destructive, and
        // it stays legible in the arrangement.
        const clip = get().clips.find(c => c.id === clipId);
        if (clip) {
            const secondsPerBeat = 60 / get().tempo;
            get().moveClip(clipId, Math.max(0, clip.start + seconds / secondsPerBeat));
        }
        return seconds;
    },

    cleanVocalClip: async (clipId, options = {}) =>
        editClipSamples(get, clipId, (samples, sampleRate) =>
            cleanVocal(samples, sampleRate, options)),

    exportStems: async (settings = {}) => {
        const sx = get();
        return renderStems(
            {
                tracks: sx.tracks,
                clips: sx.clips,
                tempo: sx.tempo,
                projectName: sx.name,
                masterPlugins: sx.masterPlugins,
            },
            settings,
        );
    },

    setTrackSend: (trackId, busId, level) => {
        const clamped = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
        set(s => ({
            tracks: s.tracks.map(t => {
                if (t.id !== trackId) return t;
                const sends = t.sends ?? [];
                const existing = sends.findIndex(x => x.busId === busId);
                return {
                    ...t,
                    sends: existing >= 0
                        ? sends.map((x, i) => i === existing ? { ...x, level: clamped } : x)
                        : [...sends, { busId, level: clamped }],
                };
            }),
            isDirty: true,
        }));
        audioEngine.routeTrackToBus(trackId, busId, clamped);
    },

    removeTrackSend: (trackId, busId) => {
        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId
                ? { ...t, sends: (t.sends ?? []).filter(x => x.busId !== busId) }
                : t),
            isDirty: true,
        }));
        audioEngine.routeTrackToBus(trackId, busId, 0);
    },

    togglePlugin: (trackId, pluginId) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: t.plugins.map(p => p.id === pluginId ? { ...p, enabled: !p.enabled } : p) } : t) }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
    },

    loadChannelStripSetting: (trackId, settingId) => {
        set(s => {
            const setting = s.channelStripSettings.find(a => a.id === settingId);
            if (!setting) return {};
            return {
                tracks: s.tracks.map(t => {
                    if (t.id !== trackId) return t;
                    const updated = {
                        ...t,
                        plugins: setting.settings.plugins.map(p => ({ ...p })),
                        sends: setting.settings.sends.map(sx => ({ ...sx })),
                        outputBusId: setting.settings.outputBusId,
                        volume: setting.settings.volume,
                        pan: setting.settings.pan,
                        channelStripId: setting.id
                    };
                    audioEngine.updateFXChain(trackId, updated.plugins);
                    audioEngine.updateTrackParams(trackId, updated.volume, updated.pan);
                    return updated;
                })
            }
        });
    },

    chooseNextChannelStripSetting: (trackId) => {
        const track = get().tracks.find(t => t.id === trackId);
        if (!track) return;
        const type = track.type === 'audio' ? 'audio' : (track.type === 'bus' || track.type === 'output' ? 'output' : 'instrument');
        const settings = get().channelStripSettings.filter(s => s.type === type);
        if (!settings.length) return;
        const currentSettingId = track.channelStripId; // using channelStripId as active selection if stored
        let idx = settings.findIndex(s => s.id === currentSettingId);
        idx = (idx + 1) % settings.length;
        get().loadChannelStripSetting(trackId, settings[idx].id);
        get().updateTrack(trackId, { channelStripId: settings[idx].id });
    },

    choosePreviousChannelStripSetting: (trackId) => {
        const track = get().tracks.find(t => t.id === trackId);
        if (!track) return;
        const type = track.type === 'audio' ? 'audio' : (track.type === 'bus' || track.type === 'output' ? 'output' : 'instrument');
        const settings = get().channelStripSettings.filter(s => s.type === type);
        if (!settings.length) return;
        const currentSettingId = track.channelStripId;
        let idx = settings.findIndex(s => s.id === currentSettingId);
        idx = idx <= 0 ? settings.length - 1 : idx - 1;
        get().loadChannelStripSetting(trackId, settings[idx].id);
        get().updateTrack(trackId, { channelStripId: settings[idx].id });
    },

    copyChannelStripSetting: (trackId) => {
        const track = get().tracks.find(t => t.id === trackId);
        if (!track) return;
        set({ channelStripCopyBuffer: {
            plugins: track.plugins.map(p => ({ ...p })),
            sends: track.sends.map(s => ({ ...s })),
            outputBusId: track.outputBusId,
            volume: track.volume,
            pan: track.pan
        }});
    },

    pasteChannelStripSetting: (trackId) => {
        const buffer = get().channelStripCopyBuffer;
        if (!buffer) return;
        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId ? {
                ...t,
                plugins: buffer.plugins.map(p => ({ ...p })),
                sends: buffer.sends.map(s => ({ ...s })),
                outputBusId: buffer.outputBusId,
                volume: buffer.volume,
                pan: buffer.pan
            } : t)
        }));
        const t = get().tracks.find(t => t.id === trackId);
        if (t) {
            audioEngine.updateFXChain(trackId, t.plugins);
            audioEngine.updateTrackParams(trackId, t.volume, t.pan);
        }
    },

    pasteChannelStripPluginsOnly: (trackId) => {
        const buffer = get().channelStripCopyBuffer;
        if (!buffer) return;
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: buffer.plugins.map(p => ({ ...p })) } : t) }));
        const t = get().tracks.find(t => t.id === trackId);
        if (t) audioEngine.updateFXChain(trackId, t.plugins);
    },

    pasteChannelStripSendsOnly: (trackId) => {
        const buffer = get().channelStripCopyBuffer;
        if (!buffer) return;
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, sends: buffer.sends.map(sx => ({ ...sx })) } : t) }));
    },

    removeAllChannelStripPlugins: (trackId) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: [] } : t) }));
        audioEngine.updateFXChain(trackId, []);
    },

    removeEmptyInsertSlots: (trackId) => {
        // no explicit empty slots model in this implementation; keep existing behavior
        return;
    },

    removeBypassedPlugins: (trackId) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: t.plugins.filter(p => p.enabled) } : t) }));
        const t = get().tracks.find(t => t.id === trackId);
        if (t) audioEngine.updateFXChain(trackId, t.plugins);
    },

    removeAllChannelStripSends: (trackId) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, sends: [] } : t) }));
    },

    resetChannelStrip: (trackId) => {
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t,
            plugins: [], sends: [], outputBusId: 'stereo-out', volume: 0.8, pan: 0
        } : t) }));
        audioEngine.updateFXChain(trackId, []);
        audioEngine.updateTrackParams(trackId, 0.8, 0);
    },

    saveChannelStripSetting: (trackId, name) => {
        const track = get().tracks.find(t => t.id === trackId);
        if (!track) return;
        const newSettingId = `setting-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const newSetting = {
            id: newSettingId,
            name,
            type: (track.type === 'audio' ? 'audio' : (track.type === 'bus' || track.type === 'output' ? 'output' : 'instrument')) as 'audio' | 'output' | 'instrument',
            settings: {
                plugins: track.plugins.map(p => ({ ...p })),
                sends: track.sends.map(s => ({ ...s })),
                outputBusId: track.outputBusId,
                volume: track.volume,
                pan: track.pan,
            }
        };
        set(s => ({ channelStripSettings: [...s.channelStripSettings, newSetting] }));
    },

    deleteChannelStripSetting: (settingId) => {
        set(s => ({ channelStripSettings: s.channelStripSettings.filter(s => s.id !== settingId) }));
    },

    saveChannelStripPerformance: (trackId, name, program) => {
        const track = get().tracks.find(t => t.id === trackId);
        if (!track) return;
        const newPerformance = {
            id: `perf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            name,
            program,
            trackId,
            settings: {
                plugins: track.plugins.map(p => ({ ...p })),
                sends: track.sends.map(s => ({ ...s })),
                outputBusId: track.outputBusId,
                volume: track.volume,
                pan: track.pan,
            }
        };
        set(s => ({ channelStripPerformances: [...s.channelStripPerformances, newPerformance] }));
    },

    loadChannelStripPerformance: (trackId, program) => {
        const perf = get().channelStripPerformances.find(p => p.trackId === trackId && p.program === program);
        if (!perf) return;
        set(s => ({
            tracks: s.tracks.map(t => {
                if (t.id !== trackId) return t;
                const updated = {
                    ...t,
                    plugins: perf.settings.plugins.map(p => ({ ...p })),
                    sends: perf.settings.sends.map(s => ({ ...s })),
                    outputBusId: perf.settings.outputBusId,
                    volume: perf.settings.volume,
                    pan: perf.settings.pan
                };
                return updated;
            })
        }));
        const updatedTrack = get().tracks.find(t => t.id === trackId);
        if (updatedTrack) {
            audioEngine.updateFXChain(trackId, updatedTrack.plugins);
            audioEngine.updateTrackParams(trackId, updatedTrack.volume, updatedTrack.pan);
        }
    },

    addClip: (clip) => set(s => {
        const track = s.tracks.find(t => t.id === clip.trackId);
        const altId = clip.alternativeId || track?.activeAlternativeId || 'alt-1';
        const defaultClip = {
            id: Date.now().toString(),
            transpose: 0,
            velocityOffset: 0,
            muted: false,
            loop: false,
            qSwing: 0,
            alternativeId: altId,
            flexEnabled: false,
            flexMode: 'off',
            flexTimeFactor: 1,
            flexPitchOffset: 0,
        };
        return { clips: [...s.clips, { ...defaultClip, ...clip, startBeat: clip.startBeat ?? clip.start, startTime: clip.startTime ?? clip.start } as Clip] };
    }),

    makeAlias: (sourceClipId, trackId, start, aliasName) => {
        const s = get();
        const source = s.clips.find(c => c.id === sourceClipId);
        if (!source) return;
        const newClip = {
            ...source,
            id: `clip-${Date.now()}`,
            trackId,
            start: Math.max(0, start),
            aliasOf: sourceClipId,
            aliasName: aliasName || undefined,
            // keep independent params like transpose/velocity/muted/loop
            name: aliasName || source.name,
        };
        set({ clips: [...s.clips, newClip], selectedClipIds: [newClip.id], selectedClipId: newClip.id });
    },

    makeAliasesFromSelection: (trackId, start) => {
        const s = get();
        if (s.selectedClipIds.length === 0) return;
        const primary = s.clips.find(c => c.id === s.selectedClipIds[0]);
        if (!primary) return;
        const targetTime = start !== undefined ? start : s.playhead;
        const timeDelta = targetTime - primary.start;
        const newAliases = s.selectedClipIds
            .map(id => s.clips.find(c => c.id === id))
            .filter((c): c is Clip => !!c)
            .map(c => ({
                ...c,
                id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                trackId: trackId || c.trackId,
                start: Math.max(0, c.start + timeDelta),
                aliasOf: c.id,
                aliasName: undefined,
                name: c.name,
            }));
        set({ clips: [...s.clips, ...newAliases], selectedClipIds: newAliases.map(a => a.id), selectedClipId: newAliases[0]?.id || null });
    },

    reassignAlias: (aliasClipId, newSourceClipId) => {
        const s = get();
        const aliasClip = s.clips.find(c => c.id === aliasClipId);
        const newSource = s.clips.find(c => c.id === newSourceClipId);
        if (!aliasClip || !newSource) return;
        set(s => ({
            clips: s.clips.map(c => c.id === aliasClipId
                ? { ...c, aliasOf: newSourceClipId, name: c.aliasName || newSource.name }
                : c
            )
        }));
    },

    selectOriginalOfAlias: (aliasClipId) => {
        const s = get();
        const aliasClip = s.clips.find(c => c.id === aliasClipId);
        if (!aliasClip?.aliasOf) return;
        const parent = s.clips.find(c => c.id === aliasClip.aliasOf);
        if (!parent) return;
        set({ selectedClipIds: [parent.id], selectedClipId: parent.id });
    },

    selectAliasesOfRegion: (regionClipId) => {
        const s = get();
        const aliasIds = s.clips.filter(c => c.aliasOf === regionClipId).map(c => c.id);
        if (aliasIds.length === 0) return;
        set({ selectedClipIds: aliasIds, selectedClipId: aliasIds[0] || null });
    },

    selectOrphanAliases: () => {
        const s = get();
        const orphanIds = s.clips.filter(c => c.aliasOf && !s.clips.some(p => p.id === c.aliasOf)).map(c => c.id);
        set({ selectedClipIds: orphanIds, selectedClipId: orphanIds[0] || null });
    },

    deleteOrphanAliases: () => {
        set(s => ({ clips: s.clips.filter(c => !(c.aliasOf && !s.clips.some(p => p.id === c.aliasOf))) }));
    },

    convertAliasToRegionCopy: (aliasClipId) => {
        const s = get();
        const aliasClip = s.clips.find(c => c.id === aliasClipId);
        if (!aliasClip || !aliasClip.aliasOf) return;
        const converted = { ...aliasClip, id: `clip-${Date.now()}`, aliasOf: undefined, aliasName: undefined };
        set({ clips: [...s.clips.filter(c => c.id !== aliasClipId), converted], selectedClipIds: [converted.id], selectedClipId: converted.id });
    },

    convertOrphanAliasesToCopies: () => {
        const s = get();
        const orphans = s.clips.filter(c => c.aliasOf && !s.clips.some(p => p.id === c.aliasOf));
        const converted = orphans.map(c => ({ ...c, id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, aliasOf: undefined, aliasName: undefined }));
        set({ clips: [...s.clips.filter(c => !(c.aliasOf && !s.clips.some(p => p.id === c.aliasOf))), ...converted] });
    },

    setShowAudioTrackEditor: (show) => set({ showAudioTrackEditor: show }),
    setAudioTrackEditorTrackId: (trackId) => set({ audioTrackEditorTrackId: trackId }),
    setAudioTrackEditorZoom: (zoom) => set({ audioTrackEditorZoom: Math.max(0.25, Math.min(8, zoom)) }),
    setAudioTrackEditorHeight: (height) => set({ audioTrackEditorHeight: Math.max(120, Math.min(450, height)) }),
    setAudioTrackEditorWaveformZoom: (zoom) => set({ audioTrackEditorWaveformZoom: Math.max(0.5, Math.min(8, zoom)) }),

    /**
     * Split a region in two at `time` (in beats).
     *
     * Works on MIDI as well as audio. It used to bail on anything that was not
     * `type === 'audio'`, so a MIDI region — the thing you actually cut when
     * arranging a programmed part — could not be split at all.
     *
     * MIDI notes are partitioned by where they start, and a note straddling the
     * cut is shortened to end at it rather than being duplicated into both
     * halves or left hanging past the region boundary.
     */
    splitClipAtTime: (clipId, time) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip) return;
        const splitPoint = Math.max(clip.start, Math.min(clip.start + clip.duration, time));
        if (splitPoint <= clip.start || splitPoint >= clip.start + clip.duration) return;

        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const first: Clip = {
            ...clip,
            id: `clip-${stamp}-a`,
            duration: splitPoint - clip.start,
        };
        const second: Clip = {
            ...clip,
            id: `clip-${stamp}-b`,
            start: splitPoint,
            duration: clip.start + clip.duration - splitPoint,
        };

        if (clip.notes?.length) {
            // Note positions are relative to the clip, so the second half's
            // notes have to be rebased onto its new start.
            const cut = splitPoint - clip.start;
            first.notes = clip.notes
                .filter(n => n.start < cut)
                .map(n => n.start + n.duration > cut
                    ? { ...n, duration: cut - n.start }
                    : { ...n });
            second.notes = clip.notes
                .filter(n => n.start >= cut)
                .map(n => ({ ...n, start: n.start - cut }));
        }

        set({
            clips: [...s.clips.filter(c => c.id !== clipId), first, second],
            selectedClipIds: [first.id, second.id],
            selectedClipId: second.id,
            isDirty: true,
        });
    },

    splitClipAtPlayhead: (clipId) => {
        const s = get();
        const point = s.playhead;
        s.splitClipAtTime(clipId, point);
    },

    joinClips: (clipIds) => {
        const s = get();
        if (clipIds.length < 2) return;
        const targetClips = clipIds
            .map(id => s.clips.find(c => c.id === id))
            .filter((c): c is Clip => !!c)
            .sort((a, b) => a.start - b.start);
        if (targetClips.some(c => c.type !== 'audio')) return;
        const trackId = targetClips[0].trackId;
        if (targetClips.some(c => c.trackId !== trackId)) return;

        const contiguous = targetClips.every((c, i) => {
            if (i === 0) return true;
            const prev = targetClips[i - 1];
            return Math.abs(prev.start + prev.duration - c.start) < 1e-6;
        });
        if (!contiguous) return;

        const joined = {
            ...targetClips[0],
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            duration: targetClips.reduce((sum, c) => sum + c.duration, 0)
        };

        set({
            clips: [...s.clips.filter(c => !clipIds.includes(c.id)), joined],
            selectedClipIds: [joined.id],
            selectedClipId: joined.id
        });
    },

    trimClip: (clipId, trimLeft, trimRight) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip) return;

        const newStart = clip.start + Math.max(0, trimLeft);
        const newDuration = Math.max(0.1, clip.duration - Math.max(0, trimLeft) - Math.max(0, trimRight));

        set({
            clips: s.clips.map(c => c.id === clipId ? { ...c, start: newStart, duration: newDuration } : c)
        });
    },

    splitRegionBySilence: (clipId, options) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') return;

        const threshold = options?.threshold ?? 0.02;
        const minSilence = Math.max(0.1, options?.minSilence ?? 0.25);
        const preAttack = Math.max(0, options?.preAttack ?? 0);
        const postRelease = Math.max(0, options?.postRelease ?? 0);
        const zeroCross = options?.zeroCross ?? false;

        // Placeholder algorithm: we don't have actual waveform data in this simplified engine.
        const estimatedSegmentCount = Math.max(1, Math.floor(clip.duration / Math.max(0.5, minSilence)));
        const segmentDuration = clip.duration / estimatedSegmentCount;

        const splitClips = Array.from({ length: estimatedSegmentCount }, (_, i) => ({
            ...clip,
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
            start: clip.start + i * segmentDuration,
            duration: segmentDuration,
            name: `${clip.name} (Split ${i + 1})`,
            muted: false,
            aliasOf: undefined,
            aliasName: undefined,
        }));

        set({
            clips: [...s.clips.filter(c => c.id !== clipId), ...splitClips],
            selectedClipIds: splitClips.map(c => c.id),
            selectedClipId: splitClips[0]?.id ?? null,
        });
    },

    /**
     * Transcribe an audio region to a new MIDI track.
     *
     * `engine/audio/audioToMidi.ts` implements onset detection and monophonic
     * and polyphonic pitch tracking, and nothing imported it. Loaded lazily
     * because transcription is a rare, heavy operation and the module carries
     * its own FFT.
     */
    audioToMidiTrack: async (clipId) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') return;

        /*
         * Resolve the buffer the way the rest of the store does, and follow a
         * take folder to its active take: a folder's audio lives on its takes,
         * not under the folder's own id, so `getBuffer(clip.id)` always missed
         * on exactly the regions recording produces.
         */
        const source = clip.isTakeFolder && clip.takes?.length
            ? clip.takes[Math.max(0, Math.min(clip.activeTakeIndex ?? 0, clip.takes.length - 1))]
            : clip;
        let buffer =
            bufferCacheManager.getBuffer((source as any).storageKey ?? (source as any).sampleId ?? source.id)
            ?? bufferCacheManager.getBuffer(clip.storageKey ?? clip.sampleId ?? clip.id);

        /*
         * Decode on demand if the clip has never been played.
         *
         * The scheduler only fetches a clip's file when playback reaches it, so
         * converting a freshly opened project silently did nothing until the
         * user had pressed play — a failure with no symptom.
         */
        if (!buffer) {
            const fileUrl = (source as any).fileUrl ?? (clip as any).fileUrl;
            const ctx = getAudioContext();
            if (fileUrl && ctx) {
                try {
                    const res = await fetch(fileUrl);
                    const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
                    const key = (source as any).sampleId ?? (source as any).storageKey ?? source.id;
                    bufferCacheManager.addBuffer(key, decoded, fileUrl);
                    buffer = decoded;
                } catch (e) {
                    console.warn('[AudioToMidi] Could not decode', fileUrl, e);
                }
            }
        }

        if (!buffer) {
            console.warn('[AudioToMidi] No audio buffer for clip', clip.id);
            return;
        }

        const { AudioToMidi } = await import('@/engine/audio/audioToMidi');
        const transcriber = new AudioToMidi(buffer.sampleRate, {
            mode: 'monophonic',
            quantize: true,
            gridResolution: 0.25,
        });

        let result;
        try {
            result = transcriber.transcribe(buffer.getChannelData(0));
        } catch (e) {
            console.error('[AudioToMidi] Transcription failed:', e);
            return;
        }
        if (!result.notes.length) {
            console.warn('[AudioToMidi] No notes detected');
            return;
        }

        // Note times come back in seconds; the timeline works in beats.
        const beatsPerSecond = (s.tempo || 120) / 60;
        const sourceTrack = s.tracks.find(t => t.id === clip.trackId);
        const trackId = `track-${Date.now()}-a2m`;
        const newClipId = `clip-${Date.now()}-a2m`;

        const notes = result.notes.map((n: any, i: number) => ({
            ...n,
            id: `note-${Date.now()}-${i}`,
            startBeat: (n.startBeat ?? 0),
            duration: Math.max(0.0625, n.duration ?? 0.25),
        }));

        set(state => ({
            tracks: [...state.tracks, {
                id: trackId,
                name: `${clip.name} (MIDI)`,
                type: 'midi',
                color: NEON_TRACK_PALETTE[state.tracks.length % NEON_TRACK_PALETTE.length],
                icon: 'keyboard',
                orderIndex: sourceTrack ? sourceTrack.orderIndex + 1 : state.tracks.length,
                muted: false, soloed: false, volume: 0.8, pan: 0,
                protected: false, frozen: false, freezeMode: 'Source Only',
                enabled: true, recordEnabled: false, inputMonitoring: false,
                alternatives: [{ id: 'alt-1', name: 'A' }],
                activeAlternativeId: 'alt-1', showInactiveAlternatives: false,
                transpose: 0, velocityOffset: 0, delay: 0,
                plugins: [], sends: [], outputBusId: 'stereo-out',
                channelStripId: trackId, zoom: 1, hidden: false, isCollapsed: false,
                isGrooveTrack: false, matchGrooveTrack: false,
                instrument: 'Grand Piano',
            } as any],
            clips: [...state.clips, {
                id: newClipId,
                trackId,
                name: `${clip.name} (MIDI)`,
                type: 'midi',
                start: clip.start,
                duration: clip.duration,
                color: NEON_TRACK_PALETTE[state.tracks.length % NEON_TRACK_PALETTE.length],
                notes,
                muted: false,
            } as any],
            isDirty: true,
        }));

        console.info(`[AudioToMidi] ${notes.length} notes in ${Math.round(result.processingTime)}ms`);
    },

    stemSplitter: async (clipId, options) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') return;

        const { STEM_PRESETS, separateStems } = await import('@/lib/stemSeparation');

        const allowedStems = options?.selectedStems && options.selectedStems.length > 0
            ? options.selectedStems
            : (options?.preset && STEM_PRESETS[options.preset] ? STEM_PRESETS[options.preset] : STEM_PRESETS['All Stems']);
        const includeSubmix = options?.includeSubmix ?? true;

        const sourceTrack = s.tracks.find(t => t.id === clip.trackId);
        const newTrackOrderBase = sourceTrack ? (sourceTrack.orderIndex + 1) : s.tracks.length;

        const audioBuffer = bufferCacheManager.getBuffer(clip.id);
        if (!audioBuffer) {
            console.warn('[StemSplitter] No audio buffer found for clip', clip.id);
            return;
        }

        let stemResults: { name: string; buffer: AudioBuffer }[]
        try {
            stemResults = await separateStems(audioBuffer)
        } catch (e) {
            console.error('[StemSplitter] Stem separation failed:', e)
            return
        }

        const newTracks: Track[] = []
        const newClips: Clip[] = []
        const trackColors = [...NEON_TRACK_PALETTE]

        allowedStems.forEach((stem, idx) => {
            const stemResult = stemResults.find(r => r.name === stem)
            if (!stemResult) return

            const trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${idx}`
            const stemClipId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`

            bufferCacheManager.addBuffer(stemClipId, stemResult.buffer, `${clip.name} (${stem})`)

            newTracks.push({
                id: trackId,
                name: `${clip.name} - ${stem}`,
                type: 'audio',
                color: trackColors[idx % trackColors.length],
                icon: 'mic',
                orderIndex: newTrackOrderBase + idx,
                muted: false, soloed: false, volume: 0.8, pan: 0,
                protected: false, frozen: false, freezeMode: 'Source Only',
                enabled: true, recordEnabled: false, inputMonitoring: false,
                alternatives: [{ id: 'alt-1', name: 'A' }],
                activeAlternativeId: 'alt-1', showInactiveAlternatives: false,
                transpose: 0, velocityOffset: 0, delay: 0,
                plugins: [], sends: [], outputBusId: 'stereo-out',
                channelStripId: trackId, zoom: 1, hidden: false, isCollapsed: false,
                isGrooveTrack: false, matchGrooveTrack: false,
            })

            newClips.push({
                ...clip,
                id: stemClipId,
                trackId,
                name: `${clip.name} (${stem})`,
                bufferId: stemClipId,
                aliasOf: undefined,
                aliasName: undefined,
            })
        })

        if (includeSubmix) {
            const submixTrackId = `track-${Date.now()}-submix`
            newTracks.push({
                id: submixTrackId,
                name: `${clip.name} - Submix`,
                type: 'audio', color: '#9ca3af', icon: 'mic',
                orderIndex: newTrackOrderBase + allowedStems.length,
                muted: false, soloed: false, volume: 0.8, pan: 0,
                protected: false, frozen: false, freezeMode: 'Source Only',
                enabled: true, recordEnabled: false, inputMonitoring: false,
                alternatives: [{ id: 'alt-1', name: 'A' }],
                activeAlternativeId: 'alt-1', showInactiveAlternatives: false,
                transpose: 0, velocityOffset: 0, delay: 0,
                plugins: [], sends: [], outputBusId: 'stereo-out',
                channelStripId: submixTrackId, zoom: 1, hidden: false, isCollapsed: false,
                isGrooveTrack: false, matchGrooveTrack: false,
            })
            newClips.push({
                ...clip,
                id: `clip-${Date.now()}-submix`,
                trackId: submixTrackId,
                name: `${clip.name} (Submix)`,
                bufferId: clip.id,
                aliasOf: undefined,
                aliasName: undefined,
            })
        }

        set({
            tracks: [...s.tracks, ...newTracks],
            clips: [...s.clips.map(c => c.id === clip.id ? { ...c, muted: true } : c), ...newClips],
            selectedClipIds: newClips.map(c => c.id),
            selectedClipId: newClips[0]?.id ?? null,
        })
    },

    addMediaFile: async (file, trackId) => {
        const { addTrack, addClip, tracks, focusedTrackId, playhead, globalTracks } = get();
        let assignedTrackId = trackId || focusedTrackId || tracks.find(t => t.type === 'audio')?.id;

        if (!assignedTrackId) {
            assignedTrackId = `track-${Date.now()}`;
            addTrack({ id: assignedTrackId, name: 'Audio', type: 'audio', color: '#38bdf8', icon: 'mic', hidden: false } as any);
        }

        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const isMidi = fileExt === 'mid' || fileExt === 'midi';

        if (isMidi) {
            const fileUrl = URL.createObjectURL(file);
            addClip({
                id: `clip-${Date.now()}`,
                trackId: assignedTrackId,
                name: file.name,
                type: 'midi',
                alternativeId: 'alt-1',
                start: playhead || 0,
                startBeat: playhead || 0,
                startTime: playhead || 0,
                duration: 8,
                color: '#66FFA9',
                fileUrl,
                offset: 0,
                muted: false,
                loop: false,
                qSwing: 0,
                transpose: 0,
                velocityOffset: 0,
            } as any);
            return;
        }

        // Store audio file in IndexedDB for persistence across reloads
        let storageKey: string | undefined;
        try {
            const record = await storeAudioFile(file, file.name);
            storageKey = record.storageKey;
        } catch (e) {
            console.warn('[Persistence] Failed to store audio file in IndexedDB, falling back to blob URL:', e);
        }

        // Decode audio to get real duration, cache the buffer, and generate waveform peaks
        const clipId = `clip-${Date.now()}`;
        let audioBuffer: AudioBuffer | null = null;
        let durationBeats = 8;
        let waveformPeaks: Clip['waveformPeaks'] = undefined;
        let fileUrl: string | undefined;

        try {
            const ctx = audioEngine.getContext();
            if (!ctx) {
                console.warn('[Import] No AudioContext available, using defaults');
                throw new Error('no context');
            }
            const arrayBuffer = await file.arrayBuffer();
            audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

            // Calculate duration in beats from real time
            const tempo = globalTracks?.tempo?.[0]?.value ?? 120;
            durationBeats = (audioBuffer.duration / 60) * (tempo as number);

            // Generate waveform peaks
            const peaks = await extractPeaksAsync(audioBuffer);
            waveformPeaks = {
                channels: peaks.channels.map(ch => ({
                    min: ch.min,
                    max: ch.max,
                })),
                resolution: peaks.resolution,
                durationSeconds: peaks.durationSeconds,
                numChannels: peaks.numChannels,
            };

            // Cache the AudioBuffer keyed by clip ID for scheduler lookup
            bufferCacheManager.addBuffer(clipId, audioBuffer, file.name);

            // Create blob URL for waveform preview / fallback decode
            fileUrl = URL.createObjectURL(file);
        } catch (e) {
            console.warn('[Import] Failed to decode audio, falling back to defaults:', e);
            fileUrl = storageKey ? undefined : URL.createObjectURL(file);
        }

        const startBeat = playhead || 0;

        addClip({
            id: clipId,
            trackId: assignedTrackId,
            name: file.name,
            type: 'audio',
            alternativeId: 'alt-1',
            start: startBeat,
            startBeat,
            startTime: startBeat,
            duration: durationBeats,
            color: '#64D2FF',
            fileUrl,
            storageKey,
            bufferId: audioBuffer ? clipId : undefined,
            originalName: file.name,
            waveformPeaks,
            offset: 0,
            muted: false,
            loop: false,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0,
        } as any);
    },

    updateClip: (id, updates) => set(s => ({
        clips: s.clips.map(c => {
            if (c.id === id) {
                return { ...c, ...updates };
            }
            if (c.aliasOf === id && updates.name && !c.aliasName) {
                return { ...c, name: updates.name };
            }
            return c;
        })
    })),

    duplicateClip: (clipId) => set(s => {
        const original = s.clips.find(c => c.id === clipId);
        if (!original) return {};
        const cloneId = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const cloneClip: Clip = {
            ...original,
            id: cloneId,
            name: `${original.name} Copy`,
            start: original.start + original.duration,
            aliasOf: original.id,
            aliasName: original.name,
        };
        return {
            clips: [...s.clips, cloneClip],
            selectedClipId: cloneId,
            selectedClipIds: [cloneId],
            isDirty: true,
        };
    }),

    deleteClip: (id) => set(s => ({
        clips: s.clips
            .filter(c => c.id !== id)
            .map(c => c.aliasOf === id ? { ...c, /* orphan alias remains, can be converted using helper */ } : c)
    })),
    setCurrentTool: (tool) => set({ currentTool: tool }),
    showContextMenu: (x, y, clipId) => set({ contextMenu: { visible: true, x, y, clipId } }),
    hideContextMenu: () => set({ contextMenu: { visible: false, x: 0, y: 0, clipId: null } }),
    deselectClip: (clipId) => set(s => ({
        selectedClipIds: s.selectedClipIds.filter(id => id !== clipId),
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    })),
    deselectAllClips: () => set({ selectedClipIds: [], selectedClipId: null }),
    toggleClipSelection: (clipId) => set(s => {
        const exists = s.selectedClipIds.includes(clipId);
        const ids = exists ? s.selectedClipIds.filter(id => id !== clipId) : [...s.selectedClipIds, clipId];
        return { selectedClipIds: ids, selectedClipId: ids.length > 0 ? ids[ids.length - 1] : null };
    }),
    moveClip: (clipId, newStartTime, newTrackId) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, startBeat: newStartTime, start: newStartTime, startTime: newStartTime, trackId: newTrackId ?? c.trackId } : c),
        isDirty: true,
    })),
    moveSelectedClips: (deltaBeats, deltaTrackIndex, trackIds) => set(s => ({
        clips: s.clips.map(c => {
            if (!s.selectedClipIds.includes(c.id)) return c;
            return { ...c, startBeat: (c.startBeat ?? c.start) + deltaBeats, start: c.start + deltaBeats, startTime: (c.startTime ?? c.start) + deltaBeats };
        }),
        isDirty: true,
    })),
    splitClip: (clipId, splitBeat) => set(s => {
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip) return {};
        const secondHalf: Clip = {
            ...clip,
            id: `clip-${Date.now()}`,
            start: splitBeat,
            startBeat: splitBeat,
            startTime: splitBeat,
            name: `${clip.name} (Part 2)`,
        };
        const firstHalf = {
            ...clip,
            duration: splitBeat - (clip.startBeat ?? clip.start),
        };
        return {
            clips: [...s.clips.filter(c => c.id !== clipId), firstHalf, secondHalf],
            selectedClipIds: [firstHalf.id, secondHalf.id],
            isDirty: true,
        };
    }),
    duplicateSelectedClips: (offsetBeats) => set(s => {
        const dups = s.clips.filter(c => s.selectedClipIds.includes(c.id)).map(c => ({
            ...c,
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            start: c.start + (offsetBeats ?? c.duration),
            startBeat: (c.startBeat ?? c.start) + (offsetBeats ?? c.duration),
            startTime: c.startTime + (offsetBeats ?? c.duration),
        }));
        return { clips: [...s.clips, ...dups], selectedClipIds: dups.map(d => d.id), isDirty: true };
    }),
    updateClipFade: (clipId, fadeType, settings) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, [fadeType === 'in' ? 'fadeIn' : 'fadeOut']: settings } : c),
        isDirty: true,
    })),
    stretchClip: (clipId, newDuration, newPlaybackRate) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, duration: newDuration, flexTimeFactor: newPlaybackRate } : c),
        isDirty: true,
    })),
    setClipPlaybackRate: (clipId, playbackRate) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, flexTimeFactor: playbackRate } : c),
        isDirty: true,
    })),
    setClipPitch: (clipId, pitchOffset) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, flexPitchOffset: pitchOffset, transpose: pitchOffset } : c),
        isDirty: true,
    })),
    reverseClip: (clipId) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, name: `${c.name} (Rev)` } : c),
        isDirty: true,
    })),
    renameClip: (clipId, newName) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, name: newName } : c),
    })),
    setClipColor: (clipId, color) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, color } : c),
    })),
    toggleClipMute: (clipId) => set(s => ({
        clips: s.clips.map(c => c.id === clipId ? { ...c, muted: !c.muted } : c),
        isDirty: true,
    })),

    addNote: (clipId, note) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: [...(c.notes || []), note] } : c) })),

    /**
     * Quantize a whole region's notes.
     *
     * The piano roll could already quantize a *selection* (`midiStore
     * .quantizeSelected`), but tightening a recorded or programmed part from
     * the arrangement — the normal editing step — had no entry point at all.
     *
     * Snapping happens in timeline beats, not clip-relative ones, so a region
     * that does not itself start on the grid still lands its notes on it.
     */
    quantizeClipNotes: (clipId, division, strength = 1, swing = 0) => {
        const clip = get().clips.find(c => c.id === clipId);
        if (!clip?.notes?.length) return;

        const grid = getGridSize(division);
        if (!(grid > 0)) return;
        const amount = Math.max(0, Math.min(1, strength));
        const swingOffset = Math.max(0, Math.min(1, swing)) * grid * 0.5;

        const quantized = clip.notes.map(note => {
            const absolute = clip.start + note.start;
            const index = Math.round(absolute / grid);
            // Swing pushes every other grid position later.
            const target = index * grid + (index % 2 === 1 ? swingOffset : 0);
            const moved = absolute + (target - absolute) * amount;
            return { ...note, start: Math.max(0, moved - clip.start) };
        });

        set(s => ({
            clips: s.clips.map(c => c.id === clipId ? { ...c, notes: quantized } : c),
            isDirty: true,
        }));
    },


    updateNote: (clipId, noteId, updates) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: c.notes?.map(n => n.id === noteId ? { ...n, ...updates } : n) } : c) })),

    deleteNote: (clipId, noteId) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: c.notes?.filter(n => n.id !== noteId) } : c) })),

    addAnnotation: (annotation) => set(s => ({ annotations: [...s.annotations, annotation], isDirty: true })),
    updateAnnotation: (id, updates) => set(s => ({ annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a), isDirty: true })),
    deleteAnnotation: (id) => set(s => ({ annotations: s.annotations.filter(a => a.id !== id), isDirty: true })),

    setZoom: (z) => set({ zoom: z }),
    setTrackHeight: (h) => set({ trackHeight: h }),
    setSnap: (s) => set({ snap: s }),
    toggleAutomation: () => set(s => ({ showAutomation: !s.showAutomation })),
    toggleToolsMenu: (show?: boolean) => set(s => ({ showToolsMenu: show !== undefined ? show : !s.showToolsMenu })),
    toggleLibrary: () => set(s => ({ showLibrary: !s.showLibrary })),
    toggleInspector: () => set(s => ({ showInspector: !s.showInspector })),
    toggleToolbar: () => set(s => ({ showToolbar: !s.showToolbar })),
    toggleSmartControls: () => set(s => ({ showSmartControls: !s.showSmartControls, bottomPanel: 'smartcontrols' })),
    toggleMixer: () => set(s => ({ showMixer: !s.showMixer, bottomPanel: 'mixer' })),
    toggleEditors: () => set(s => ({ showEditors: !s.showEditors, bottomPanel: 'pianoroll' })),
    toggleListEditors: () => set(s => ({ showListEditors: !s.showListEditors })),
    toggleNotePad: () => set(s => ({ showNotePad: !s.showNotePad })),
    toggleLoopBrowser: () => set(s => ({ showLoopBrowser: !s.showLoopBrowser })),
    toggleBrowsers: () => set(s => ({ showBrowsers: !s.showBrowsers })),
    toggleLiveLoops: () => set(s => ({ showLiveLoopsGrid: !s.showLiveLoopsGrid })),
    toggleTracksArea: () => set(s => ({ showTracksArea: !s.showTracksArea })),
    toggleGlobalTracks: () => set(s => ({ showGlobalTracks: !s.showGlobalTracks })),
    toggleHideView: () => set(s => ({ hideViewActive: !s.hideViewActive })),
    toggleBounceTrackDialog: (trackId) => set({ showBounceTrackDialog: trackId || null }),
    toggleBounceRegionsDialog: (clipIds) => set({ showBounceRegionsDialog: clipIds || null }),
    toggleBounceAllTracksDialog: (show) => set(s => ({ showBounceAllTracksDialog: show !== undefined ? show : !s.showBounceAllTracksDialog })),

    bounceTrackInPlace: async (trackId, settings) => {
        const s = get();
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return;

        // Render the track's material to audio. This used to create an audio
        // clip with no buffer behind it, so a "bounced" track was silent.
        const trackClipsToRender = s.clips.filter(c => c.trackId === trackId);
        let renderedSampleId: string | undefined;

        if (trackClipsToRender.length > 0) {
            set(state => ({ freezingTrackIds: [...state.freezingTrackIds, trackId] }));
            try {
                const result = await renderTrackOffline(
                    {
                        id: track.id,
                        name: track.name,
                        volume: track.volume,
                        pan: track.pan,
                        muted: track.muted,
                        soloed: track.soloed,
                        instrument: track.instrument,
                        plugins: track.plugins,
                    },
                    trackClipsToRender as unknown as Parameters<typeof renderTrackOffline>[1],
                    s.tempo,
                );
                if (result) {
                    renderedSampleId = `bounce:${trackId}:${Date.now()}`;
                    bufferCacheManager.addBuffer(renderedSampleId, result.buffer);
                }
            } catch (error) {
                console.error('[BounceInPlace] Render failed:', error);
            } finally {
                set(state => ({ freezingTrackIds: state.freezingTrackIds.filter(id => id !== trackId) }));
            }
        }

        set(s => {
        const newTrackId = `bip-${Date.now()}`;
        const newTrack: Track = {
            ...track,
            id: newTrackId,
            name: settings.name || `${track.name}_bip`,
            type: 'audio', // Bopped result is always audio
            orderIndex: track.orderIndex + 1,
            isStack: false,
            parentId: track.parentId,
            alternatives: [{ id: 'alt-1', name: 'Main' }],
            activeAlternativeId: 'alt-1',
            muted: false,
            soloed: false,
            inputMonitoring: false,
            recordEnabled: false,
            hidden: false
        };

        // If Replace Track destination is selected
        let updatedTracks = [...s.tracks];
        if (settings.destination === 'Replace Track') {
            updatedTracks = s.tracks.filter(t => t.id !== trackId);
            newTrack.orderIndex = track.orderIndex;
        }
        updatedTracks.push(newTrack);
        updatedTracks.sort((a, b) => a.orderIndex - b.orderIndex);

        // Add the bounced audio clip
        const trackClips = s.clips.filter(c => c.trackId === trackId);
        const minStart = trackClips.length > 0 ? Math.min(...trackClips.map(c => c.start)) : 0;
        const maxEnd = trackClips.length > 0 ? Math.max(...trackClips.map(c => c.start + c.duration)) : 16;
        
        const bouncedClip: Clip = {
            id: `bounced-clip-${Date.now()}`,
            trackId: newTrackId,
            alternativeId: 'alt-1',
            type: 'audio',
            name: `${newTrack.name} Region`,
            start: minStart,
            startTime: minStart,
            duration: maxEnd - minStart,
            offset: 0,
            color: track.color,
            muted: false,
            loop: false,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0,
            fadeIn: { duration: 0, curve: 'linear', gain: 1 },
            fadeOut: { duration: 0, curve: 'linear', gain: 1 },
            playbackRate: 1,
            pitchOffset: 0,
            stretchMode: 'none',
            // Points at the freshly rendered buffer so the clip actually sounds.
            sampleId: renderedSampleId,
        };

        return {
            tracks: updatedTracks,
            clips: [...s.clips, bouncedClip],
            showBounceTrackDialog: null,
            isDirty: true
        };
        });
    },

    bounceRegionsInPlace: (clipIds, settings) => set(s => {
        if (clipIds.length === 0) return {};
        const firstClipId = clipIds[0];
        const firstSample = s.clips.find(c => c.id === firstClipId);
        if (!firstSample) return {};
        
        const sourceTrackId = firstSample.trackId;
        const sourceTrack = s.tracks.find(t => t.id === sourceTrackId);
        if (!sourceTrack) return {};

        const newTrackId = settings.destination === 'New Track' ? `bip-reg-${Date.now()}` : sourceTrackId;
        
        const bouncedClips: Clip[] = [];
        clipIds.forEach(cid => {
            const clip = s.clips.find(c => c.id === cid);
            if (clip) {
                bouncedClips.push({
                    ...clip,
                    id: `bip-clip-${Date.now()}-${Math.random()}`,
                trackId: newTrackId,
                alternativeId: clip.alternativeId,
                type: 'audio',
                name: settings.name || `${clip.name}_bip`,
                color: sourceTrack.color,
                start: clip.start,
                duration: clip.duration,
                offset: clip.offset,
                muted: false,
                loop: clip.loop,
                qSwing: clip.qSwing,
                transpose: clip.transpose,
                velocityOffset: clip.velocityOffset
            });
            }
        });

        const updates: any = {
            clips: [...s.clips.filter(c => !clipIds.includes(c.id)), ...bouncedClips],
            showBounceRegionsDialog: null,
            isDirty: true
        };

        if (settings.destination === 'New Track') {
            const newTrack: Track = {
                ...sourceTrack,
                id: newTrackId,
                name: settings.name || `${sourceTrack.name}_bip`,
                type: 'audio',
                orderIndex: sourceTrack.orderIndex + 1,
                isStack: false,
                parentId: sourceTrack.parentId,
                alternatives: [],
                activeAlternativeId: '',
            };
            updates.tracks = [...s.tracks, newTrack];
            updates.tracks.sort((a: Track, b: Track) => a.orderIndex - b.orderIndex);
        }

        return updates;
    }),

    bounceReplaceAllTracks: (settings) => set(s => {
        const newTracks: Track[] = [];
        const newClips: Clip[] = [];

        s.tracks.forEach(t => {
            if (t.isStack) {
                newTracks.push(t);
                return;
            }
            const bouncedTrackId = `bip-all-${t.id}-${Date.now()}`;
            newTracks.push({
                ...t,
                id: bouncedTrackId,
                type: 'audio',
                name: `${t.name}_bip`
            });
            
            const trackClips = s.clips.filter(c => c.trackId === t.id);
            if (trackClips.length > 0) {
                const minStart = Math.min(...trackClips.map(c => c.start));
                const maxEnd = Math.max(...trackClips.map(c => c.start + c.duration));
                newClips.push({
                    id: `bip-all-clip-${t.id}-${Date.now()}`,
                    trackId: bouncedTrackId,
                    alternativeId: t.activeAlternativeId,
                    type: 'audio',
                    name: `${t.name}_bip region`,
                    start: minStart,
                    startTime: minStart,
                    duration: maxEnd - minStart,
                    offset: 0,
                    color: t.color,
                    muted: false,
                    loop: false,
                    qSwing: 0,
                    transpose: 0,
                    velocityOffset: 0,
                    fadeIn: { duration: 0, curve: 'linear', gain: 1 },
                    fadeOut: { duration: 0, curve: 'linear', gain: 1 },
                    playbackRate: 1,
                    pitchOffset: 0,
                    stretchMode: 'none'
                });
            }
        });

        return {
            tracks: newTracks,
            clips: newClips,
            showBounceAllTracksDialog: false,
            isDirty: true
        };
    }),

    toggleExportDialog: (type) => set({ showExportDialog: type }),
    setShowSettingsDialog: (show, tab, subTab) => set({
        showSettingsDialog: show,
        // Default to a real tab. Opening Settings without naming one used to
        // leave this empty, and every panel renders on an exact match — so the
        // dialog showed "Settings for '' not available in this version".
        settingsActiveTab: tab ?? 'General',
        settingsActiveSubTab: subTab ?? '',
    }),
    updatePluginParams: (trackId, pluginId, params) => {
        // This used to only call the engine — which was itself a no-op — so
        // `PluginSetting.params` stayed permanently `{}` and every knob move was
        // lost on both ends. Merge into the store so it persists, then apply.
        set(s => ({
            tracks: s.tracks.map(t => t.id !== trackId ? t : {
                ...t,
                plugins: t.plugins.map(p => p.id !== pluginId ? p : {
                    ...p,
                    params: { ...p.params, ...params },
                }),
            }),
            isDirty: true,
        }));
        audioEngine.updatePluginParams(trackId, pluginId, params);
    },

    pluginBrowserTrackId: null,
    pluginBrowserMode: 'all',
    setPluginBrowserTrack: (trackId, mode = 'all') =>
        set({ pluginBrowserTrackId: trackId, pluginBrowserMode: mode }),

    setWamInstrument: async (trackId, entry) => {
        const ok = await audioEngine.loadWamInstrument(trackId, entry.url, entry.identifier);
        if (!ok) return false;

        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId ? {
                ...t,
                instrument: entry.name,
                instrumentLoaded: true,
                // Recorded so the instrument can be restored on reload.
                wamInstrument: { url: entry.url, identifier: entry.identifier, name: entry.name },
            } : t),
            isDirty: true,
        }));
        return true;
    },

    addWamPlugin: (trackId, entry) => {
        const newPlugin: PluginSetting = {
            id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            pluginId: entry.identifier,
            name: entry.name,
            enabled: true,
            params: {},
            format: 'wam',
            insertPoint: 'pre',
            wam: { url: entry.url, identifier: entry.identifier },
        };
        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: [...t.plugins, newPlugin] } : t),
            isDirty: true,
        }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
        return newPlugin.id;
    },

    removePlugin: (trackId, pluginId) => {
        get().saveHistorySnapshot();
        set(s => ({
            tracks: s.tracks.map(t => t.id !== trackId ? t : {
                ...t,
                plugins: t.plugins.filter(p => p.id !== pluginId),
            }),
            isDirty: true,
        }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
    },

    reorderPlugins: (trackId, fromIndex, toIndex) => {
        get().saveHistorySnapshot();
        set(s => ({
            tracks: s.tracks.map(t => {
                if (t.id !== trackId) return t;
                const plugins = [...t.plugins];
                if (fromIndex < 0 || fromIndex >= plugins.length) return t;
                const [moved] = plugins.splice(fromIndex, 1);
                plugins.splice(Math.max(0, Math.min(toIndex, plugins.length)), 0, moved);
                return { ...t, plugins };
            }),
            isDirty: true,
        }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
    },
    /**
     * Render the project and save it.
     *
     * This used to be a `console.log` that closed the dialog — the final step
     * of writing a track produced no file at all.
     */
    exportProject: async (settings = {}) => {
        const s = get();
        const result = await exportProjectAudio(
            {
                tracks: s.tracks,
                clips: s.clips,
                tempo: s.tempo,
                projectName: s.name,
                masterPlugins: s.masterPlugins,
            },
            settings,
        );

        if (result.degradedTracks.length) {
            console.warn(
                '[Export] Rendered dry because their plugins failed to load:',
                result.degradedTracks,
            );
        }
        if (result.formatNotice) console.warn('[Export]', result.formatNotice);

        return result;
    },

    exportAsAudioFiles: (settings) => {
        void get().exportProject(settings ?? {})
            .then(result => {
                downloadExport(result);
                set({ showExportDialog: null });
            })
            .catch(error => {
                console.error('[Export] Failed:', error);
                set({ loadError: `Export failed: ${error instanceof Error ? error.message : error}` });
            });
    },

    toggleShareDialog: (show) => set(s => ({ showShareDialog: show !== undefined ? show : !s.showShareDialog })),
    shareProject: async (options) => {
        const s = get();
        const projectPayload = {
            id: s.id,
            name: s.name,
            tempo: s.tempo,
            tracks: s.tracks,
            clips: s.clips,
            globalTracks: s.globalTracks,
            settings: s.settings,
            alternatives: s.alternatives,
            currentAlternativeId: s.currentAlternativeId,
            assets: {
                copyAudioFiles: s.settings.assets.copyAudioFiles,
                copySamplerFiles: s.settings.assets.copySamplerFiles,
                copyMovieFiles: s.settings.assets.copyMovieFiles
            }
        };

        const fileName = options?.customName
            ? `${options.customName}.${options.format === 'project' ? 'dawproj' : 'json'}`
            : `${s.name || 'Untitled_Project'}-${options?.format || 'project'}.${options?.format === 'project' ? 'dawproj' : 'json'}`;

        const payload = options?.format === 'song'
            ? { message: 'Song mixdown export is simulated in this prototype. Create audio files via bounce workflow.' }
            : projectPayload;

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: options?.format === 'song' ? 'audio/wav' : 'application/json' });

        const downloadUrl = URL.createObjectURL(blob);

        if (options?.destination === 'web-share' && typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
                // Web Share API currently does not support raw blobs in all browsers; some support file objects
                const file = new File([blob], fileName, { type: blob.type });
                await (navigator as any).share({ title: s.name, text: `Sharing ${s.name} as ${options?.format}`, files: [file] });
            } catch (e) {
                console.warn('Web share failed, falling back to download', e);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = fileName;
                a.click();
            }
        } else {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            a.click();
        }

        set({ showShareDialog: false });
    },

    toggleVirtualKeyboard: (show) => set(s => ({ showVirtualKeyboard: show !== undefined ? show : !s.showVirtualKeyboard })),
    setVirtualKeyboardMode: (mode) => set({ virtualKeyboardMode: mode }),
    setOpenPluginEditor: (editor) => set({ openPluginEditor: editor }),
    updateVirtualKeyboardParams: (updates) => {
        set(s => ({
            virtualKeyboardOctave: updates.octave !== undefined ? updates.octave : s.virtualKeyboardOctave,
            virtualKeyboardVelocity: updates.velocity !== undefined ? updates.velocity : s.virtualKeyboardVelocity,
            virtualKeyboardPitchBend: updates.pitchBend !== undefined ? updates.pitchBend : s.virtualKeyboardPitchBend,
            virtualKeyboardModulation: updates.modulation !== undefined ? updates.modulation : s.virtualKeyboardModulation,
            virtualKeyboardSustain: updates.sustain !== undefined ? updates.sustain : s.virtualKeyboardSustain,
        }));
    },

    triggerNote: (pitch, velocity, trackId, depth = 0) => {
        if (depth > 5) return;
        const { 
            focusedTrackId, tracks, recording, playhead, 
            noteRepeatSettings, spotEraseSettings, liveRecordingClips, 
            clips, showStepInputKeyboard, stepInputSettings, snap 
        } = get();
        
        const targetTrackId = trackId || focusedTrackId;
        if (!targetTrackId) return;

        const targetTrack = tracks.find(t => t.id === targetTrackId);
        if (!targetTrack) return;

        // Buffer for Flashback Recording (last N beats of note events)
        const flashbackEntry = { trackId: targetTrackId, pitch, velocity, time: playhead, duration: 0, noteId: `fb-${Date.now()}-${targetTrackId}-${pitch}` };
        set(s => ({
            flashbackBuffer: [
                ...(s.flashbackBuffer || []).filter(e => e.time >= playhead - s.flashbackDuration),
                flashbackEntry
            ]
        }));

        // Block external input if Internal Only
        if (!trackId && targetTrack.internalMidiInSourceId && targetTrack.internalMidiInRecordMode === 'Internal Only') {
            return;
        }

        if (targetTrackId === focusedTrackId) {
            // --- Step Input Mode --- (Direct user input only)
            if (showStepInputKeyboard && !trackId) {
                // Determine step duration in beats
                const lengthMap: Record<string, number> = {
                    '1/1': 4, '1/2': 2, '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125, '1/64': 0.0625
                };
                let duration = lengthMap[stepInputSettings.length] || 0.25;
                if (stepInputSettings.triplet) duration *= (2/3);
                if (stepInputSettings.dot) duration *= 1.5;

                // Find or create clip for step input
                let clip = clips.find(c => c.trackId === targetTrackId && playhead >= c.start && playhead < c.start + c.duration);
                if (!clip) {
                    const newClipId = `clip-step-${Date.now()}`;
                    const newClip: Clip = {
                        id: newClipId,
                        trackId: targetTrackId,
                        type: 'midi',
                        name: 'Step Recording',
                        alternativeId: targetTrack.activeAlternativeId || 'default',
                        start: Math.floor(playhead),
                        startTime: Math.floor(playhead),
                        duration: 8,
                        offset: 0,
                        muted: false,
                        loop: false,
                        transpose: 0,
                        velocityOffset: 0,
                        qSwing: 0,
                        color: targetTrack.color || '#5dd3ff',
                        notes: [],
                        fadeIn: { duration: 0, curve: 'linear', gain: 1 },
                        fadeOut: { duration: 0, curve: 'linear', gain: 1 },
                        playbackRate: 1,
                        pitchOffset: 0,
                        stretchMode: 'none'
                    };
                    set(s => ({ clips: [...s.clips, newClip] }));
                    clip = newClip;
                }

                const velocityMap: Record<string, number> = {
                    'ppp': 16, 'pp': 32, 'p': 48, 'mp': 64, 'mf': 80, 'f': 96, 'ff': 112, 'fff': 127
                };
                const finalVel = velocityMap[stepInputSettings.velocity] || 80;

                set(s => ({
                    clips: s.clips.map(c => {
                        if (c.id === (clip?.id)) {
                            return {
                                ...c,
                                notes: [...(c.notes || []), {
                                    id: `note-step-${Date.now()}-${pitch}`,
                                    pitch,
                                    velocity: finalVel,
                                    start: playhead - c.start,
                                    duration: duration
                                }]
                            };
                        }
                        return c;
                    })
                }));

                if (!stepInputSettings.chord) {
                    set({ playhead: playhead + duration });
                }
                
                audioEngine.triggerNote(targetTrackId, pitch, velocity, undefined, targetTrack.instrument);
                setTimeout(() => audioEngine.releaseNote(targetTrackId, pitch), 150);

                // propagate step input? Logic usually doesn't, but for consistency we might.
                // For now, only propagate "live" triggers.
                return;
            }

            if (spotEraseSettings.enabled) {
                set(s => ({
                    clips: s.clips.map(c => {
                        if (c.trackId !== targetTrackId || !c.notes) return c;
                        return {
                            ...c,
                            notes: c.notes.filter(n => {
                                const absStart = c.start + n.start;
                                const absEnd = absStart + n.duration;
                                return !(n.pitch === pitch && playhead >= absStart && playhead <= absEnd);
                            })
                        };
                    })
                }));
            }
        }

        // --- Replace Mode Logic ---
        const { replaceMode, replaceModeType } = get();
        if (recording && replaceMode && (targetTrack.recordEnabled || targetTrackId === focusedTrackId)) {
            if (replaceModeType === 'Region Erase' || replaceModeType === 'Region Punch') {
                set(s => ({
                    clips: s.clips.filter(c => {
                        if (c.trackId !== targetTrackId) return true;
                        const isOverlapping = playhead >= c.start && playhead <= (c.start + c.duration);
                        return !isOverlapping;
                    })
                }));
            } else if (replaceModeType === 'Content Erase' || replaceModeType === 'Content Punch') {
                set(s => ({
                    clips: s.clips.map(c => {
                        if (c.trackId !== targetTrackId || !c.notes) return c;
                        return {
                            ...c,
                            notes: c.notes.filter(n => {
                                const absStart = c.start + n.start;
                                const absEnd = absStart + n.duration;
                                return !(playhead >= absStart && playhead <= absEnd);
                            })
                        };
                    })
                }));
            }
        }

        const repeatRate = (targetTrackId === focusedTrackId && noteRepeatSettings.enabled) ? noteRepeatSettings.rate : undefined;
        // Pass the track's instrument: without it the engine cannot reach the
        // sampler backends and every note fell through to the built-in synth.
        audioEngine.triggerNote(targetTrackId, pitch, velocity, repeatRate, targetTrack.instrument);
        
        if (recording && (targetTrack.recordEnabled || (targetTrackId === focusedTrackId && !tracks.some(t => t.recordEnabled)))) {
            let liveClipId = liveRecordingClips[targetTrackId];
            if (!liveClipId) {
                liveClipId = `clip-rec-${Date.now()}-${targetTrackId}`;
                const newClip: Clip = {
                    id: liveClipId,
                    trackId: targetTrackId,
                    type: 'midi',
                    name: `MIDI Tape ${pitch}`,
                    alternativeId: targetTrack.activeAlternativeId || 'default',
                    start: playhead,
                    startTime: playhead,
                    duration: 1, 
                    offset: 0,
                    muted: false,
                    loop: false,
                    transpose: 0,
                    velocityOffset: 0,
                    qSwing: 0,
                    color: targetTrack.color || '#5dd3ff',
                    notes: [],
                    fadeIn: { duration: 0, curve: 'linear', gain: 1 },
                    fadeOut: { duration: 0, curve: 'linear', gain: 1 },
                    playbackRate: 1,
                    pitchOffset: 0,
                    stretchMode: 'none'
                };
                set(s => ({ 
                    clips: [...s.clips, newClip],
                    liveRecordingClips: { ...s.liveRecordingClips, [targetTrackId]: liveClipId }
                }));
            }

            const noteId = `note-${Date.now()}-${recordedNoteSeq++}-${pitch}`;
            // Remember which note this is, so note-off lengthens exactly this
            // one. Re-pressing a pitch that is still held closes the old note
            // first rather than orphaning it.
            heldRecordingNotes.set(`${targetTrackId}:${pitch}`, {
                clipId: liveClipId, noteId, startBeat: playhead,
            });

            set(s => ({
                clips: s.clips.map(c => {
                    if (c.id !== liveClipId) return c;
                    const startInClip = Math.max(0, playhead - c.start);
                    return {
                        ...c,
                        // A clip that does not reach its own notes plays none
                        // of them: the sequencer clips every note to the clip
                        // end. This used to be created at a fixed 1 beat.
                        duration: Math.max(c.duration ?? 0, startInClip + MIN_RECORDED_NOTE_BEATS),
                        notes: [...(c.notes || []), {
                            id: noteId,
                            pitch,
                            velocity,
                            start: startInClip,
                            duration: MIN_RECORDED_NOTE_BEATS
                        }]
                    };
                })
            }));
        }

        // --- Propagation ---
        tracks.forEach(track => {
            if (track.internalMidiInSourceId === targetTrackId && track.internalMidiInType !== 'Off') {
                // Choice: Instrument Input vs MIDI to Track. 
                // In our model, we just propagate the trigger.
                if (track.recordEnabled || track.inputMonitoring) {
                    get().triggerNote(pitch, velocity, track.id, depth + 1);
                }
            }
        });
    },

    releaseNote: (pitch, trackId, depth = 0) => {
        if (depth > 5) return;
        const { focusedTrackId, recording, playhead, liveRecordingClips, tracks } = get();
        const targetTrackId = trackId || focusedTrackId;
        if (!targetTrackId) return;

        audioEngine.releaseNote(targetTrackId, pitch);

        // Update flashback buffer durations on note release
        set(s => ({
            flashbackBuffer: (s.flashbackBuffer || []).map(e => {
                if (e.trackId === targetTrackId && e.pitch === pitch && e.duration === 0) {
                    return { ...e, duration: Math.max( (playhead - e.time), 0.0625) };
                }
                return e;
            }).filter(e => e.time >= playhead - s.flashbackDuration)
        }));
        
        if (recording) {
            const key = `${targetTrackId}:${pitch}`;
            const held = heldRecordingNotes.get(key);
            if (held) {
                heldRecordingNotes.delete(key);
                const duration = Math.max(MIN_RECORDED_NOTE_BEATS, playhead - held.startBeat);
                set(s => ({
                    clips: s.clips.map(c => {
                        if (c.id !== held.clipId) return c;
                        const note = c.notes?.find(n => n.id === held.noteId);
                        const end = (note?.start ?? 0) + duration;
                        return {
                            ...c,
                            duration: Math.max(c.duration ?? 0, end),
                            // Matched by identity, so releasing one note cannot
                            // rewrite another that shares its pitch.
                            notes: c.notes?.map(n => n.id === held.noteId ? { ...n, duration } : n),
                        };
                    })
                }));
            }
        }

        // Propagation
        tracks.forEach(track => {
            if (track.internalMidiInSourceId === targetTrackId && track.internalMidiInType !== 'Off') {
                if (track.recordEnabled || track.inputMonitoring) {
                    get().releaseNote(pitch, track.id, depth + 1);
                }
            }
        });
    },

    toggleNoteRepeat: (show) => set(s => ({ showNoteRepeatDialog: show !== undefined ? show : !s.showNoteRepeatDialog })),
    updateNoteRepeatSettings: (updates) => set(s => ({ noteRepeatSettings: { ...s.noteRepeatSettings, ...updates } })),
    toggleSpotErase: (show) => set(s => ({ showSpotEraseDialog: show !== undefined ? show : !s.showSpotEraseDialog })),
    updateSpotEraseSettings: (updates) => set(s => ({ spotEraseSettings: { ...s.spotEraseSettings, ...updates } })),
    toggleStepInput: (show) => set(s => ({ showStepInputKeyboard: show !== undefined ? show : !s.showStepInputKeyboard })),
    updateStepInputSettings: (updates) => set(s => ({ stepInputSettings: { ...s.stepInputSettings, ...updates } })),

    selectClips: (ids) => set({ selectedClipIds: ids, selectedClipId: ids[0] || null }),

    // --- Automation Selection Actions ---
    selectAutomationPoint: (pointId, additive = false) => set(s => {
        if (additive) {
            const ids = s.selectedAutomationPointIds.includes(pointId) 
                ? s.selectedAutomationPointIds 
                : [...s.selectedAutomationPointIds, pointId];
            return { selectedAutomationPointIds: ids, selectedAutomationPointId: pointId };
        }
        return { selectedAutomationPointIds: [pointId], selectedAutomationPointId: pointId };
    }),
    deselectAutomationPoint: (pointId) => set(s => ({
        selectedAutomationPointIds: s.selectedAutomationPointIds.filter(id => id !== pointId),
        selectedAutomationPointId: s.selectedAutomationPointId === pointId ? null : s.selectedAutomationPointId
    })),
    toggleAutomationPointSelection: (pointId) => set(s => ({
        selectedAutomationPointIds: s.selectedAutomationPointIds.includes(pointId)
            ? s.selectedAutomationPointIds.filter(id => id !== pointId)
            : [...s.selectedAutomationPointIds, pointId],
        selectedAutomationPointId: pointId
    })),
    selectAutomationPoints: (ids) => set({ selectedAutomationPointIds: ids, selectedAutomationPointId: ids[0] || null }),
    deselectAllAutomationPoints: () => set({ selectedAutomationPointIds: [], selectedAutomationPointId: null }),

    copySelectedClips: () => {
        const s = get();
        const selected = s.clips.filter(c => s.selectedClipIds.includes(c.id));
        set({ regionClipboard: selected.map(c => ({ ...c })) });
    },
    cutSelectedClips: () => {
        const s = get();
        const selectedIds = s.selectedClipIds;
        const selected = s.clips.filter(c => selectedIds.includes(c.id));
        set({ regionClipboard: selected.map(c => ({ ...c })), clips: s.clips.filter(c => !selectedIds.includes(c.id)), selectedClipIds: [], selectedClipId: null });
    },
    pasteClipsAtPlayhead: () => {
        const s = get();
        if (s.regionClipboard.length === 0) return;
        const minStart = Math.min(...s.regionClipboard.map(c => c.start));
        const pasteStart = s.playhead;
        const newClips = s.regionClipboard.map(c => ({
            ...c,
            id: `${c.id}-paste-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            start: Math.max(0, c.start - minStart + pasteStart),
            trackId: s.focusedTrackId || c.trackId,
            muted: false,
            alternativeId: c.alternativeId || 'alt-1'
        } as Clip));

        set({ clips: [...s.clips, ...newClips], selectedClipIds: newClips.map(c => c.id), selectedClipId: newClips[0]?.id || null, isDirty: true });
    },
    deleteSelectedClips: () => {
        const s = get();
        set({ clips: s.clips.filter(c => !s.selectedClipIds.includes(c.id)), selectedClipIds: [], selectedClipId: null, isDirty: true });
    },

    setTrackHidden: (trackId, hidden) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, hidden } : t),
        isDirty: true
    })),
    unhideAllTracks: () => set(s => ({
        tracks: s.tracks.map(t => ({ ...t, hidden: false })),
        hideViewActive: false,
        isDirty: true
    })),
    toggleSearchAndSelect: (show) => set({ showSearchAndSelect: show }),
    setBottomPanel: (p) => set({ bottomPanel: p }),
    setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
    setPianoRollLinkMode: (mode) => set({ pianoRollLinkMode: mode }),
    setPianoRollFocusClipId: (clipId) => set({ pianoRollFocusClipId: clipId }),
    toggleMetronome: () => {
        set(s => {
            if (s.settings.metronome.simpleMode) {
                return { metronomeEnabled: !s.metronomeEnabled };
            }
            const nextClickPlaying = !s.settings.metronome.clickWhilePlaying;
            return {
                metronomeEnabled: nextClickPlaying,
                settings: { ...s.settings, metronome: { ...s.settings.metronome, clickWhilePlaying: nextClickPlaying } }
            };
        });
        // Reflect the change on the running transport so the click starts or
        // stops immediately rather than at the next play.
        const s = get();
        syncMetronome(s.settings, s.metronomeEnabled, s.recording ? 'record' : s.playing ? 'play' : 'stop');
    },
    toggleCountIn: () => set(s => ({ countInEnabled: !s.countInEnabled })),
    setCountInBars: (bars) => set({ countInBars: bars }),
    setMetronomeSetting: (key, value) => {
        set(s => {
            const metronomeUpdate = { ...s.settings.metronome, [key]: value };

            // Handle dependencies based on Logic Pro logic
            if (key === 'simpleMode') {
                // Unhandled dependencies in UI but logic sync:
                if (value) metronomeUpdate.clickWhilePlaying = s.metronomeEnabled;
            } else if (key === 'clickWhilePlaying') {
                return { metronomeEnabled: value, settings: { ...s.settings, metronome: metronomeUpdate } };
            } else if (key === 'clickWhileRecording' && value === false) {
                // "Click While Recording must also be chosen for only During Count-In to work"
                metronomeUpdate.onlyDuringCountIn = false;
            }

            return { settings: { ...s.settings, metronome: metronomeUpdate } };
        });
        const s = get();
        syncMetronome(s.settings, s.metronomeEnabled, s.recording ? 'record' : s.playing ? 'play' : 'stop');
    },

    selectTrack: (id, isMulti, isShift) => set(s => {
        if (!id) return { selectedTrackIds: [], focusedTrackId: null };

        let newState: any = {};

        // Internal Logic Selection Rules
        if (isMulti) {
            const current = [...s.selectedTrackIds];
            if (current.includes(id)) {
                newState = {
                    selectedTrackIds: current.filter(cid => cid !== id),
                    focusedTrackId: s.focusedTrackId === id ? (current[0] || null) : s.focusedTrackId
                };
            } else {
                newState = { selectedTrackIds: [...current, id], focusedTrackId: id };
            }
        } else if (isShift && s.focusedTrackId) {
            const tracks = s.tracks;
            const focusedIdx = tracks.findIndex(t => t.id === s.focusedTrackId);
            const targetIdx = tracks.findIndex(t => t.id === id);
            const start = Math.min(focusedIdx, targetIdx);
            const end = Math.max(focusedIdx, targetIdx);
            const range = tracks.slice(start, end + 1).map(t => t.id);
            newState = { selectedTrackIds: range, focusedTrackId: id };
        } else {
            newState = { selectedTrackIds: [id], focusedTrackId: id };
        }

        // Logic Pro behavior: Focused track gets auto-record enable if no others are record-enabled
        // We will handle the visual state in the component, but we can ensure internal state is clean.
        return newState;
    }),

    selectTracks: (ids, focusedId) => set({ selectedTrackIds: ids, focusedTrackId: focusedId || (ids.length > 0 ? ids[0] : null) }),

    duplicateTracks: (mode) => set(s => {
        const focusedId = s.focusedTrackId;
        if (!focusedId) return {};

        const toDuplicate = s.selectedTrackIds.length > 0 ? s.selectedTrackIds : [focusedId];
        const newTracks: Track[] = [];
        const newClips: Clip[] = [];

        toDuplicate.forEach(tid => {
            const original = s.tracks.find(t => t.id === tid);
            if (!original) return;

            const newId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
            const name = mode === 'shared' ? `${original.name} (Shared)` : original.name;

            const nextTrack: Track = {
                ...JSON.parse(JSON.stringify(original)),
                id: newId,
                name: name,
                orderIndex: original.orderIndex + 1, // Adjusted to use original.orderIndex + 1
                channelStripId: mode === 'shared' ? (original.channelStripId || original.id) : newId,
                parentId: undefined,
                zoom: original.zoom || 1,
                recordEnabled: false, inputMonitoring: false,
                protected: false, frozen: false, enabled: true,
                freezeMode: original.freezeMode || 'Source Only',
                alternatives: JSON.parse(JSON.stringify(original.alternatives)),
                activeAlternativeId: original.activeAlternativeId,
                showInactiveAlternatives: false,
                hidden: false
            };
            newTracks.push(nextTrack);

            if (mode === 'content') {
                const trackClips = s.clips.filter(c => c.trackId === tid);
                trackClips.forEach(c => {
                    newClips.push({
                        ...JSON.parse(JSON.stringify(c)),
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        trackId: newId
                    });
                });
            }
        });

        const updatedTracks = [...s.tracks];
        // Sort by order index and re-index
        newTracks.forEach(nt => {
            updatedTracks.forEach(t => {
                if (t.orderIndex >= nt.orderIndex) t.orderIndex++;
            });
            updatedTracks.push(nt);
        });

        updatedTracks.sort((a, b) => a.orderIndex - b.orderIndex);

        return {
            tracks: updatedTracks,
            clips: [...s.clips, ...newClips],
            selectedTrackIds: newTracks.map(t => t.id),
            focusedTrackId: newTracks[0].id,
            isDirty: true
        };
    }),

    reorderTracks: (draggedIndex: number, hoverIndex: number) => set(s => {
        const updatedTracks = [...s.tracks];
        const [movedTrack] = updatedTracks.splice(draggedIndex, 1);
        updatedTracks.splice(hoverIndex, 0, movedTrack);

        // Update orderIndices
        const finalized = updatedTracks.map((t, idx) => ({ ...t, orderIndex: idx }));
        return { tracks: finalized, isDirty: true };
    }),

    toggleStackCollapse: (trackId, recursive) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track || !track.isStack) return {};
        const newState = !track.isCollapsed;
        
        if (recursive) {
            // Option-click behavior
            return {
                tracks: s.tracks.map(t => t.isStack ? { ...t, isCollapsed: newState } : t)
            };
        }
        
        return {
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, isCollapsed: newState } : t)
        };
    }),

    convertStackType: (trackId, type) => set(s => ({
        tracks: s.tracks.map(t => {
            if (t.id === trackId) return { ...t, stackType: type };
            if (t.parentId === trackId && type === 'Summing') return { ...t, outputBusId: trackId };
            return t;
        })
    })),

    setGrooveTrack: (trackId) => set(s => ({
        tracks: s.tracks.map(t => ({
            ...t,
            isGrooveTrack: t.id === trackId ? !t.isGrooveTrack : false
        }))
    })),

    toggleMatchGroove: (trackId) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, matchGrooveTrack: !t.matchGrooveTrack } : t)
    })),

    sortTracks: (by) => set(s => {
        const sorted = [...s.tracks].sort((a, b) => {
            switch (by) {
                case 'name': return a.name.localeCompare(b.name);
                case 'type': return a.type.localeCompare(b.type);
                case 'instrument': return (a.icon || '').localeCompare(b.icon || '');
                case 'output': return a.outputBusId.localeCompare(b.outputBusId);
                case 'midi': {
                    const aChan = a.midiOutChannel === 'All' ? 0 : (a.midiOutChannel || 0);
                    const bChan = b.midiOutChannel === 'All' ? 0 : (b.midiOutChannel || 0);
                    return aChan - bChan;
                }
                default: return 0;
            }
        });
        return { tracks: sorted.map((t, idx) => ({ ...t, orderIndex: idx })), isDirty: true };
    }),

    updateTrackZoom: (trackId: string, zoom: number) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, zoom } : t)
    })),

    resetAllTrackZoom: () => set(s => ({
        tracks: s.tracks.map(t => ({ ...t, zoom: 1 }))
    })),

    toggleColorPalette: (show: boolean) => set({ showColorPalette: show }),
    toggleIconBrowser: (trackId: string | null) => set({ showIconBrowser: trackId }),
    toggleDrumReplacement: (trackId) => set({ showDrumReplacement: trackId !== null, drumReplacementTargetId: trackId }),
    toggleTrackHeaderConfig: (show) => set({ showTrackHeaderConfig: show }),
    updateTrackHeaderConfig: (config) => set(s => ({
        trackHeaderConfig: { ...s.trackHeaderConfig, ...config }
    })),
    setTrackHeaderWidth: (width) => set({ trackHeaderWidth: width }),

    // Library Actions
    setLibrarySearchQuery: (query) => set({ librarySearchQuery: query }),
    toggleLibraryPatchMerging: (enabled) => set(s => ({ libraryPatchMerging: enabled !== undefined ? enabled : !s.libraryPatchMerging })),
    setLibraryMergingOption: (option, enabled) => set(s => ({
        libraryMergingOptions: { ...s.libraryMergingOptions, [option]: enabled }
    })),
    setLibrarySelectedPresetId: (id) => set({ librarySelectedPresetId: id }),
    applyPatch: (trackId, presetId) => {
        const { tracks, libraryMergingOptions, updateTrack, articulationSets } = get();
        const track = tracks.find(t => t.id === trackId);
        if (!track) return;

        // Lookup preset to get engine type and display name
        const preset: Preset | undefined = libraryData.flatMap(c => c.presets).find(p => p.id === presetId);
        const presetName = preset?.name || presetId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const updates: Partial<Track> = {};
        updates.name = presetName;
        if (preset?.engine) {
            updates.instrument = preset.name;
        }
        
        // Auto-assign articulation set for Studio Horns / Strings if detected
        if (presetId.includes('horn') || presetId.includes('string')) {
            const hornSetName = presetId.includes('horn') ? 'Studio Horns' : 'Studio Strings';
            let hornSet = articulationSets.find(s => s.name === hornSetName);
            if (!hornSet) {
                // Pre-populate a demo set
                const newSet: ArticulationSet = {
                    id: `set-${Date.now()}`,
                    name: hornSetName,
                    articulations: [
                        { id: 1, name: 'Sustain', channel: '-', symbol: '-' },
                        { id: 2, name: 'Staccato', channel: '-', symbol: 'Staccato' },
                        { id: 6, name: 'Expressive Medium', channel: '-', symbol: '-' },
                        { id: 8, name: 'Expressive Short', channel: '-', symbol: '-' },
                        { id: 10, name: 'Fall Long', channel: '-', symbol: 'Fall Long' },
                    ],
                    switches: [
                        { type: 'Note On', selector: 'C0', valueStart: '-', valueEnd: '-', mode: 'Permanent (Retrigger)', articulationId: 1 },
                        { type: 'Note On', selector: 'F0', valueStart: '-', valueEnd: '-', mode: 'Permanent', articulationId: 2 },
                    ],
                    outputs: [],
                    midiRemote: true,
                    midiChannel: 'All',
                    octaveOffset: 0
                };
                set(s => ({ articulationSets: [...s.articulationSets, newSet] }));
                updates.articulationSetId = newSet.id;
            } else {
                updates.articulationSetId = hornSet.id;
            }
        }

        updateTrack(trackId, updates);

        // Actually load the instrument. Setting `track.instrument` only renames
        // what the track claims to be; unless the instrument is registered with
        // the instrument service, playback falls through to the built-in synth
        // and the Library selection is inaudible.
        if (updates.instrument) {
            void initializeInstruments(
                [{ id: trackId, instrument: updates.instrument }],
                (id) => updateTrack(id, { instrumentLoaded: true }),
            ).catch(err => console.warn('[Library] Instrument load failed:', err));
        }
    },

    toggleArticulationEditor: (show, setId) => set(s => ({
        showArticulationEditor: show !== undefined ? show : !s.showArticulationEditor,
        editingArticulationSetId: setId !== undefined ? setId : s.editingArticulationSetId
    })),

    addArticulationSet: (trackId) => set(s => {
        const newSet: ArticulationSet = {
            id: `set-${Date.now()}`,
            name: 'New Articulation Set',
            articulations: [{ id: 1, name: 'Sustain', channel: '-', symbol: '-' }],
            switches: [],
            outputs: [],
            midiRemote: true,
            midiChannel: 'All',
            octaveOffset: 0
        };
        return {
            articulationSets: [...s.articulationSets, newSet],
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, articulationSetId: newSet.id } : t)
        };
    }),

    updateArticulationSet: (id, updates) => set(s => ({
        articulationSets: s.articulationSets.map(aset => aset.id === id ? { ...aset, ...updates } : aset)
    })),

    deleteArticulationSet: (id) => set(s => ({
        articulationSets: s.articulationSets.filter(aset => aset.id !== id),
        tracks: s.tracks.map(t => t.articulationSetId === id ? { ...t, articulationSetId: undefined } : t)
    })),

    setArticulationForNotes: (clipId, noteIds, articulationId) => set(s => ({
        clips: s.clips.map(c => {
            if (c.id !== clipId || !c.notes) return c;
            return {
                ...c,
                notes: c.notes.map(n => noteIds.includes(n.id) ? { ...n, articulationId } : n)
            };
        })
    })),

    confirmDrumReplacement: (settings) => set(s => {
        const targetTrackId = s.drumReplacementTargetId;
        if (!targetTrackId) return {};

        const originalTrack = s.tracks.find(t => t.id === targetTrackId);
        if (!originalTrack) return {};

        const newId = `track-${Date.now()}`;
        const newTrack: Track = {
            id: newId,
            name: `${originalTrack.name} (Drum Match)`,
            type: 'software-instrument',
            isStack: false,
            muted: false,
            soloed: false,
            volume: 0.8,
            pan: 0,
            color: '#fbbf24',
            icon: 'drum',
            orderIndex: originalTrack.orderIndex + 1,
            recordEnabled: false,
            inputMonitoring: false,
            protected: false, frozen: false, enabled: true,
            freezeMode: 'Source Only',
            alternatives: [{ id: 'alt-1', name: 'A' }],
            activeAlternativeId: 'alt-1',
            showInactiveAlternatives: false,
            transpose: 0,
            velocityOffset: 0,
            delay: 0,
            channel: 'Inst 1',
            plugins: [{ id: 'sampler-1', pluginId: 'logic-sampler', name: 'Sampler', enabled: true, params: {} }],
            sends: [],
            outputBusId: originalTrack.outputBusId,
            channelStripId: newId,
            zoom: 1,
            hidden: false
        };

        // If replacement, mute regions on original track
        // or just mute the original track itself for simplicity in this MVP
        const updatedTracks = s.tracks.map(t => {
            if (t.orderIndex >= newTrack.orderIndex) return { ...t, orderIndex: t.orderIndex + 1 };
            if (t.id === targetTrackId && settings.mode === 'replacement') return { ...t, muted: true };
            return t;
        });
        updatedTracks.push(newTrack);
        updatedTracks.sort((a, b) => a.orderIndex - b.orderIndex);

        // Create MIDI region based on audio regions
        const originalRegions = s.clips.filter(c => c.trackId === targetTrackId);
        const newClips: Clip[] = originalRegions.map(r => ({
            ...r,
            id: `clip-${Date.now()}-${Math.random()}`,
            trackId: newId,
            type: 'midi',
            name: 'Generated Drum MIDI',
            color: '#fbbf24'
        }));

        return {
            tracks: updatedTracks,
            clips: [...s.clips, ...newClips],
            showDrumReplacement: false,
            drumReplacementTargetId: null,
            isDirty: true
        };
    }),

    createTrackForSelectedRegions: () => set(s => {
        // Find which tracks have selected regions
        // Currently selected regions logic is clip selection.
        if (!s.selectedClipId) return {};

        // Logic: For each track that has a selected clip, create a new track with same channel
        const clipsToMove = s.selectedClipId ? [s.selectedClipId] : []; // Need multi-selection for clips too soon
        const tracksToClone = new Set<string>();
        const updatedClips = [...s.clips];

        clipsToMove.forEach(cid => {
            const clip = s.clips.find(c => c.id === cid);
            if (clip) tracksToClone.add(clip.trackId);
        });

        const newTracks: Track[] = [];
        const trackMap = new Map<string, string>(); // original -> new track id

        tracksToClone.forEach(tid => {
            const original = s.tracks.find(t => t.id === tid);
            if (original) {
                const newId = `regtrack-${Date.now()}-${tid}`;
                newTracks.push({
                    ...JSON.parse(JSON.stringify(original)),
                    id: newId,
                    name: `${original.name} Regions`,
                    orderIndex: s.tracks.indexOf(original) + 1,
                    channelStripId: original.channelStripId || original.id,
                    hidden: false
                });
                trackMap.set(tid, newId);
            }
        });

        const movedClips = updatedClips.map(c => {
            if (clipsToMove.includes(c.id)) {
                return { ...c, trackId: trackMap.get(c.trackId) || c.trackId };
            }
            return c;
        });

        const updatedTracks = [...s.tracks];
        newTracks.forEach(nt => {
            updatedTracks.splice(nt.orderIndex, 0, nt);
        });

        return {
            tracks: updatedTracks,
            clips: movedClips,
            selectedTrackIds: newTracks.map(t => t.id),
            focusedTrackId: newTracks[0].id,
            isDirty: true
        };
    }),

    createTrackForOverlappedRegions: (trackId) => set(s => {
        const trackClips = s.clips.filter(c => c.trackId === trackId).sort((a, b) => a.start - b.start);
        if (trackClips.length < 2) return {};

        const layers: Clip[][] = [[]];
        const originalTrack = s.tracks.find(t => t.id === trackId);
        if (!originalTrack) return {};

        trackClips.forEach(clip => {
            let added = false;
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const lastClip = layer[layer.length - 1];
                if (!lastClip || clip.start >= (lastClip.start + lastClip.duration)) {
                    layer.push(clip);
                    added = true;
                    break;
                }
            }
            if (!added) {
                layers.push([clip]);
            }
        });

        if (layers.length <= 1) return {};

        const newTracks: Track[] = [];
        const updatedClips = s.clips.filter(c => c.trackId !== trackId); // Temporarily remove original clips
        const finalClips: Clip[] = [...updatedClips];

        layers.forEach((layer, idx) => {
            const tid = idx === 0 ? trackId : `overlap-${Date.now()}-${idx}`;
            if (idx > 0) {
                newTracks.push({
                    ...JSON.parse(JSON.stringify(originalTrack)),
                    id: tid,
                    name: `${originalTrack.name} (Ch ${idx + 1})`,
                    orderIndex: s.tracks.indexOf(originalTrack) + idx,
                    channelStripId: originalTrack.channelStripId || originalTrack.id,
                    hidden: false
                });
            }
            layer.forEach(c => finalClips.push({ ...c, trackId: tid }));
        });

        const updatedTracks = [...s.tracks];
        newTracks.forEach(nt => updatedTracks.splice(nt.orderIndex, 0, nt));

        return {
            tracks: updatedTracks,
            clips: finalClips,
            isDirty: true
        };
    }),

    selectClip: (id) => { set({ selectedClipId: id }); if (get().autoSetLocators === 'region') get().updateLocatorsBySelection(); },
    selectNote: (id) => { set({ selectedNoteId: id }); if (get().autoSetLocators === 'note') get().updateLocatorsBySelection(); },
    toggleCycle: () => set(s => ({ cycleEnabled: !s.cycleEnabled, skipCycleEnabled: false })),
    toggleSkipCycle: () => set(s => ({ skipCycleEnabled: !s.skipCycleEnabled, cycleEnabled: false })),
    setLocators: (left, right) => set({ locatorLeft: left, locatorRight: right }),
    setLoopEnabled: (enabled) => set({ cycleEnabled: enabled }),
    setLoop: (start, end, enable = true) => set({ locatorLeft: start, locatorRight: end, cycleEnabled: enable }),
    clearLoop: () => set({ cycleEnabled: false }),
    setAutoSetLocators: (mode) => { set({ autoSetLocators: mode }); if (mode !== 'off') get().updateLocatorsBySelection(); },
    updateLocatorsBySelection: () => {
        const { autoSetLocators, selectedClipId, clips, selectedNoteId } = get();
        if (autoSetLocators === 'region' && selectedClipId) {
            const clip = clips.find(c => c.id === selectedClipId);
            if (clip) set({ locatorLeft: clip.start, locatorRight: clip.start + clip.duration });
        } else if (autoSetLocators === 'note' && selectedNoteId && selectedClipId) {
            const clip = clips.find(c => c.id === selectedClipId);
            if (clip && clip.notes) {
                const note = clip.notes.find(n => n.id === selectedNoteId);
                if (note) { set({ locatorLeft: clip.start + Math.floor(note.start / 4) * 4, locatorRight: clip.start + Math.ceil((note.start + note.duration) / 4) * 4 }); }
            }
        }
    },
    chaseEvents: (position) => {
        const { clips, tracks, settings } = get();
        const chase = settings.midi.chase;
        clips.forEach(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track || track.type !== 'midi' || (track.noTranspose && !chase.inNoTransposeInstruments)) return;
            if (clip.type === 'midi' && clip.notes) {
                clip.notes.forEach(note => {
                    const absStart = clip.start + note.start;
                    const absEnd = absStart + note.duration;
                    if (chase.notes && absStart < position && absEnd > position) audioEngine.playRegion(clip.trackId, { ...clip, notes: [note] }, absStart + (position - absStart));
                });
            }
        });
    },

    updateTrackParameter: (trackId, params) => {
        // `frozen` is not a flag — it means "render this track and play the
        // render instead". Route it through the real implementation rather than
        // silently toggling a boolean that nothing acts on.
        if (params.frozen !== undefined) {
            const { frozen, ...rest } = params;
            if (Object.keys(rest).length > 0) {
                set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, ...rest } : t), isDirty: true }));
            }
            if (frozen) void get().freezeTrack(trackId);
            else get().unfreezeTrack(trackId);
            return;
        }

        set(s => ({
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, ...params } : t),
            isDirty: true
        }));
    },

    /**
     * Render a track offline and play the render in place of its source
     * material, freeing the CPU its instrument and inserts were using.
     *
     * The source clips are kept and simply hidden from playback, so unfreezing
     * is lossless. Fader, pan, mute and solo stay live on the channel strip.
     */
    freezeTrack: async (trackId) => {
        const s = get();
        const track = s.tracks.find(t => t.id === trackId);
        if (!track || track.frozen) return;

        const own = s.clips.filter(c => c.trackId === trackId);
        if (own.length === 0) return;

        set({ freezingTrackIds: [...s.freezingTrackIds, trackId] });

        try {
            const result = await renderTrackOffline(
                {
                    id: track.id,
                    name: track.name,
                    volume: track.volume,
                    pan: track.pan,
                    muted: track.muted,
                    soloed: track.soloed,
                    instrument: track.instrument,
                    plugins: track.plugins,
                },
                own as unknown as Parameters<typeof renderTrackOffline>[1],
                s.tempo,
            );

            if (!result) return;

            // Publish the render so the scheduler can source it like any clip.
            bufferCacheManager.addBuffer(freezeBufferId(trackId), result.buffer);

            const frozenClip = {
                ...(own[0] as Clip),
                id: freezeClipId(trackId),
                trackId,
                type: 'audio' as ClipType,
                name: `${track.name} (frozen)`,
                start: result.startBeat,
                startBeat: result.startBeat,
                startTime: result.startBeat,
                duration: result.durationBeats,
                offset: 0,
                muted: false,
                notes: undefined,
                sampleId: freezeBufferId(trackId),
                fileUrl: undefined,
            } as Clip;

            set(state => ({
                clips: [
                    // Source clips are hidden from playback, not destroyed.
                    ...state.clips.map(c => c.trackId === trackId ? { ...c, muted: true } : c),
                    frozenClip,
                ],
                tracks: state.tracks.map(t => t.id === trackId
                    ? { ...t, frozen: true, frozenSourceClipIds: result.sourceClipIds }
                    : t),
                isDirty: true,
            }));
        } catch (error) {
            console.error('[Freeze] Failed to render track:', error);
        } finally {
            set(state => ({ freezingTrackIds: state.freezingTrackIds.filter(id => id !== trackId) }));
        }
    },

    /** Restore a frozen track's source material and discard the render. */
    unfreezeTrack: (trackId) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return {};

        const restored = new Set(track.frozenSourceClipIds ?? []);

        return {
            clips: s.clips
                .filter(c => c.id !== freezeClipId(trackId))
                .map(c => (restored.has(c.id) ? { ...c, muted: false } : c)),
            tracks: s.tracks.map(t => t.id === trackId
                ? { ...t, frozen: false, frozenSourceClipIds: undefined }
                : t),
            isDirty: true,
        };
    }),


    addTrackAlternative: (trackId, options) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return {};

        const nextLetter = String.fromCharCode(65 + track.alternatives.length);
        const newAltId = `alt-${Date.now()}`;
        const newAlt: TrackAlternative = { id: newAltId, name: nextLetter };

        let newClips = [...s.clips];
        if (options?.duplicate) {
            const currentClips = s.clips.filter(c => c.trackId === trackId && c.alternativeId === track.activeAlternativeId);
            const duplicated = currentClips.map(c => ({
                ...c,
                id: `clip-${Date.now()}-${Math.random()}`,
                alternativeId: newAltId
            }));
            newClips = [...newClips, ...duplicated];
        }

        return {
            tracks: s.tracks.map(t => t.id === trackId ? {
                ...t,
                alternatives: [...t.alternatives, newAlt],
                activeAlternativeId: newAltId
            } : t),
            clips: newClips,
            isDirty: true
        };
    }),

    deleteInactiveAlternatives: (trackId) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return {};
        const inactiveIds = track.alternatives.filter(a => a.id !== track.activeAlternativeId).map(a => a.id);
        return {
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, alternatives: t.alternatives.filter(a => a.id === t.activeAlternativeId) } : t),
            clips: s.clips.filter(c => !(c.trackId === trackId && inactiveIds.includes(c.alternativeId))),
            isDirty: true
        };
    }),

    setActiveAlternative: (trackId, altId) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, activeAlternativeId: altId } : t),
        isDirty: true
    })),

    toggleInactiveAlternatives: (trackId) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, showInactiveAlternatives: !t.showInactiveAlternatives } : t),
    })),

    renameAlternative: (trackId, altId, name) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? {
            ...t,
            alternatives: t.alternatives.map(a => a.id === altId ? { ...a, name } : a)
        } : t),
        isDirty: true
    })),

    swapWithActiveAlternative: (trackId, inactiveId) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return {};
        return {
            tracks: s.tracks.map(t => t.id === trackId ? { ...t, activeAlternativeId: inactiveId } : t),
            isDirty: true
        };
    }),

    initializeProject: (settings: { tempo: number; timeSignature: string; keySignature: string; projectFormat?: string; surroundFormat?: string; spatialAudioMode?: string }) => {
        const [num, den] = settings.timeSignature.split('/').map(Number);
        const [root, mode] = settings.keySignature.split(' ');
        const newId = `proj-${Date.now()}`;
        set({
            id: newId,
            name: "New Project",
            tempo: settings.tempo,
            tracks: [],
            clips: [],
            annotations: [],
            projectFormat: (settings.projectFormat || 'stereo') as 'stereo' | 'surround' | 'dolby-atmos',
            surroundFormat: (settings.surroundFormat || '5.1 (ITU 775)') as 'Quadraphonic' | 'LCR (Pro Logic)' | '5.1 (ITU 775)' | '6.1 (ES/EX)' | '7.1' | '7.1 (SDDS)' | '5.1.2' | '5.1.4' | '7.1.2' | '7.1.4',
            spatialAudioMode: (settings.spatialAudioMode || 'Off') as 'Off' | 'Dolby Atmos',
            globalTracks: {
                tempo: [{ time: 0, value: settings.tempo, type: 'jump' }],
                markers: [],
                signature: [{ time: 0, numerator: num || 4, denominator: den || 4 }],
                key: [{ time: 0, root: root || 'C', mode: (mode?.toLowerCase() === 'minor' ? 'minor' : 'major') }],
                beatMapping: []
            }
        });
        audioEngine.setTempo(settings.tempo);
        audioEngine.configureAudioFormat(settings.projectFormat || 'stereo', settings.surroundFormat || '5.1 (ITU 775)', settings.spatialAudioMode || 'Off');

        // Save new project to IndexedDB immediately
        if (typeof window !== 'undefined') {
            const serialized = serializeStoreState(get);
            saveToIndexedDB(newId, serialized).catch((e: any) =>
                console.warn('[Persistence] Failed to save initial project:', e)
            );
        }
    },

    openProject: async (id) => {
        await get().loadProject(id);
        set(s => ({ recentProjects: s.recentProjects.map(p => p.id === id ? { ...p, lastOpened: Date.now() } : p) }));
        // Ensure engine state is synced after open
        const state = get();
        state.tracks.forEach(t => {
            audioEngine.updateTrackParams(t.id, t.volume, t.pan);
        });
    },

    updateProjectSettings: (updates) => set(s => {
        const nextSettings = { ...s.settings, ...updates };
        const nextProjectFormat = (updates as any).projectFormat || s.projectFormat;
        const nextSurroundFormat = (updates as any).surroundFormat || s.surroundFormat;
        const nextSpatialAudioMode = (updates as any).spatialAudioMode || s.spatialAudioMode;

        audioEngine.configureAudioFormat(nextProjectFormat, nextSurroundFormat, nextSpatialAudioMode);

        return {
            settings: nextSettings,
            projectFormat: nextProjectFormat,
            surroundFormat: nextSurroundFormat,
            spatialAudioMode: nextSpatialAudioMode
        };
    }),

    loadGlobalSettings: () => {
        if (typeof window === 'undefined') return;

        const raw = localStorage.getItem('logicDawGlobalSettings');
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as GlobalSettings;
                set({ globalSettings: { ...get().globalSettings, ...parsed } });
            } catch (e) {
                console.error('Failed to parse global settings from localStorage', e);
            }
        }

        const rawProject = localStorage.getItem('logicDawProjectKeyCommands');
        if (rawProject) {
            try {
                const parsedProject = JSON.parse(rawProject) as GlobalKeyCommand[];
                set({ projectKeyCommands: parsedProject });
            } catch (e) {
                console.error('Failed to parse project key commands from localStorage', e);
            }
        }
    },

    updateGlobalSettings: (updates) => set(s => {
        const next = { ...s.globalSettings, ...updates };
        if (typeof window !== 'undefined') {
            localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        }
        return { globalSettings: next };
    }),

    assignKeyCommand: (commandId, shortcut) => set(s => {
        const keyCommands = s.globalSettings.keyCommands.map(k => k.id === commandId ? ({ ...k, shortcut, isCustom: shortcut !== k.defaultShortcut }) : k);
        const next = { ...s.globalSettings, keyCommands };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    removeKeyCommand: (commandId) => set(s => {
        const keyCommands = s.globalSettings.keyCommands.map(k => k.id === commandId ? ({ ...k, shortcut: '', isCustom: true }) : k);
        const next = { ...s.globalSettings, keyCommands };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    resetKeyCommands: () => set(s => {
        const keyCommands = s.globalSettings.keyCommands.map(k => ({ ...k, shortcut: k.defaultShortcut, isCustom: false }));
        const next = { ...s.globalSettings, keyCommands };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    importKeyCommands: (payload) => set(s => {
        const keyCommands = s.globalSettings.keyCommands.map(k => {
            const importItem = payload.find(p => p.id === k.id);
            if (!importItem) return k;
            return { ...k, shortcut: importItem.shortcut, isCustom: true };
        });
        const next = { ...s.globalSettings, keyCommands };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    exportKeyCommands: () => {
        const keyCommands = get().globalSettings.keyCommands;
        return JSON.stringify(keyCommands, null, 2);
    },

    assignProjectKeyCommand: (commandId, shortcut) => set(s => {
        const base = s.projectKeyCommands.length ? s.projectKeyCommands : s.globalSettings.keyCommands;
        const projectKeyCommands = base.map(k => k.id === commandId ? ({ ...k, shortcut, isCustom: shortcut !== k.defaultShortcut }) : k);
        if (!projectKeyCommands.some(k => k.id === commandId)) {
            const globalCmd = s.globalSettings.keyCommands.find(k => k.id === commandId);
            if (globalCmd) projectKeyCommands.push({ ...globalCmd, shortcut, isCustom: shortcut !== globalCmd.defaultShortcut });
        }
        if (typeof window !== 'undefined') localStorage.setItem('logicDawProjectKeyCommands', JSON.stringify(projectKeyCommands));
        return { projectKeyCommands };
    }),

    removeProjectKeyCommand: (commandId) => set(s => {
        const base = s.projectKeyCommands.length ? s.projectKeyCommands : s.globalSettings.keyCommands;
        const projectKeyCommands = base.map(k => k.id === commandId ? ({ ...k, shortcut: '', isCustom: true }) : k);
        if (typeof window !== 'undefined') localStorage.setItem('logicDawProjectKeyCommands', JSON.stringify(projectKeyCommands));
        return { projectKeyCommands };
    }),

    resetProjectKeyCommands: () => set(s => {
        const projectKeyCommands = get().globalSettings.keyCommands.map(k => ({ ...k, shortcut: k.defaultShortcut, isCustom: false }));
        if (typeof window !== 'undefined') localStorage.setItem('logicDawProjectKeyCommands', JSON.stringify(projectKeyCommands));
        return { projectKeyCommands };
    }),

    importProjectKeyCommands: (payload) => set(s => {
        const projectKeyCommands = get().globalSettings.keyCommands.map(k => {
            const importItem = payload.find(p => p.id === k.id);
            if (!importItem) return k;
            return { ...k, shortcut: importItem.shortcut, isCustom: true };
        });
        if (typeof window !== 'undefined') localStorage.setItem('logicDawProjectKeyCommands', JSON.stringify(projectKeyCommands));
        return { projectKeyCommands };
    }),

    exportProjectKeyCommands: () => {
        const keyCommands = get().projectKeyCommands.length ? get().projectKeyCommands : get().globalSettings.keyCommands;
        return JSON.stringify(keyCommands, null, 2);
    },

    addEnvironmentLayer: (name, isGlobal = false) => set(s => {
        const id = `layer-${Date.now()}`;
        return {
            environment: {
                ...s.environment,
                layers: [...s.environment.layers, { id, name, protected: false, isGlobal }],
                selectedLayerId: id
            }
        };
    }),

    renameEnvironmentLayer: (layerId, name) => set(s => ({
        environment: {
            ...s.environment,
            layers: s.environment.layers.map(layer => layer.id === layerId ? { ...layer, name } : layer)
        }
    })),

    deleteEnvironmentLayer: (layerId) => set(s => {
        const layer = s.environment.layers.find(l => l.id === layerId);
        if (!layer || layer.protected) return {};
        const remainingLayers = s.environment.layers.filter(l => l.id !== layerId);
        const selectedLayerId = remainingLayers.length ? remainingLayers[0].id : s.environment.selectedLayerId;
        return {
            environment: {
                ...s.environment,
                layers: remainingLayers,
                selectedLayerId,
                objects: s.environment.objects.map(object => object.layerId === layerId ? { ...object, layerId: selectedLayerId } : object)
            }
        };
    }),

    selectEnvironmentLayer: (layerId) => set(s => {
        if (!s.environment.layers.some(layer => layer.id === layerId)) return {};
        return { environment: { ...s.environment, selectedLayerId: layerId } };
    }),

    toggleEnvironmentGlobalObjectVisibility: () => set(s => ({
        environment: { ...s.environment, showGlobalObjects: !s.environment.showGlobalObjects }
    })),

    addEnvironmentObject: (object) => set(s => {
        const id = `envobj-${Date.now()}`;
        const newObject: EnvironmentObject = { ...object, id };
        return { environment: { ...s.environment, objects: [...s.environment.objects, newObject] } };
    }),

    updateEnvironmentObject: (objectId, updates) => set(s => ({
        environment: {
            ...s.environment,
            objects: s.environment.objects.map(obj => obj.id === objectId ? { ...obj, ...updates } : obj)
        }
    })),

    deleteEnvironmentObject: (objectId) => set(s => ({
        environment: {
            ...s.environment,
            objects: s.environment.objects
                .filter(obj => obj.id !== objectId)
                .map(obj => ({ ...obj, connections: obj.connections.filter(conn => conn !== objectId) }))
        }
    })),

    connectEnvironmentObjects: (sourceId, targetId) => set(s => ({
        environment: {
            ...s.environment,
            objects: s.environment.objects.map(obj => obj.id === sourceId ? { ...obj, connections: Array.from(new Set([...obj.connections, targetId])) } : obj)
        }
    })),

    disconnectEnvironmentObjects: (sourceId, targetId) => set(s => ({
        environment: {
            ...s.environment,
            objects: s.environment.objects.map(obj => obj.id === sourceId ? { ...obj, connections: obj.connections.filter(conn => conn !== targetId) } : obj)
        }
    })),

    addControlSurface: (device) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                devices: [...s.globalSettings.controlSurfaces.devices, device]
            }
        }
    })),

    updateControlSurface: (id, updates) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                devices: s.globalSettings.controlSurfaces.devices.map(cs => cs.id === id ? { ...cs, ...updates } : cs)
            }
        }
    })),

    removeControlSurface: (id) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                devices: s.globalSettings.controlSurfaces.devices.filter(cs => cs.id !== id)
            }
        }
    })),

    addControlSurfaceAssignment: (assignment) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                assignments: [...s.globalSettings.controlSurfaces.assignments, assignment]
            }
        }
    })),

    updateControlSurfaceAssignment: (id, updates) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                assignments: s.globalSettings.controlSurfaces.assignments.map(a => a.id === id ? { ...a, ...updates } : a)
            }
        }
    })),

    removeControlSurfaceAssignment: (id) => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                assignments: s.globalSettings.controlSurfaces.assignments.filter(a => a.id !== id)
            }
        }
    })),

    toggleControlSurfacesBypass: () => set(s => ({
        globalSettings: {
            ...s.globalSettings,
            controlSurfaces: {
                ...s.globalSettings.controlSurfaces,
                bypassed: !s.globalSettings.controlSurfaces.bypassed
            }
        }
    })),

    toggleSelectionBasedProcessing: (show) => set(s => ({ showSelectionBasedProcessing: show !== undefined ? show : !s.showSelectionBasedProcessing })),


    updateSBPState: (updates) => set(s => ({ sbpState: { ...s.sbpState, ...updates } })),
    setMarqueeSelection: (selection) => set({ marqueeSelection: selection }),
    addPluginToSBP: (setSide, pluginType) => set(s => {
        const pluginNames = { comp: 'Compressor', eq: 'Channel EQ', reverb: 'Space Designer', delay: 'Delay Designer', bitcrusher: 'Bitcrusher' };
        const newPlugin = { id: `sbp-${Math.random()}`, pluginId: pluginType, name: (pluginNames as any)[pluginType] || 'Plug-in', enabled: true, params: {} };
        const targetSet = setSide === 'A' ? 'setA' : 'setB';
        return { sbpState: { ...s.sbpState, [targetSet]: [...(s.sbpState as any)[targetSet], newPlugin] } };
    }),
    removePluginFromSBP: (setSide, pluginId) => set(s => {
        const targetSet = setSide === 'A' ? 'setA' : 'setB';
        return { sbpState: { ...s.sbpState, [targetSet]: (s.sbpState as any)[targetSet].filter((p: any) => p.id !== pluginId) } };
    }),

    // --- Recording Actions Implementation ---
    toggleRecording: () => {
        const s = get();
        if (s.recording) {
            set({ recording: false, recordingStartTime: null, liveRecordingClips: {} });
            heldRecordingNotes.clear();
            cancelCountIn();
            return;
        }

        set({ recording: true, recordingStartTime: s.playhead });

        // Logic Pro pattern: recording rolls the transport. The transport is
        // `play()`, not a `playing: true` flag — `play()` is what starts the
        // loop that advances the playhead. Setting the flag alone armed the
        // audio scheduler but left the playhead frozen, so every note recorded
        // landed on the beat where record was pressed, all with the minimum
        // duration, in a clip that never grew past one beat.
        if (s.playing) return;

        // Count-in. `countInEnabled` and `countInBars` had a toggle in the
        // control bar and were saved with the project, but nothing read them —
        // switching count-in on did nothing at all. Clicks are scheduled first
        // and the transport starts when they finish, so the bars are counted
        // before the take rather than over the top of it.
        const beatsPerBar = parseInt(s.timeSignature?.split('/')[0] ?? '4', 10) || 4;
        const preRoll = s.countInEnabled
            ? audioEngine.scheduleCountIn(s.countInBars, beatsPerBar, s.tempo)
            : 0;

        if (preRoll <= 0) {
            get().play();
            return;
        }

        countInTimer = setTimeout(() => {
            countInTimer = null;
            // The user may have cancelled during the count-in.
            if (get().recording) get().play();
        }, preRoll * 1000);
    },

    toggleAutopunch: (enabled) => set(s => ({ autopunchEnabled: enabled !== undefined ? enabled : !s.autopunchEnabled })),
    
    setAutopunchLocators: (start, end) => set({ autopunchStart: start, autopunchEnd: end }),
    
    toggleReplaceMode: (enabled) => set(s => ({ replaceMode: enabled !== undefined ? enabled : !s.replaceMode })),
    setReplaceModeType: (type: ProjectState['replaceModeType']) => set({ replaceModeType: type }),
    setRecordingOverlappingMode: (mode: ProjectState['recordingOverlappingMode']) => set({ recordingOverlappingMode: mode }),
    
    toggleRecordEnable: (trackId) => set(s => ({
        tracks: s.tracks.map(t => {
            if (t.id === trackId) {
                return { ...t, recordEnabled: !t.recordEnabled };
            }
            // Logic Pro behavior: Usually only one software instrument/audio track is automatically R-enabled 
            // when selected, but manual toggle is additive.
            return t;
        })
    })),

    toggleInputMonitoring: (trackId) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, inputMonitoring: !t.inputMonitoring } : t)
    })),

    setAutoInputMonitoring: (enabled) => set({ autoInputMonitoring: enabled }),
    
    setAllowQuickPunchIn: (enabled) => set({ allowQuickPunchIn: enabled }),

    startRecording: () => {
        const s = get();
        // Roll the transport through the normal play path so existing material
        // is audible while recording. Calling audioEngine.play() directly here
        // started the transport with an empty clip list, which meant you
        // recorded against silence.
        if (!s.playing) {
            get().play();
        }
        set({ recording: true, recordingStartTime: get().playhead });
        // Recording has its own click preference, so re-evaluate now that the
        // transport is in record mode.
        syncMetronome(s.settings, s.metronomeEnabled, 'record');
    },

    stopRecording: () => {
        const s = get();
        if (s.recording) {
            set({ recording: false, recordingStartTime: null, liveRecordingClips: {} });
        }
    },

    recordRepeat: () => {
        const s = get();
        if (s.recording) {
            get().stopRecording();
            const resetPos = s.cycleEnabled ? s.locatorLeft : s.recordingStartTime || s.playhead;
            set({ playhead: resetPos ?? s.playhead });
            get().startRecording();
        } else {
            get().startRecording();
        }
    },

    discardAndReturn: () => {
        const s = get();
        if (!s.recording) return;

        const recordedClipIds = Object.values(s.liveRecordingClips);
        let updatedClips = s.clips.filter(c => !recordedClipIds.includes(c.id));

        updatedClips = updatedClips.reduce((acc: Clip[], c) => {
            if (c.isTakeFolder && c.takes) {
                const nextTakes = c.takes.filter(t => !recordedClipIds.includes(t.id));
                if (nextTakes.length === 0) return acc;
                const activeIndex = Math.min(c.activeTakeIndex || 0, nextTakes.length - 1);
                const folderStart = c.start;
                const folderEnd = Math.max(...nextTakes.map(t => t.start + t.duration));
                acc.push({ ...c, takes: nextTakes, activeTakeIndex: activeIndex, duration: folderEnd - folderStart });
                return acc;
            }
            acc.push(c);
            return acc;
        }, []);

        set({
            clips: updatedClips,
            playing: true,
            recording: false,
            recordingStartTime: s.recordingStartTime,
            liveRecordingClips: {},
            playhead: s.recordingStartTime ?? s.playhead
        });
    },

    toggleFlashback: (enabled) => set(s => ({ flashback: enabled !== undefined ? enabled : !s.flashback })),

    flashbackCapture: () => {
        const s = get();
        const windowStart = Math.max(0, s.playhead - s.flashbackDuration);
        const flashbackEvents = s.flashbackBuffer.filter(e => e.time >= windowStart && e.time <= s.playhead && e.duration > 0);
        if (flashbackEvents.length === 0) return;

        const targetTrackId = s.focusedTrackId || (s.tracks[0] && s.tracks[0].id);
        if (!targetTrackId) return;

        const notes = flashbackEvents
            .filter(e => e.trackId === targetTrackId)
            .map((e, idx) => ({ id: `fb-note-${Date.now()}-${idx}`, pitch: e.pitch, velocity: e.velocity, start: e.time - windowStart, duration: e.duration }));

        if (notes.length === 0) return;

        const newClipId = `flashback-${Date.now()}-${targetTrackId}`;
        const newClip: Clip = {
            id: newClipId,
            trackId: targetTrackId,
            name: `Flashback ${new Date().toLocaleTimeString()}`,
            type: 'midi',
            alternativeId: s.tracks.find(t => t.id === targetTrackId)?.activeAlternativeId || 'default',
            start: windowStart,
            duration: s.flashbackDuration,
            offset: 0,
            color: s.tracks.find(t => t.id === targetTrackId)?.color || '#8b5cf6',
            muted: false,
            loop: false,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0,
            notes,
        } as any;

        set({ clips: [...s.clips, newClip], flashbackBuffer: [] });
    },

    markTakeAsGood: (clipId) => set(s => ({
        clips: s.clips.map(c => {
            if (c.id === clipId) {
                return { ...c, marker: 'good' } as any;
            }
            if (c.isTakeFolder && c.takes) {
                return {
                    ...c,
                    takes: c.takes.map(t => t.id === clipId ? { ...t, marker: 'good' } as any : t)
                };
            }
            return c;
        })
    })),

    setTakeColor: (clipId, color) => set(s => ({
        clips: s.clips.map(c => {
            if (c.id === clipId) return { ...c, color };
            if (c.isTakeFolder && c.takes) {
                return {
                    ...c,
                    takes: c.takes.map(t => t.id === clipId ? { ...t, color } : t)
                };
            }
            return c;
        })
    })),

    saveTakeFolderComp: (clipId, name) => set(s => {
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip?.isTakeFolder || !clip.takes || clip.activeTakeIndex === undefined) return {};
        const compName = name || `Comp ${((clip.comps?.length || 0) + 1)}`;
        const compId = `comp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newComp = { id: compId, name: compName, takeIndex: clip.activeTakeIndex };
        return {
            clips: s.clips.map(c => c.id === clipId ? {
                ...c,
                comps: [...(c.comps || []), newComp],
                activeCompId: compId
            } : c)
        };
    }),

    /**
     * Turn a set of recorded takes into a single take folder.
     *
     * Comping already worked, but only on a folder that already existed —
     * nothing created one, so "record 4-6 takes then comp them" had no first
     * step. The takes become alternatives inside one region spanning them all.
     */
    createTakeFolder: (trackId, clipIds, name) => {
        const s = get();
        const takes = clipIds
            .map(id => s.clips.find(c => c.id === id))
            .filter((c): c is Clip => !!c && c.trackId === trackId)
            .sort((a, b) => a.start - b.start);
        if (takes.length < 2) return null;

        const start = Math.min(...takes.map(t => t.start));
        const end = Math.max(...takes.map(t => t.start + t.duration));
        const folderId = `take-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const folder = {
            ...takes[0],
            id: folderId,
            name: name || `${takes[0].name} (${takes.length} takes)`,
            start,
            duration: end - start,
            isTakeFolder: true,
            activeTakeIndex: 0,
            comps: [],
            takes: takes.map((t, i) => ({
                id: t.id,
                name: t.name || `Take ${i + 1}`,
                clip: { ...t },
            })),
        } as unknown as Clip;

        set(sx => ({
            // The takes now live inside the folder, so they leave the timeline.
            clips: [...sx.clips.filter(c => !clipIds.includes(c.id)), folder],
            selectedClipId: folderId,
            selectedClipIds: [folderId],
            isDirty: true,
        }));
        return folderId;
    },

    createTakeFolderComp: (clipId, name) => set(s => {
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip?.isTakeFolder || !clip.takes || clip.activeTakeIndex === undefined) return {};
        const newCompName = name || `Comp ${(clip.comps?.length || 0) + 1}`;
        const newCompId = `comp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newComp = { id: newCompId, name: newCompName, takeIndex: clip.activeTakeIndex };
        return {
            clips: s.clips.map(c => c.id === clipId ? ({ ...c, comps: [...(c.comps || []), newComp], activeCompId: newCompId }) : c)
        };
    }),

    selectTakeFolderComp: (clipId, compId) => set(s => {
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || !clip.isTakeFolder || !clip.comps) return {};
        const comp = clip.comps.find(c => c.id === compId);
        if (!comp) return {};
        return {
            clips: s.clips.map(c => c.id === clipId ? ({ ...c, activeTakeIndex: comp.takeIndex, activeCompId: compId }) : c)
        };
    }),

    renameTakeFolderComp: (clipId, compId, name) => set(s => ({
        clips: s.clips.map(c => {
            if (c.id !== clipId || !c.comps) return c;
            return {
                ...c,
                comps: c.comps.map(comp => comp.id === compId ? { ...comp, name } : comp)
            };
        })
    })),

    deleteTakeFolderComp: (clipId, compId) => set(s => {
        return {
            clips: s.clips.map(c => {
                if (c.id !== clipId || !c.comps) return c;
                const nextComps = c.comps.filter(comp => comp.id !== compId);
                const activeComp = (nextComps.find(comp => comp.id === c.activeCompId) || nextComps[0]);
                return {
                    ...c,
                    comps: nextComps,
                    activeCompId: activeComp?.id
                };
            })
        };
    }),

    applySelectionBasedProcessing: () => {
        const { marqueeSelection, selectedClipId, clips, sbpState, tracks, updateClip, addClip } = get();
        
        if (marqueeSelection) {
            marqueeSelection.trackIds.forEach(tid => {
                const trackClips = clips.filter(c => c.trackId === tid);
                trackClips.forEach(clip => {
                    const startInside = clip.start >= marqueeSelection.startBeat && clip.start < marqueeSelection.endBeat;
                    if (startInside) {
                        updateClip(clip.id, { name: `${clip.name} (Processed)` });
                    }
                });
            });
        } else if (selectedClipId) {
            const clip = clips.find(c => c.id === selectedClipId);
            if (clip) {
                if (sbpState.createNewTake) {
                    addClip({
                        ...JSON.parse(JSON.stringify(clip)),
                        id: `take-${Date.now()}`,
                        name: `${clip.name} Take 2`,
                        start: clip.start + 0.1,
                    } as any);
                } else {
                    updateClip(clip.id, { name: `${clip.name} (Processed)` });
                }
            }
        }
    },

    setInternalMidiIn: (trackId, sourceId, type) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { 
            ...t, 
            internalMidiInSourceId: sourceId, 
            internalMidiInType: type,
            // default to "Internal Only" if unset
            internalMidiInRecordMode: t.internalMidiInRecordMode || 'Internal Only'
        } : t),
        isDirty: true
    })),

    setInternalMidiInRecordMode: (trackId, mode) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, internalMidiInRecordMode: mode } : t),
        isDirty: true
    })),

    setMidiOutToTrackSlot: (trackId, slotIndex) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, midiOutToTrackSlot: slotIndex } : t),
        isDirty: true
    })),
}));

/**
 * Store handle for debugging and end-to-end tests, alongside `window.audioDebug`.
 *
 * Development only: nothing in the app reads it, and it is the only way an
 * automated test can assert on what a recording actually captured rather than
 * on what the UI happens to draw.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as unknown as Record<string, unknown>).__projectStore = useProjectStore;
}

if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('logicDawGlobalSettings');
    if (raw) {
        try {
            let parsed = JSON.parse(raw) as GlobalSettings;
            // ensure new fields exist
            if (!parsed.controlSurfaces || Array.isArray(parsed.controlSurfaces)) {
                parsed.controlSurfaces = {
                    bypassWhileInBackground: false, resolutionOfRelativeControls: 0,
                    maxMidiBandwidth: 100, touchingFaderSelectsTrack: false,
                    followTrackSelection: true, openPluginWindowOnSelection: true,
                    jogResolutionDependsOnZoom: false, pickupMode: true,
                    flashMuteSoloButtons: true, multipleControlsPerParameter: 0,
                    longerLabelsOnlyIfFit: false, showValueUnitsForInstrument: true,
                    showValueUnitsForVolume: true,
                    helpTags: { parameterName: true, parameterValue: true, displayDuration: 3, showInfoMultiple: true, showInfoTrackSelection: true, showInfoVolume: true },
                    usbMidiControllers: [],
                    devices: parsed.controlSurfaces && Array.isArray(parsed.controlSurfaces) ? parsed.controlSurfaces : [],
                    assignments: (parsed as any).controlSurfaceAssignments || [],
                    bypassed: (parsed as any).controlSurfacesBypassed || false,
                };
            }
            useProjectStore.setState({ globalSettings: parsed });
        } catch (e) {
            console.warn('Failed to parse global settings payload', e);
        }
    }

    const rawProject = localStorage.getItem('logicDawProjectKeyCommands');
    if (rawProject) {
        try {
            const parsedProject = JSON.parse(rawProject) as GlobalKeyCommand[];
            useProjectStore.setState({ projectKeyCommands: parsedProject });
        } catch (e) {
            console.warn('Failed to parse project key commands payload', e);
        }
    }
}

