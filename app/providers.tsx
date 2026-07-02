"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { enableMapSet } from "immer";
import { ToastProvider } from "@/components/Toast";
import { audioEngine } from "@/engine/AudioEngineAdapter";
import { useProjectStore } from "@/store/projectStore";
import { createAutosave } from "@/engine/persistence/autosave";
import { createIndexedDBAdapter } from "@/engine/filesystem/indexedDBAdapter";

enableMapSet();

function EngineBoot() {
    useEffect(() => {
        audioEngine.init().catch((err) =>
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

        // Enumerate MIDI devices on startup
        if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess().then(access => {
                const { globalSettings, updateGlobalSettings } = useProjectStore.getState();
                const inputs: { name: string; enabled: boolean }[] = [];
                access.inputs.forEach(input => {
                    inputs.push({ name: input.name || 'Unknown MIDI Device', enabled: true });
                });
                const existingInputs = (globalSettings.midi?.inputs || []) as { name: string; enabled: boolean }[];
                const mergedInputs = inputs.map(newInput => {
                    const existing = existingInputs.find((e: any) => e.name === newInput.name);
                    return existing ? { ...newInput, enabled: existing.enabled } : newInput;
                });
                updateGlobalSettings({ midi: { ...globalSettings.midi, inputs: mergedInputs } });

                access.onstatechange = () => {
                    const state = useProjectStore.getState();
                    const updatedInputs: { name: string; enabled: boolean }[] = [];
                    access.inputs.forEach(input => {
                        updatedInputs.push({ name: input.name || 'Unknown MIDI Device', enabled: true });
                    });
                    const merged = updatedInputs.map(newInput => {
                        const existing = (state.globalSettings.midi?.inputs || []).find((e: any) => e.name === newInput.name);
                        return existing ? { ...newInput, enabled: existing.enabled } : newInput;
                    });
                    state.updateGlobalSettings({ midi: { ...state.globalSettings.midi, inputs: merged } });
                };
            }).catch(err => console.warn('[MIDI] Failed to enumerate devices:', err));
        }

        return () => {
            unsubscribe();
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
