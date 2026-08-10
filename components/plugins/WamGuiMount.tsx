'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { WamInsertProcessor } from '@/engine/plugins/wam/wamProcessor';

interface WamGuiMountProps {
    processor: WamInsertProcessor;
}

/**
 * Hosts a Web Audio Module's own GUI.
 *
 * A WAM returns a plain `HTMLElement` from `createGui()` rather than a React
 * element, so it is appended to a container ref and handed back on unmount.
 *
 * Mount/unmount is guarded by a `cancelled` flag: `reactStrictMode` mounts
 * effects twice in development, and an unbalanced create/destroy leaks both the
 * DOM node and whatever listeners the plugin attached to it.
 */
export function WamGuiMount({ processor }: WamGuiMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

    useEffect(() => {
        let cancelled = false;
        let mounted: HTMLElement | null = null;

        (async () => {
            const element = await processor.createGui();

            if (cancelled) {
                // The effect was torn down while the GUI was being built.
                if (element) processor.destroyGui(element);
                return;
            }

            if (!element || !containerRef.current) {
                setStatus('unavailable');
                return;
            }

            containerRef.current.appendChild(element);
            mounted = element;
            setStatus('ready');
        })();

        return () => {
            cancelled = true;
            if (mounted) {
                processor.destroyGui(mounted);
                mounted.remove();
                mounted = null;
            }
        };
    }, [processor]);

    if (status === 'unavailable') {
        // Caller falls back to the generated parameter UI.
        return null;
    }

    return (
        <div className="relative">
            {status === 'loading' && (
                <div className="py-10 text-center text-[11px] text-studio-text-dim">
                    Loading plugin interface…
                </div>
            )}
            {/* The plugin sizes itself; let it, and scroll if it overflows. */}
            <div ref={containerRef} className="overflow-auto max-h-[70vh]" />
        </div>
    );
}
