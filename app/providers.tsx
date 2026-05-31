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

        return () => {
            unsubscribe();
            adapter.close();
        };
    }, []);
    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>
                <EngineBoot />
                {children}
            </ToastProvider>
        </SessionProvider>
    );
}
