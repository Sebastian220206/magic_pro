export interface QuickHelpItem {
    id: string;
    name: string;
    description: string;
    tip?: string;
}

export const QUICK_HELP_DATA: Record<string, QuickHelpItem> = {
    // Left Group
    library: {
        id: "library",
        name: "Library",
        description: "Browse and load instrument and effect patches.",
        tip: "Use patches to quickly set up channel strips."
    },
    inspector: {
        id: "inspector",
        name: "Inspector",
        description: "Show or hide the track and region parameters list.",
        tip: "Adjust quantization, transposition, and channel strip settings here."
    },
    quick_help: {
        id: "quick_help",
        name: "Quick Help",
        description: "Toggle the floating Quick Help window.",
        tip: "Hover over UI elements while this is active to learn more."
    },
    toolbar: {
        id: "toolbar",
        name: "Toolbar",
        description: "Show or hide common commands like Split, Joint, and Mutate.",
        tip: "Customize the commands visible here by right-clicking. "
    },
    smart_controls: {
        id: "smart_controls",
        name: "Smart Controls",
        description: "Open simplified controls for the selected track's sounds.",
        tip: "Perfect for mapping hardware knobs to complex instrument parameters."
    },
    mixer: {
        id: "mixer",
        name: "Mixer",
        description: "Open the full mixing console for volume, panning, and processing.",
        tip: "Double-byte (⌘2) opens this in a standalone window."
    },
    editors: {
        id: "editors",
        name: "Editors",
        description: "Open the MIDI or Audio editor for the selected region.",
        tip: "Switch between Piano Roll, Score, and Step Sequencer views."
    },

    // Transport Group
    stop: {
        id: "stop",
        name: "Stop",
        description: "Halt playback or recording immediately.",
        tip: "Clicking twice returns the playhead to the project start."
    },
    play: {
        id: "play",
        name: "Play",
        description: "Start playback from the current playhead position.",
        tip: "Spacebar is the global default shortcut."
    },
    record: {
        id: "record",
        name: "Record",
        description: "Begin recording audio or MIDI on armed tracks.",
        tip: "Ensure your tracks are record-enabled (R) before clicking."
    },
    cycle: {
        id: "cycle",
        name: "Cycle Mode",
        description: "Loop playback between the left and right locators.",
        tip: "Drag the yellow bar in the ruler to adjust the loop range."
    },

    // Center Display
    lcd_display: {
        id: "lcd_display",
        name: "LCD Display",
        description: "Shows project metrics: time position, tempo, and signature.",
        tip: "Click the dropdown to switch between Beats, Time, or Custom views."
    },

    // Modes & Performance
    metronome: {
        id: "metronome",
        name: "Metronome",
        description: "Plays a click track during playback or recording.",
        tip: "Right-click to adjust click volume and accent settings."
    },
    count_in: {
        id: "count_in",
        name: "Count-In",
        description: "Adds 1 or 2 bars of metronome clicks before recording starts.",
        tip: "Helpful for getting into the groove before the beat drops."
    },
    master_volume: {
        id: "master_volume",
        name: "Master Volume",
        description: "Controls the final output level of the stereo mix.",
        tip: "Avoid letting this peak (turn red) as it causes digital distortion."
    }
};
