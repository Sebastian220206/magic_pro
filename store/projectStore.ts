import { create } from 'zustand';
import { audioEngine } from '@/engine/audioEngine';
import { Track, TrackAlternative, PluginSetting } from '@/models/Track';
import { Clip, Note, ClipType } from '@/models/Clip';
import { ArticulationSet, Articulation } from '@/models/Articulation';

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
    audio: {
        coreAudioEnabled: boolean;
        inputDevice: string;
        outputDevice: string;
        ioBufferSize: number;
        sampleAccurateAutomation: 'Off' | 'VolumePanSends' | 'All';
        softwareMonitoring: boolean;
        lowLatencyMonitoring: boolean;
        lowLatencyLimitMs: number;
    };
    controlSurfaces: ControlSurfaceDevice[];
    controlSurfaceAssignments: ControlSurfaceAssignment[];
    controlSurfacesBypassed: boolean;
    keyCommands: GlobalKeyCommand[];
    useProjectSettings: boolean; // if false, global settings are enforced and project settings are read-only
}

interface ProjectState {
    id: string | null;
    name: string;
    tempo: number;
    playing: boolean;
    playhead: number;
    tracks: Track[];
    clips: Clip[];
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
    pianoRollLinkMode: 'single' | 'selected' | 'folder' | 'project';
    pianoRollFocusClipId: string | null;

    // --- Selection-Based Processing ---
    showSelectionBasedProcessing: boolean;
    marqueeSelection: { trackIds: string[], start: number, duration: number } | null;
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
    movePlayhead: (position: number) => void;
    addAlternative: (name: string) => void;
    switchToAlternative: (id: string) => void;
    createTrackStack: (trackIds: string[], type: 'Folder' | 'Summing') => void;
    flattenStack: (stackId: string) => void;
    addMarker: (time: number, text: string) => void;
    updateTempoPoint: (index: number, updates: Partial<GlobalTrackPoint>) => void;
    updateControlBar: (updates: Partial<ControlBarSettings>) => void;
    toggleFloatingWindow: (type: 'giantBeats' | 'giantTime') => void;
    toggleNewTrackDialog: (show?: boolean) => void;
    setNewTrackDefaults: (updates: Partial<ProjectState['newTrackDefaults']>) => void;
    toggleCreateTrackUsing: (show: boolean, items?: any[]) => void;
    createTrackFromSamplerType: (type: 'Quick Sampler (Original)' | 'Quick Sampler (Optimized)' | 'Drum Machine Designer' | 'Sample Alchemy' | 'Sampler (Zone Per Note)', items: any[]) => void;
    saveProject: (userId: string) => Promise<void>;
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
    updateTrack: (id: string, updates: Partial<Track>) => void;
    deleteTrack: (id: string) => void;
    addPlugin: (trackId: string, pluginType: 'comp' | 'eq' | 'reverb' | 'delay') => void;
    togglePlugin: (trackId: string, pluginId: string) => void;
    addClip: (clip: Clip) => void;
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
    updateNote: (clipId: string, noteId: string, updates: Partial<Note>) => void;
    deleteNote: (clipId: string, noteId: string) => void;
    setZoom: (zoom: number) => void;
    setTrackHeight: (height: number) => void;
    setSnap: (snap: ProjectState['snap']) => void;
    toggleAutomation: () => void;
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
    toggleGlobalTracks: () => void;
    toggleHideView: () => void;
    setTrackHidden: (trackId: string, hidden: boolean) => void;
    unhideAllTracks: () => void;
    showSearchAndSelect: boolean;
    toggleSearchAndSelect: (show: boolean) => void;
    setBottomPanel: (panel: 'mixer' | 'pianoroll' | 'smartcontrols') => void;
    setPianoRollLinkMode: (mode: 'single' | 'selected' | 'folder' | 'project') => void;
    setPianoRollFocusClipId: (clipId: string | null) => void;
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
    addTrackAlternative: (trackId: string, options?: { duplicate?: boolean, nameByRegion?: boolean }) => void;
    deleteInactiveAlternatives: (trackId: string) => void;
    setActiveAlternative: (trackId: string, alternativeId: string) => void;
    toggleInactiveAlternatives: (trackId: string) => void;
    renameAlternative: (trackId: string, alternativeId: string, name: string) => void;
    swapWithActiveAlternative: (trackId: string, inactiveId: string) => void;
    selectClip: (id: string | null) => void;
    selectNote: (id: string | null) => void;
    toggleCycle: () => void;
    toggleSkipCycle: () => void;
    setLocators: (left: number, right: number) => void;
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

    assignKeyCommand: (commandId: string, shortcut: string) => void;
    removeKeyCommand: (commandId: string) => void;
    resetKeyCommands: () => void;
    importKeyCommands: (payload: GlobalKeyCommand[]) => void;
    exportKeyCommands: () => string;

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
    removePluginFromSBP: (set: 'A' | 'B', pluginId: string) => void;

    // Stacks & Groove
    toggleStackCollapse: (trackId: string, recursive?: boolean) => void;
    convertStackType: (trackId: string, type: 'Folder' | 'Summing') => void;
    setGrooveTrack: (trackId: string | null) => void;
    toggleMatchGroove: (trackId: string) => void;

    // Bounce Actions
    toggleBounceTrackDialog: (trackId?: string | null) => void;
    toggleBounceRegionsDialog: (clipIds?: string[] | null) => void;
    toggleBounceAllTracksDialog: (show?: boolean) => void;
    bounceTrackInPlace: (trackId: string, settings: any) => void;
    bounceRegionsInPlace: (clipIds: string[], settings: any) => void;
    bounceReplaceAllTracks: (settings: any) => void;
    toggleExportDialog: (type: ProjectState['showExportDialog']) => void;
    exportAsAudioFiles: (settings: any) => void;
    toggleShareDialog: (show?: boolean) => void;
    shareProject: (options: { format: 'project' | 'song' | 'aaf' | 'xml' | 'musicxml'; destination: 'download' | 'web-share'; includeAssets: boolean; compress: boolean; customName: string}) => Promise<void>;
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

    // --- Internal MIDI Routing Actions ---
    setInternalMidiIn: (trackId: string, sourceId: string | undefined, type: Track['internalMidiInType']) => void;
    setInternalMidiInRecordMode: (trackId: string, mode: Track['internalMidiInRecordMode']) => void;
    setMidiOutToTrackSlot: (trackId: string, slotIndex: number) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    id: null,
    name: "Logic Pro Project",
    tempo: 120,
    playing: false,
    playhead: 0,
    tracks: [],
    clips: [],
    alternatives: [],
    currentAlternativeId: null,
    globalTracks: {
        tempo: [{ time: 0, value: 120, type: 'jump' }],
        markers: [],
        signature: [{ time: 0, numerator: 4, denominator: 4 }],
        key: [{ time: 0, root: 'C', mode: 'major' }]
    },
    settings: {
        sampleRate: 48000,
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
        audio: {
            coreAudioEnabled: true,
            inputDevice: 'default',
            outputDevice: 'default',
            ioBufferSize: 256,
            sampleAccurateAutomation: 'All',
            softwareMonitoring: true,
            lowLatencyMonitoring: false,
            lowLatencyLimitMs: 10,
        },
        controlSurfaces: [],
        controlSurfaceAssignments: [],
        controlSurfacesBypassed: false,
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
    controlBarSettings: {
        showViews: true, showTransport: true, showDisplay: true, showModes: true,
        viewButtons: {
            library: true, inspector: true, quickHelp: false, toolbar: true,
            smartControls: true, mixer: true, editors: true, listEditors: false,
            notePad: false, appleLoops: true, browsers: true,
            musicalTyping: true
        },
        transportButtons: {
            goBeginning: false, goPosition: false, goLeftLocator: false, goRightLocator: false, goSelectionStart: false,
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
    showLibrary: true,
    showInspector: true,
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
    countInEnabled: false,
    countInBars: 1,
    hideViewActive: false,
    selectedTrackIds: [],
    focusedTrackId: null,
    selectedClipId: null,
    selectedClipIds: [],
    selectedNoteId: null,
    bottomPanel: 'mixer',
    showSearchAndSelect: false,
    cycleEnabled: false,
    skipCycleEnabled: false,
    locatorLeft: 32,
    locatorRight: 48,
    autoSetLocators: 'off',
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
        const { clips, playhead, metronomeEnabled, tracks, globalTracks } = get();
        set({ playing: true });
        const currentTempoIdx = globalTracks.tempo.reduce((prev, curr, idx) => curr.time <= playhead ? idx : prev, 0);
        const activeTempo = typeof globalTracks.tempo[currentTempoIdx].value === 'number' ? globalTracks.tempo[currentTempoIdx].value as number : 120;
        audioEngine.setTempo(activeTempo);
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
        clips.forEach(clip => {
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) return;
            const isMuted = track.muted || (anySolo && !track.soloed);
            if (isMuted) return;

            let totalTranspose = (clip.transpose || 0) + (track.transpose || 0);
            let totalVelocity = (clip.velocityOffset || 0) + (track.velocityOffset || 0);
            if (track.parentId) {
                const parent = tracks.find(p => p.id === track.parentId);
                if (parent && parent.stackType === 'Summing') {
                    totalTranspose += (parent.transpose || 0);
                    totalVelocity += (parent.velocityOffset || 0);
                }
            }
            const finalClip = { ...clip, transpose: totalTranspose, velocityOffset: totalVelocity };
            if (clip.start - playhead >= 0 || Math.abs(clip.start - playhead) < clip.duration) {
                audioEngine.playRegion(clip.trackId, finalClip, playhead);
            }
        });

        
        const loop = () => {
            if (!get().playing) return;
            const state = get();
            const { playhead, globalTracks, cycleEnabled, skipCycleEnabled, locatorLeft, locatorRight, recording, autopunchEnabled, autopunchStart, autopunchEnd, liveRecordingClips, focusedTrackId } = state;
            
            const newIdx = globalTracks.tempo.reduce((p, c, i) => c.time <= playhead ? i : p, 0);
            const currentTempo = typeof globalTracks.tempo[newIdx].value === 'number' ? globalTracks.tempo[newIdx].value as number : 120;
            const increment = (currentTempo / 60 / 60);
            let nextPlayhead = playhead + increment;
            
            if (skipCycleEnabled && nextPlayhead >= locatorLeft && playhead < locatorLeft) nextPlayhead = locatorRight;
            else if (cycleEnabled && !skipCycleEnabled && nextPlayhead >= locatorRight) nextPlayhead = locatorLeft;
            
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
                                type: track.type === 'midi' ? 'midi' : 'audio',
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
        if (s.recording) {
            // Finalize recordings
            set({ recording: false });
        }
        if (s.playing) { 
            set({ playing: false, recording: false, recordingStartTime: null, liveRecordingClips: {} }); 
            audioEngine.stop(); 
        }
        else { set({ playhead: 0 }); }
    },

    setTempo: (bpm) => {
        set(s => ({ tempo: bpm, globalTracks: { ...s.globalTracks, tempo: [{ time: 0, value: bpm, type: 'jump' }] } }));
        audioEngine.setTempo(bpm);
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

    addMarker: (time, text) => set(s => ({ globalTracks: { ...s.globalTracks, markers: [...s.globalTracks.markers, { id: Date.now().toString(), time, duration: 4, text, color: '#fbc02d' }] } })),

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

    saveProject: async (userId) => {
        const { id, name, tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = get();
        try {
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));
            await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    userId,
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
        } catch (error) { console.error(error); }
    },

    saveAs: async (data) => {
        const { tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = get();
        try {
            const newId = `proj-${Date.now()}`;
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));
            set({ id: newId, name: data.name });
            await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: newId,
                    userId: 'user-1',
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
        } catch (error) { console.error(error); }
    },

    saveCopyAs: async (data) => {
        const { tempo, tracks, clips, globalTracks, settings, currentAlternativeId, alternatives, globalSettings, environment, projectFormat, surroundFormat, spatialAudioMode, timeSignature, keySignature } = get();
        try {
            const copyId = `copy-${Date.now()}`;
            const nestedTracks = tracks.map(t => ({ ...t, clips: clips.filter(c => c.trackId === t.id) }));
            await fetch("/api/project/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: copyId,
                    userId: 'user-1',
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
        // Ensure global defaults are loaded first, then project settings override.
        get().loadGlobalSettings();

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
                    globalTracks: data.globalTracks || get().globalTracks,
                    settings: data.settings || get().settings,
                    globalSettings: data.globalSettings || get().globalSettings,
                    environment: data.environment || get().environment,
                    alternatives: data.alternatives || [],
                    currentAlternativeId: data.currentAlternativeId || null
                });
                audioEngine.setTempo(data.tempo);
                audioEngine.configureAudioFormat(data.projectFormat || get().projectFormat, data.surroundFormat || get().surroundFormat, data.spatialAudioMode || get().spatialAudioMode);
            }
        } catch (e) {
            console.error(e);
        }
    },

    closeProject: () => set({ id: null, name: 'Untitled Project', tracks: [], clips: [], isDirty: false, playing: false, playhead: 0, history: [], future: [] }),

    setDirty: (dirty) => set({ isDirty: dirty }),

    saveHistorySnapshot: () => {
        const snapshot = JSON.parse(JSON.stringify(get()));
        set(s => {
            const nextHistory = [...(s.history || []), snapshot];
            return { history: nextHistory, future: [] };
        });
    },

    undo: () => {
        const { history, future } = get();
        if (!history || history.length === 0) return;
        const lastState = history[history.length - 1];
        const prevHistory = history.slice(0, -1);
        set({ ...lastState, history: prevHistory, future: [...(future || []), JSON.parse(JSON.stringify(get()))] });
    },

    redo: () => {
        const { history, future } = get();
        if (!future || future.length === 0) return;
        const nextState = future[future.length - 1];
        const nextFuture = future.slice(0, -1);
        set({ ...nextState, history: [...(history || []), JSON.parse(JSON.stringify(get()))], future: nextFuture });
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
            settings: legacyData.settings || get().settings,
            globalSettings: legacyData.globalSettings || get().globalSettings,
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
        set(s => {
            const trackId = track.id || Date.now().toString();
            const newTrack = {
                id: trackId, name: 'Audio Track', type: 'audio', muted: false, soloed: false,
                volume: 0.8, pan: 0, color: '#888', orderIndex: s.tracks.length,
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
                ...track
            } as Track;
            return { tracks: [...s.tracks, newTrack], isDirty: true };
        });
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
            if (laneIndex === -1) {
                existingAutomation.push({ parameter, points: [{ time, value }] });
            } else {
                const points = [...existingAutomation[laneIndex].points, { time, value }].sort((a, b) => a.time - b.time);
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
        get().saveHistorySnapshot();
        set(s => ({ tracks: s.tracks.map(t => t.id === id ? { ...t, ...updates } : t), isDirty: true }));
        const t = get().tracks.find(t => t.id === id);
        if (t) audioEngine.updateTrackParams(id, t.volume, t.pan);
    },

    deleteTrack: (id) => {
        get().saveHistorySnapshot();
        set(s => ({ tracks: s.tracks.filter(t => t.id !== id), clips: s.clips.filter(c => c.trackId !== id), isDirty: true }));
    },

    addPlugin: (trackId, pluginType) => {
        const pluginNames = { comp: 'Compressor', eq: 'Channel EQ', reverb: 'Space Designer', delay: 'Delay Designer' };
        const newPlugin = { id: Math.random().toString(), pluginId: pluginType, name: pluginNames[pluginType] as string, enabled: true, params: {} };
        set(s => ({ tracks: s.tracks.map(t => t.id === trackId ? { ...t, plugins: [...t.plugins, newPlugin] } : t) }));
        const track = get().tracks.find(t => t.id === trackId);
        if (track) audioEngine.updateFXChain(trackId, track.plugins);
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
            type: track.type === 'audio' ? 'audio' : (track.type === 'bus' || track.type === 'output' ? 'output' : 'instrument'),
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
        return { clips: [...s.clips, { ...defaultClip, ...clip }] };
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

    splitClipAtTime: (clipId, time) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') return;
        const splitPoint = Math.max(clip.start, Math.min(clip.start + clip.duration, time));
        if (splitPoint <= clip.start || splitPoint >= clip.start + clip.duration) return;

        const first = {
            ...clip,
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-a`,
            duration: splitPoint - clip.start
        };
        const second = {
            ...clip,
            id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-b`,
            start: splitPoint,
            duration: clip.start + clip.duration - splitPoint
        };
        set({
            clips: [...s.clips.filter(c => c.id !== clipId), first, second],
            selectedClipIds: [first.id, second.id],
            selectedClipId: second.id
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
        if (!clip || clip.type !== 'audio') return;

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

    stemSplitter: (clipId, options) => {
        const s = get();
        const clip = s.clips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') return;

        const presets: Record<string, string[]> = {
            'All Stems': ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
            'Vocals + Music': ['vocals', 'instruments'],
            'Vocals Only': ['vocals'],
            'Drums + Bass': ['drums', 'bass'],
        };

        const presetName = options?.preset && presets[options.preset] ? options.preset : 'All Stems';
        const stems = options?.selectedStems && options.selectedStems.length > 0 ? options.selectedStems : presets[presetName];
        const includeSubmix = options?.includeSubmix ?? true;

        const sourceTrack = s.tracks.find(t => t.id === clip.trackId);
        const newTrackOrderBase = sourceTrack ? (sourceTrack.orderIndex + 1) : s.tracks.length;

        const newClips: Clip[] = [];

        stems.forEach((stem, idx) => {
            const trackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${idx}`;
            const trackColor = ['#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'][idx % 6];
            const stemTrack = {
                id: trackId,
                name: `${clip.name} - ${stem}`,
                type: 'audio' as const,
                color: trackColor,
                icon: 'mic',
                orderIndex: newTrackOrderBase + idx,
                muted: false,
                soloed: false,
                volume: 0.8,
                pan: 0,
                protected: false,
                frozen: false,
                enabled: true,
                alternatives: [{ id: 'alt-1', name: 'A' }],
                activeAlternativeId: 'alt-1',
                showInactiveAlternatives: false,
                transpose: 0,
                velocityOffset: 0,
                delay: 0,
                plugins: [],
                sends: [],
                outputBusId: 'stereo-out',
                channelStripId: trackId,
                zoom: 1,
                hidden: false,
                isCollapsed: false,
                isGrooveTrack: false,
                matchGrooveTrack: false,
            };
            // Add the track
            set(state => ({ tracks: [...state.tracks, stemTrack] }));

            newClips.push({
                ...clip,
                id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
                trackId,
                name: `${clip.name} (${stem})`,
                aliasOf: undefined,
                aliasName: undefined,
            });
        });

        if (includeSubmix) {
            const submixTrackId = `track-${Date.now()}-submix`;
            const submixTrack = {
                id: submixTrackId,
                name: `${clip.name} - Submix`,
                type: 'audio' as const,
                color: '#9ca3af',
                icon: 'mic',
                orderIndex: newTrackOrderBase + stems.length,
                muted: false,
                soloed: false,
                volume: 0.8,
                pan: 0,
                protected: false,
                frozen: false,
                enabled: true,
                alternatives: [{ id: 'alt-1', name: 'A' }],
                activeAlternativeId: 'alt-1',
                showInactiveAlternatives: false,
                transpose: 0,
                velocityOffset: 0,
                delay: 0,
                plugins: [],
                sends: [],
                outputBusId: 'stereo-out',
                channelStripId: submixTrackId,
                zoom: 1,
                hidden: false,
                isCollapsed: false,
                isGrooveTrack: false,
                matchGrooveTrack: false,
            };
            set(state => ({ tracks: [...state.tracks, submixTrack] }));
            newClips.push({
                ...clip,
                id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-submix`,
                trackId: submixTrackId,
                name: `${clip.name} (Submix)`,
                aliasOf: undefined,
                aliasName: undefined,
            });
        }

        set({
            clips: [...s.clips.map(c => c.id === clip.id ? { ...c, muted: true } : c), ...newClips],
            selectedClipIds: newClips.map(c => c.id),
            selectedClipId: newClips[0]?.id ?? null,
        });
    },

    addMediaFile: (file, trackId) => {
        const { addTrack, addClip, tracks, focusedTrackId } = get();
        let assignedTrackId = trackId || focusedTrackId || tracks.find(t => t.type === 'audio')?.id;

        if (!assignedTrackId) {
            assignedTrackId = `track-${Date.now()}`;
            addTrack({ id: assignedTrackId, name: 'Audio', type: 'audio', color: '#38bdf8', icon: 'mic', hidden: false } as any);
        }

        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const isMidi = fileExt === 'mid' || fileExt === 'midi';
        const clipType: 'audio' | 'midi' = isMidi ? 'midi' : 'audio';

        const fileUrl = URL.createObjectURL(file);

        addClip({
            id: `clip-${Date.now()}`,
            trackId: assignedTrackId,
            name: file.name,
            type: clipType,
            alternativeId: 'alt-1',
            start: 0,
            duration: 8,
            color: clipType === 'audio' ? '#64D2FF' : '#66FFA9',
            fileUrl,
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

    addNote: (clipId, note) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: [...(c.notes || []), note] } : c) })),


    updateNote: (clipId, noteId, updates) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: c.notes?.map(n => n.id === noteId ? { ...n, ...updates } : n) } : c) })),

    deleteNote: (clipId, noteId) => set(s => ({ clips: s.clips.map(c => c.id === clipId ? { ...c, notes: c.notes?.filter(n => n.id !== noteId) } : c) })),

    setZoom: (z) => set({ zoom: z }),
    setTrackHeight: (h) => set({ trackHeight: h }),
    setSnap: (s) => set({ snap: s }),
    toggleAutomation: () => set(s => ({ showAutomation: !s.showAutomation })),
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

    bounceTrackInPlace: (trackId, settings) => set(s => {
        const track = s.tracks.find(t => t.id === trackId);
        if (!track) return {};

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
            duration: maxEnd - minStart,
            offset: 0,
            color: track.color,
            muted: false,
            loop: false,
            qSwing: 0,
            transpose: 0,
            velocityOffset: 0
        };

        return {
            tracks: updatedTracks,
            clips: [...s.clips, bouncedClip],
            showBounceTrackDialog: null,
            isDirty: true
        };
    }),

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
                    duration: maxEnd - minStart,
                    offset: 0,
                    color: t.color,
                    muted: false,
                    loop: false,
                    qSwing: 0,
                    transpose: 0,
                    velocityOffset: 0
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
    exportAsAudioFiles: (settings) => {
        console.log('Exporting with settings:', settings);
        // In a real app, this would trigger a series of downloads or a zip creation
        set({ showExportDialog: null });
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
    updateVirtualKeyboardParams: (updates) => set(s => ({
        virtualKeyboardOctave: updates.octave !== undefined ? updates.octave : s.virtualKeyboardOctave,
        virtualKeyboardVelocity: updates.velocity !== undefined ? updates.velocity : s.virtualKeyboardVelocity,
        virtualKeyboardPitchBend: updates.pitchBend !== undefined ? updates.pitchBend : s.virtualKeyboardPitchBend,
        virtualKeyboardModulation: updates.modulation !== undefined ? updates.modulation : s.virtualKeyboardModulation,
        virtualKeyboardSustain: updates.sustain !== undefined ? updates.sustain : s.virtualKeyboardSustain,
    })),

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
                        duration: 8,
                        offset: 0,
                        muted: false,
                        loop: false,
                        transpose: 0,
                        velocityOffset: 0,
                        qSwing: 0,
                        color: targetTrack.color || '#5dd3ff',
                        notes: []
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
                
                audioEngine.triggerNote(targetTrackId, pitch, velocity);
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
        audioEngine.triggerNote(targetTrackId, pitch, velocity, repeatRate);
        
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
                    duration: 1, 
                    offset: 0,
                    muted: false,
                    loop: false,
                    transpose: 0,
                    velocityOffset: 0,
                    qSwing: 0,
                    color: targetTrack.color || '#5dd3ff',
                    notes: []
                };
                set(s => ({ 
                    clips: [...s.clips, newClip],
                    liveRecordingClips: { ...s.liveRecordingClips, [targetTrackId]: liveClipId }
                }));
            }

            set(s => ({
                clips: s.clips.map(c => {
                    if (c.id === liveClipId) {
                        return {
                            ...c,
                            notes: [...(c.notes || []), {
                                id: `note-${Date.now()}-${pitch}`,
                                pitch,
                                velocity,
                                start: playhead - c.start,
                                duration: 0.25
                            }]
                        };
                    }
                    return c;
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
            const liveClipId = liveRecordingClips[targetTrackId];
            if (liveClipId) {
                set(s => ({
                    clips: s.clips.map(c => {
                        if (c.id === liveClipId) {
                            return {
                                ...c,
                                notes: c.notes?.map(n => {
                                    if (n.pitch === pitch && n.duration === 0.25) {
                                        const duration = Math.max(0.125, playhead - (c.start + n.start));
                                        return { ...n, duration };
                                    }
                                    return n;
                                })
                            };
                        }
                        return c;
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
    setPianoRollLinkMode: (mode) => set({ pianoRollLinkMode: mode }),
    setPianoRollFocusClipId: (clipId) => set({ pianoRollFocusClipId: clipId }),
    toggleMetronome: () => set(s => {
        if (s.settings.metronome.simpleMode) {
            return { metronomeEnabled: !s.metronomeEnabled };
        } else {
            const nextClickPlaying = !s.settings.metronome.clickWhilePlaying;
            return { 
                metronomeEnabled: nextClickPlaying,
                settings: { ...s.settings, metronome: { ...s.settings.metronome, clickWhilePlaying: nextClickPlaying } }
            };
        }
    }),
    toggleCountIn: () => set(s => ({ countInEnabled: !s.countInEnabled })),
    setCountInBars: (bars) => set({ countInBars: bars }),
    setMetronomeSetting: (key, value) => set(s => {
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
    }),

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

        // In a real app, this would load full channel strip settings
        const updates: Partial<Track> = {};
        updates.name = presetId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
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

    updateTrackParameter: (trackId, params) => set(s => ({
        tracks: s.tracks.map(t => t.id === trackId ? { ...t, ...params } : t),
        isDirty: true
    })),

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

    initializeProject: (settings) => {
        const [num, den] = settings.timeSignature.split('/').map(Number);
        const [root, mode] = settings.keySignature.split(' ');
        set({
            id: `proj-${Date.now()}`,
            name: "New Project",
            tempo: settings.tempo,
            tracks: [],
            clips: [],
            projectFormat: settings.projectFormat || 'stereo',
            surroundFormat: settings.surroundFormat || '5.1 (ITU 775)',
            spatialAudioMode: settings.spatialAudioMode || 'Off',
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
    },

    openProject: async (id) => {
        await get().loadProject(id);
        set(s => ({ recentProjects: s.recentProjects.map(p => p.id === id ? { ...p, lastOpened: Date.now() } : p) }));
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

    addControlSurface: (device) => set(s => {
        const next = {
            ...s.globalSettings,
            controlSurfaces: [...s.globalSettings.controlSurfaces, device]
        };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    updateControlSurface: (id, updates) => set(s => {
        const controlSurfaces = s.globalSettings.controlSurfaces.map(cs => cs.id === id ? { ...cs, ...updates } : cs);
        const next = { ...s.globalSettings, controlSurfaces };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    removeControlSurface: (id) => set(s => {
        const controlSurfaces = s.globalSettings.controlSurfaces.filter(cs => cs.id !== id);
        const next = { ...s.globalSettings, controlSurfaces };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    addControlSurfaceAssignment: (assignment) => set(s => {
        const next = {
            ...s.globalSettings,
            controlSurfaceAssignments: [...s.globalSettings.controlSurfaceAssignments, assignment]
        };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    updateControlSurfaceAssignment: (id, updates) => set(s => {
        const controlSurfaceAssignments = s.globalSettings.controlSurfaceAssignments.map(a => a.id === id ? { ...a, ...updates } : a);
        const next = { ...s.globalSettings, controlSurfaceAssignments };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    removeControlSurfaceAssignment: (id) => set(s => {
        const controlSurfaceAssignments = s.globalSettings.controlSurfaceAssignments.filter(a => a.id !== id);
        const next = { ...s.globalSettings, controlSurfaceAssignments };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

    toggleControlSurfacesBypass: () => set(s => {
        const next = { ...s.globalSettings, controlSurfacesBypassed: !s.globalSettings.controlSurfacesBypassed };
        if (typeof window !== 'undefined') localStorage.setItem('logicDawGlobalSettings', JSON.stringify(next));
        return { globalSettings: next };
    }),

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
    toggleRecording: () => set(s => {
        const isRecording = !s.recording;
        if (isRecording) {
            if (!s.playing) {
                // Logic Pro pattern: Recording starts playback
                return { recording: true, playing: true, recordingStartTime: s.playhead };
            }
            return { recording: true, recordingStartTime: s.playhead };
        }
        return { recording: false, recordingStartTime: null, liveRecordingClips: {} };
    }),

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
        if (!s.playing) {
            set({ playing: true });
            audioEngine.play(s.metronomeEnabled);
        }
        set({ recording: true, recordingStartTime: s.playhead });
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
                    const startInside = clip.start >= marqueeSelection.start && clip.start < (marqueeSelection.start + marqueeSelection.duration);
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

if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('logicDawGlobalSettings');
    if (raw) {
        try {
            let parsed = JSON.parse(raw) as GlobalSettings;
            // ensure new fields exist
            if (!parsed.controlSurfaces) parsed.controlSurfaces = [];
            if (!parsed.controlSurfaceAssignments) parsed.controlSurfaceAssignments = [];
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

