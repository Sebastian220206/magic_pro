import { WavSampler } from './wav-sampler.js';
import { SF2Engine } from './sf2-engine.js';

/**
 * Unified Instrument Router
 * Manages both SF2 and WAV Sampler engines as a unified rack.
 */
export class InstrumentRouter {
    /**
     * @param {AudioContext} audioContext
     * @param {SF2Engine} sf2Engine
     * @param {WavSampler} wavSampler
     */
    constructor(audioContext, sf2Engine, wavSampler) {
        if (!audioContext || !sf2Engine || !wavSampler) {
            throw new Error("Missing required arguments for InstrumentRouter");
        }
        
        this.ctx = audioContext;
        this.sf2Engine = sf2Engine;
        this.wavSampler = wavSampler;
        
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;

        // Routing both engines to router's master gain
        // The individual engines have their own masterGain, but SF2 outputs direct to destination currently.
        // Let's ensure WAV outputs to us.
        this.wavSampler.getOutput().connect(this.masterGain);
        
        // State tracking
        // channel (1-16) -> { engine: 'sf2'|'wav', instrumentIndex: number|object, layers: channel[] }
        this.channels = new Map();
        for (let i = 1; i <= 16; i++) {
            this.channels.set(i, { engine: 'sf2', instrumentIndex: 0, layers: [] });
        }
        
        this.midiAccess = null;
    }

    /**
     * Connect the master output
     * @param {AudioNode} destination
     */
    connectOutput(destination) {
        this.masterGain.connect(destination);
    }

    /**
     * Assign an engine and instrument to a MIDI channel
     * @param {number} channel - 1 to 16
     * @param {string} engine - 'sf2' or 'wav'
     * @param {any} instrumentIndex - integer for SF2, JSON object for WAV
     */
    assignChannel(channel, engine, instrumentIndex) {
        if (channel < 1 || channel > 16) throw new Error("Invalid MIDI channel");
        const chData = this.channels.get(channel);
        chData.engine = engine;
        chData.instrumentIndex = instrumentIndex;
        
        // Pre-activate if needed
        if (engine === 'sf2') {
            this.sf2Engine.selectInstrument(instrumentIndex);
        } else if (engine === 'wav') {
            this.wavSampler.loadInstrument(instrumentIndex);
        }
        console.log(`[Router] Assigned Ch ${channel} -> ${engine}`);
    }

    /**
     * Enable layering where playing channel1 also plays channel2
     * @param {number} channel1
     * @param {number} channel2
     */
    enableLayer(channel1, channel2) {
        if (channel1 === channel2) return;
        const chData = this.channels.get(channel1);
        if (!chData.layers.includes(channel2)) {
            chData.layers.push(channel2);
            console.log(`[Router] Enabled Layer: Ch ${channel1} triggers Ch ${channel2}`);
        }
    }

    /**
     * Connect to Web MIDI API and listen for hardware input
     * @returns {Promise<void>}
     */
    async connectMIDI() {
        if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI API not supported in this browser.");
            return;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            for (let input of this.midiAccess.inputs.values()) {
                input.onmidimessage = this.onMIDIMessage.bind(this);
                console.log(`[Router] Connected MIDI Input: ${input.name}`);
            }
            
            this.midiAccess.onstatechange = (e) => {
                const port = e.port;
                if (port.type === 'input' && port.state === 'connected') {
                    port.onmidimessage = this.onMIDIMessage.bind(this);
                    console.log(`[Router] MIDI Connected: ${port.name}`);
                }
            };
        } catch (err) {
            console.error(`[Router] Failed to connect MIDI: ${err}`);
        }
    }

    /**
     * Internal MIDI Message Handler
     * @param {MIDIMessageEvent} message
     */
    onMIDIMessage(message) {
        const [status, data1, data2] = message.data;
        const cmd = status >> 4;
        const channel = (status & 0xf) + 1; // 1-16
        const velocity = data2;
        const note = data1;

        if (cmd === 9 && velocity > 0) { // Note On
            this.triggerNoteOn(channel, note, velocity);
        } else if (cmd === 8 || (cmd === 9 && velocity === 0)) { // Note Off
            this.triggerNoteOff(channel, note);
        }
    }

    /**
     * Trigger note on for a specific channel
     * @param {number} channel 
     * @param {number} note 
     * @param {number} velocity 
     */
    triggerNoteOn(channel, note, velocity) {
        const chData = this.channels.get(channel);
        if (!chData) return;

        // Route to assigned engine
        if (chData.engine === 'sf2') {
            this.sf2Engine.noteOn(note, velocity);
        } else {
            this.wavSampler.noteOn(note, velocity);
        }

        // Trigger layers
        chData.layers.forEach(layerChannel => {
            this.triggerNoteOn(layerChannel, note, velocity);
        });
    }

    /**
     * Trigger note off for a specific channel
     * @param {number} channel 
     * @param {number} note 
     */
    triggerNoteOff(channel, note) {
        const chData = this.channels.get(channel);
        if (!chData) return;

        if (chData.engine === 'sf2') {
            this.sf2Engine.noteOff(note);
        } else {
            this.wavSampler.noteOff(note);
        }

        chData.layers.forEach(layerChannel => {
            this.triggerNoteOff(layerChannel, note);
        });
    }
}
