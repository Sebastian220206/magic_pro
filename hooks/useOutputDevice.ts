'use client';

import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { audioContextManager } from '@/engine/audioEngine/audioContext';

/**
 * Keep the mix going to the output chosen in Settings.
 *
 * `setOutputDevice` had exactly one caller: the dropdown's `onChange`. So the
 * choice was applied at the instant it was made and never again — not on
 * reload, not on opening the project a second time, not when the audio engine
 * started later. And it refused to apply at all when no AudioContext existed
 * yet, which is the normal state before the first sound is played, so choosing
 * an output before pressing play did nothing whatsoever.
 *
 * The stored setting is the intent. This states it whenever it changes and
 * once on mount; the context applies it on creation and on every re-creation.
 */
export function useOutputDevice(): void {
    const outputDevice = useProjectStore(s => s.globalSettings?.audio?.outputDevice);
    // The label goes with it: ids rotate, and this is what finds the same
    // output again when the stored id stops resolving.
    const outputLabel = useProjectStore(s => s.globalSettings?.audio?.outputDeviceLabel);

    useEffect(() => {
        if (!outputDevice) return;
        void audioContextManager.setOutputDevice(outputDevice, outputLabel ?? undefined);
    }, [outputDevice, outputLabel]);
}
