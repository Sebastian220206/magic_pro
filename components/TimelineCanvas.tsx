"use client"

import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { TimelineRenderer, TimelineViewport } from '@/engine/timeline/TimelineRenderer';
import { getTimelineEditor } from '@/engine/editor/EditorCore';
import { timelineNavigation } from '@/engine/navigation/NavigationEngine';
import { globalRendererScheduler } from '@/engine/rendering/contracts/RendererScheduler';
import { globalDirtyRegionManager } from '@/engine/rendering/invalidation/DirtyRegionManager';
import { globalDirtyVisualizer } from '@/engine/rendering/invalidation/DirtyRegionVisualizer';

export function TimelineCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<TimelineRenderer | null>(null);
    const editor = getTimelineEditor();
    
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        rendererRef.current = new TimelineRenderer(ctx);

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height });
            }
        });

        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !rendererRef.current || dimensions.width === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);

        // Register with global scheduler
        globalRendererScheduler.register(rendererRef.current);
        // Optional: register debug visualizer
        // globalRendererScheduler.setDebugRenderer(globalDirtyVisualizer as any);

        // We wrap executeFrame so we can pass the canvas context
        const renderCanvas = () => {
            if (!ctx) return;
            const viewportState = timelineNavigation.getState();
            globalRendererScheduler.executeFrame(ctx, viewportState);
        };

        // 1. Initial draw requires a full frame
        globalDirtyRegionManager.markDirty({ x: 0, y: 0, width: dimensions.width, height: dimensions.height, source: 'FULL_FRAME' });
        renderCanvas();

        // 2. Subscribe to 60fps Navigation Engine
        const unsubscribeNav = timelineNavigation.subscribe(() => {
            // A navigation tick implies viewport movement
            globalDirtyRegionManager.markDirty({ x: 0, y: 0, width: dimensions.width, height: dimensions.height, source: 'VIEWPORT_PAN' });
            renderCanvas();
        });

        // 3. Subscribe to Zustand store for data mutations (clips, playhead)
        let lastPlayhead = useProjectStore.getState().playhead;
        const unsubscribeStore = useProjectStore.subscribe((state) => {
            if (state.playhead !== lastPlayhead) {
                // Playhead moved: invalidate old and new rects
                const zoom = timelineNavigation.getState().pixelsPerBeat;
                const startBeat = timelineNavigation.getState().startBeat;
                const oldX = (lastPlayhead - startBeat) * zoom;
                const newX = (state.playhead - startBeat) * zoom;
                
                globalDirtyRegionManager.markDirty({ x: oldX - 5, y: 0, width: 10, height: dimensions.height, source: 'PLAYHEAD' });
                globalDirtyRegionManager.markDirty({ x: newX - 5, y: 0, width: 10, height: dimensions.height, source: 'PLAYHEAD' });
                
                lastPlayhead = state.playhead;
            } else {
                // Other state changes (clip edits) temporarily force full redraw until tools are wired
                globalDirtyRegionManager.markDirty({ x: 0, y: 0, width: dimensions.width, height: dimensions.height, source: 'FULL_FRAME' });
            }
            renderCanvas();
        });

        return () => {
            unsubscribeNav();
            unsubscribeStore();
        };
    }, [dimensions, editor]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
        />
    );
}
