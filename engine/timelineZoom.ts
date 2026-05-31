/**
 * timelineZoom.ts
 * Timeline zoom and coordinate conversion utilities for the DAW.
 * 
 * Manages the relationship between:
 * - Beats (musical time)
 * - Pixels (screen space)
 * - Seconds (audio time)
 * - Zoom levels
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineViewport {
    /** Current zoom level (pixels per beat). Higher = more zoomed in. */
    zoomLevel: number;
    /** Horizontal scroll position in pixels. */
    scrollX: number;
    /** Width of the viewport in pixels. */
    viewportWidth: number;
    /** Height of the viewport in pixels. */
    viewportHeight: number;
}

export interface TimelineCoordinates {
    /** Position in beats (musical time). */
    beat: number;
    /** Position in pixels (screen space). */
    pixel: number;
    /** Position in seconds (audio time, depends on tempo). */
    second: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

export const DEFAULT_ZOOM_LEVEL = 20; // 20 pixels per beat
export const MIN_ZOOM_LEVEL = 5;    // 5 pixels per beat (zoomed out)
export const MAX_ZOOM_LEVEL = 200;   // 200 pixels per beat (zoomed in)
export const ZOOM_FACTOR = 1.2;     // 20% zoom per step

// ─── Core Timeline Zoom Manager ────────────────────────────────────────────────

class TimelineZoomManager {
    private viewport: TimelineViewport = {
        zoomLevel: DEFAULT_ZOOM_LEVEL,
        scrollX: 0,
        viewportWidth: 1000,
        viewportHeight: 400,
    };

    private tempo = 120; // Default tempo

    // ── Public API ────────────────────────────────────────────────────────────

    /** Get current viewport state. */
    getViewport(): TimelineViewport {
        return { ...this.viewport };
    }

    /** Set viewport dimensions (usually called on resize). */
    setViewport(width: number, height: number): void {
        this.viewport.viewportWidth = width;
        this.viewport.viewportHeight = height;
    }

    /** Set current tempo for accurate time conversions. */
    setTempo(tempo: number): void {
        this.tempo = tempo;
    }

    /** Set zoom level (clamped to min/max). */
    setZoom(zoomLevel: number): void {
        this.viewport.zoomLevel = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoomLevel));
    }

    /** Set horizontal scroll position. */
    setScrollX(scrollX: number): void {
        this.viewport.scrollX = Math.max(0, scrollX);
    }

    /** Zoom in by one step. */
    zoomIn(): void {
        this.setZoom(this.viewport.zoomLevel * ZOOM_FACTOR);
    }

    /** Zoom out by one step. */
    zoomOut(): void {
        this.setZoom(this.viewport.zoomLevel / ZOOM_FACTOR);
    }

    /** Reset zoom to default. */
    resetZoom(): void {
        this.viewport.zoomLevel = DEFAULT_ZOOM_LEVEL;
        this.viewport.scrollX = 0;
    }

    /** Zoom to fit a specific beat range. */
    zoomToRange(startBeat: number, endBeat: number): void {
        const beatRange = endBeat - startBeat;
        const paddingBeats = 2; // Add 2 beats padding
        const totalBeats = beatRange + paddingBeats;
        
        const availableWidth = this.viewport.viewportWidth - 100; // Leave some margin
        const requiredZoom = availableWidth / totalBeats;
        
        this.setZoom(requiredZoom);
        this.setScrollX(startBeat * requiredZoom - 50); // Center with padding
    }

    // ── Coordinate Conversion ─────────────────────────────────────────────────────

    /** Convert beats to pixels. */
    beatsToPixels(beats: number): number {
        return beats * this.viewport.zoomLevel;
    }

    /** Convert pixels to beats. */
    pixelsToBeats(pixels: number): number {
        return pixels / this.viewport.zoomLevel;
    }

    /** Convert beats to seconds (using current tempo). */
    beatsToSeconds(beats: number): number {
        return (beats / this.tempo) * 60;
    }

    /** Convert seconds to beats (using current tempo). */
    secondsToBeats(seconds: number): number {
        return (seconds / 60) * this.tempo;
    }

    /** Convert screen X coordinate to timeline beat. */
    screenXToBeat(screenX: number): number {
        const timelineX = screenX + this.viewport.scrollX;
        return this.pixelsToBeats(timelineX);
    }

    /** Convert timeline beat to screen X coordinate. */
    beatToScreenX(beat: number): number {
        const timelineX = this.beatsToPixels(beat);
        return timelineX - this.viewport.scrollX;
    }

    /** Convert screen X coordinate to timeline pixel. */
    screenXToPixel(screenX: number): number {
        return screenX + this.viewport.scrollX;
    }

    /** Convert timeline pixel to screen X coordinate. */
    pixelToScreenX(pixel: number): number {
        return pixel - this.viewport.scrollX;
    }

    // ── Viewport Queries ─────────────────────────────────────────────────────────

    /** Get the beat range currently visible in the viewport. */
    getVisibleBeatRange(): { startBeat: number; endBeat: number } {
        const startPixel = this.viewport.scrollX;
        const endPixel = this.viewport.scrollX + this.viewport.viewportWidth;
        
        return {
            startBeat: this.pixelsToBeats(startPixel),
            endBeat: this.pixelsToBeats(endPixel),
        };
    }

    /** Get the pixel range currently visible in the viewport. */
    getVisiblePixelRange(): { startPixel: number; endPixel: number } {
        return {
            startPixel: this.viewport.scrollX,
            endPixel: this.viewport.scrollX + this.viewport.viewportWidth,
        };
    }

    /** Check if a beat range is visible in the current viewport. */
    isBeatRangeVisible(startBeat: number, endBeat: number): boolean {
        const visible = this.getVisibleBeatRange();
        return endBeat >= visible.startBeat && startBeat <= visible.endBeat;
    }

    /** Get the optimal resolution for waveform rendering based on zoom. */
    getWaveformResolution(): number {
        // Higher zoom = higher resolution
        const baseResolution = 1000;
        const zoomFactor = this.viewport.zoomLevel / DEFAULT_ZOOM_LEVEL;
        return Math.max(200, Math.min(4000, Math.floor(baseResolution * zoomFactor)));
    }

    // ── Utility Methods ─────────────────────────────────────────────────────────

    /** Snap a beat value to the nearest grid subdivision. */
    snapToGrid(beat: number, subdivision = 1/4): number {
        const gridSize = subdivision;
        return Math.round(beat / gridSize) * gridSize;
    }

    /** Get grid line positions for rendering. */
    getGridLines(minSubdivision = 1/16): Array<{ beat: number; pixel: number; isMajor: boolean }> {
        const visible = this.getVisibleBeatRange();
        const visiblePixels = this.getVisiblePixelRange();
        const lines: Array<{ beat: number; pixel: number; isMajor: boolean }> = [];
        
        // Start from the nearest whole beat before the visible range
        const startBeat = Math.floor(visible.startBeat);
        const endBeat = Math.ceil(visible.endBeat);
        
        for (let beat = startBeat; beat <= endBeat; beat += minSubdivision) {
            const isMajor = Number.isInteger(beat);
            const pixel = this.beatsToPixels(beat);
            
            if (pixel >= visiblePixels.startPixel && pixel <= visiblePixels.endPixel) {
                lines.push({ beat, pixel, isMajor });
            }
        }
        
        return lines;
    }
}

// ─── Export Singleton ─────────────────────────────────────────────────────────────

export const timelineZoom = new TimelineZoomManager();

// ─── React Hook Integration ───────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

// Global subscriber list — every mounted useTimelineZoom() instance registers here.
// When zoom/scroll changes, ALL subscribers are notified, not just the one that
// triggered the change.  This is what makes buttons in TimelineZoomControls
// correctly re-render Timeline (and vice-versa).
const zoomSubscribers = new Set<() => void>();

function notifyAll() {
    zoomSubscribers.forEach(fn => fn());
}

export function useTimelineZoom(initialWidth = 1000, initialHeight = 400) {
    const [, forceUpdate] = useState({});

    // Update viewport dimensions
    useEffect(() => {
        timelineZoom.setViewport(initialWidth, initialHeight);
    }, [initialWidth, initialHeight]);

    // Register this component as a subscriber so it re-renders on any zoom change
    useEffect(() => {
        const notify = () => forceUpdate({});
        zoomSubscribers.add(notify);
        return () => { zoomSubscribers.delete(notify); };
    }, []);

    // Wrappers that mutate the singleton then notify every subscriber
    const setZoom = (zoom: number) => { timelineZoom.setZoom(zoom); notifyAll(); };
    const zoomIn  = () => { timelineZoom.zoomIn();   notifyAll(); };
    const zoomOut = () => { timelineZoom.zoomOut();  notifyAll(); };
    const resetZoom = () => { timelineZoom.resetZoom(); notifyAll(); };
    const setScrollX = (scrollX: number) => { timelineZoom.setScrollX(scrollX); notifyAll(); };
    const zoomToRange = (start: number, end: number) => { timelineZoom.zoomToRange(start, end); notifyAll(); };

    return {
        // Always read live from singleton — never from a stale ref
        viewport: timelineZoom.getViewport(),
        setZoom,
        zoomIn,
        zoomOut,
        resetZoom,
        setScrollX,
        zoomToRange,
        setTempo: (tempo: number) => { timelineZoom.setTempo(tempo); },

        // Coordinate helpers
        beatsToPixels: (beats: number)  => timelineZoom.beatsToPixels(beats),
        pixelsToBeats: (pixels: number) => timelineZoom.pixelsToBeats(pixels),
        screenXToBeat: (x: number)      => timelineZoom.screenXToBeat(x),
        beatToScreenX: (beat: number)   => timelineZoom.beatToScreenX(beat),
        getVisibleBeatRange:     ()              => timelineZoom.getVisibleBeatRange(),
        getWaveformResolution:   ()              => timelineZoom.getWaveformResolution(),
        getGridLines:            (sub?: number)  => timelineZoom.getGridLines(sub),
    };
}
