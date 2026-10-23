'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { WamInsertProcessor } from '@/engine/plugins/wam/wamProcessor';

interface WamGuiMountProps {
    processor: WamInsertProcessor;
    /**
     * Rendered when the plugin has no interface of its own, or takes too long
     * to build one. Pass the generated parameter UI.
     */
    fallback?: React.ReactNode;
}

/**
 * How long to wait for `createGui()` before showing the fallback.
 *
 * A WAM's GUI is its own code — commonly a dynamic import of a bundle that
 * fetches further assets — and nothing obliges that promise to settle. Without
 * a deadline the editor sat on "Loading plugin interface…" for as long as it
 * was left open. A GUI that arrives after the deadline is still mounted.
 */
const GUI_TIMEOUT_MS = 15_000;

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
export function WamGuiMount({ processor, fallback }: WamGuiMountProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

    useEffect(() => {
        let cancelled = false;
        let mounted: HTMLElement | null = null;

        // Stop waiting rather than stall the editor; see GUI_TIMEOUT_MS.
        const deadline = window.setTimeout(() => {
            if (!cancelled) setStatus(s => (s === 'loading' ? 'unavailable' : s));
        }, GUI_TIMEOUT_MS);

        (async () => {
            const element = await processor.createGui();
            window.clearTimeout(deadline);

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
            window.clearTimeout(deadline);
            if (mounted) {
                processor.destroyGui(mounted);
                mounted.remove();
                mounted = null;
            }
        };
    }, [processor]);

    return (
        <div className="relative">
            {status === 'loading' && (
                <div className="py-10 text-center text-[11px] text-studio-text-dim">
                    Loading plugin interface…
                </div>
            )}
            {status === 'unavailable' && fallback}
            {/* Always mounted, so a GUI that arrives late still has a home.
                The plugin sizes itself; let it, and scroll if it overflows. */}
            <div ref={containerRef} className="overflow-auto max-h-[70vh]" />
        </div>
    );
}
