export interface Preset {
    id: string;
    name: string;
    type: 'instrument' | 'audio_effect' | 'midi_effect';
    category: string;
}

export interface Category {
    name: string;
    presets: Preset[];
}

export const libraryData: Category[] = [
    {
        name: "Software Instruments",
        presets: [
            { id: "grand_piano", name: "Grand Piano", type: "instrument", category: "Software Instruments" },
            { id: "e_piano", name: "Electric Piano", type: "instrument", category: "Software Instruments" },
            { id: "analog_pad", name: "Analog Pad", type: "instrument", category: "Software Instruments" },
        ]
    },
    {
        name: "Synthesizers",
        presets: [
            { id: "lead_synth", name: "Lead Synth", type: "instrument", category: "Synthesizers" },
            { id: "warm_strings", name: "Warm Strings", type: "instrument", category: "Synthesizers" },
            { id: "deep_bass", name: "Deep Bass", type: "instrument", category: "Synthesizers" },
        ]
    },
    {
        name: "Drum Kits",
        presets: [
            { id: "trap_kit", name: "Trap Drum Kit", type: "instrument", category: "Drum Kits" },
            { id: "acoustic_kit", name: "Acoustic Kit", type: "instrument", category: "Drum Kits" },
            { id: "808_classic", name: "808 Classic", type: "instrument", category: "Drum Kits" },
        ]
    },
    {
        name: "Keyboards",
        presets: [
            { id: "hammond_organ", name: "Hammond Organ", type: "instrument", category: "Keyboards" },
            { id: "clavinet", name: "Clavinet", type: "instrument", category: "Keyboards" },
        ]
    },
    {
        name: "Audio Effects",
        presets: [
            { id: "reverb_space", name: "Space Reverb", type: "audio_effect", category: "Audio Effects" },
            { id: "compressor_pro", name: "Pro Compressor", type: "audio_effect", category: "Audio Effects" },
            { id: "echo_delay", name: "Tape Echo", type: "audio_effect", category: "Audio Effects" },
        ]
    }
];
