"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { enableMapSet } from "immer";
import { ToastProvider } from "@/components/Toast";
import { audioEngine } from "@/engine/AudioEngineAdapter";
import { useProjectStore } from "@/store/projectStore";
import { useMidiStore } from "@/store/midiStore";
import { getInstrumentService } from "@/engine/instruments/instrumentService";
import { initializeInstruments } from "@/engine/instruments/instrumentBootstrap";
import { midiDeviceService } from "@/engine/midi/midiDeviceService";
import { routingEngine } from "@/engine/audioEngine/routingEngine";
import { loadSoundFontForTrack } from "@/engine/instruments/soundfont/loadSoundFontForTrack";
import { startLiveMidiInput } from "@/engine/midi/liveMidiInput";
import { createAutosave } from "@/engine/persistence/autosave";
import { createIndexedDBAdapter } from "@/engine/filesystem/indexedDBAdapter";

enableMapSet();

/**
 * Expose the stores and engine on `window` outside production.
 *
 * The DAW has no way to inspect transport or store state from the console, which
 * makes runtime problems (and browser-driven tests) far harder than they need to
 * be. Guarded so nothing is attached to a production bundle.
 */
function useDevGlobals() {
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;
        const w = window as unknown as Record<string, unknown>;
        w.__magicPro = {
            projectStore: useProjectStore,
            midiStore: useMidiStore,
            audioEngine,
            instrumentService: getInstrumentService(),
            loadSoundFont: loadSoundFontForTrack,
            routingEngine,
        };
        return () => { delete w.__magicPro; };
    }, []);
}

function EngineBoot() {
    useDevGlobals();

    useEffect(() => {
        audioEngine.init()
            .then(() =>
                // Bring instruments up here, at app scope, so the instrument
                // graph lives as long as the page. It used to be initialised
                // (and disposed) by the Library panel, so closing that panel
                // destroyed every loaded instrument and playback silently
                // reverted to the built-in synth.
                initializeInstruments(
                    useProjectStore.getState().tracks,
                    (trackId, updates) => useProjectStore.getState().updateTrack(trackId, updates),
                ),
            )
            .catch((err) =>
                console.error("[EngineBoot] Audio engine initialization failed:", err)
            );

        // Initialize IndexedDB persistence
        const adapter = createIndexedDBAdapter();
        adapter.initialize().catch((err) =>
            console.warn("[Persistence] IndexedDB init failed:", err)
        );

        // Start autosave subscription (debounced 3s)
        const unsubscribe = createAutosave(
            useProjectStore.subscribe,
            useProjectStore.getState,
            { debounceMs: 3000 }
        );

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch((err) =>
                    console.warn('[PWA] Service worker registration failed:', err)
                );
            });
        }

        // Discover MIDI devices through the shared service, which owns the one
        // MIDIAccess object and reports why enumeration failed. Keeping the
        // project's device list in sync happens here so it is populated whether
        // or not the preferences dialog has ever been opened.
        const unsubscribeMidi = midiDeviceService.subscribe(snapshot => {
            if (snapshot.status !== 'granted') return;
            const state = useProjectStore.getState();
            const existing = (state.globalSettings.midi?.inputs || []) as { name: string; enabled: boolean }[];
            const merged = snapshot.devices.map(device => {
                const prior = existing.find(e => e.name === device.name);
                return { name: device.name, enabled: prior ? prior.enabled : true };
            });

            const unchanged =
                merged.length === existing.length &&
                merged.every((m, i) => m.name === existing[i]?.name && m.enabled === existing[i]?.enabled);
            if (unchanged) return;

            state.updateGlobalSettings({ midi: { ...state.globalSettings.midi, inputs: merged } });
        });

        void midiDeviceService.initialize();

        // Route notes from a connected keyboard to the armed track. Without
        // this, MIDI messages only reached the control-surface command matcher
        // and every played note was discarded.
        const stopMidiInput = startLiveMidiInput({
            getState: () => useProjectStore.getState(),
            getDeviceName: (inputId) =>
                midiDeviceService.getSnapshot().devices.find(d => d.id === inputId)?.name,
        });

        return () => {
            unsubscribe();
            unsubscribeMidi();
            stopMidiInput();
            adapter.close();
        };
    }, []);
    return null;
}

export function Providers({ children, session }: { children: React.ReactNode; session?: any }) {
    return (
        <SessionProvider session={session}>
            <ToastProvider>
                <EngineBoot />
                {children}
            </ToastProvider>
        </SessionProvider>
    );
}
