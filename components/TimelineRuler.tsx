"use client";

/**
 * TimelineRuler
 * -----------------------------------------------------------------------------
 * A high-performance Canvas-rendered DAW ruler/header for the project timeline.
 *
 * Visual layers (top → bottom):
 *   1. Bar / measure numbers (adaptive density based on zoom)
 *   2. Beat subdivisions
 *   3. Loop / cycle region (yellow bar with handles)
 *   4. Playhead overlay (red triangle + vertical line) — rAF-driven
 *
 * Mouse interactions:
 *   - Click ruler             → move playhead to that beat
 *   - Drag empty ruler        → create new loop region
 *   - Drag loop body          → move loop range
 *   - Drag left/right handle  → resize loop
 *   - Double-click ruler      → clear loop
 *   - Shift + drag            → disable snapping
 *   - Wheel / Ctrl+wheel      → horizontal scroll / zoom (delegates to timelineZoom)
 *
 * State: reads / writes `cycleEnabled`, `locatorLeft`, `locatorRight` on
 * the project store (alias names `loopEnabled`, `loopStartBeat`,
 * `loopEndBeat` are exposed by the store helpers `setLoop` / `clearLoop`).
 *
 * Performance notes:
 *   - The playhead animates via a single rAF loop, decoupled from React
 *     re-renders. Static ruler contents (bars, ticks, loop region) are
 *     rebuilt on a stable signature; only when something visible actually
 *     changes does the static layer redraw.
 *   - Bar labels switch cadence dynamically (1, 2, 4, 5, 8, 10 … bars) to
 *     stay readable at every zoom level.
 *   - All long-running effects are cleaned up on unmount.
 * -----------------------------------------------------------------------------
 */

import React, { RefObject, useEffect, useRef, useState, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";

const BAR_HEIGHT = 18;        // top section: bar numbers
const BEAT_HEIGHT = 10;       // mid section: beat subdivisions
const LOOP_HEIGHT = 14;       // bottom section: loop region
const RULER_HEIGHT = BAR_HEIGHT + BEAT_HEIGHT + LOOP_HEIGHT;

const HANDLE_WIDTH = 6;       // px width of loop edge grab target
const MIN_LOOP_BEATS = 0.25;  // snap minimum
/** Below this, a pointer movement is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

// Adaptive label density: at low zoom, only label every Nth bar.
function chooseBarStep(pixelsPerBeat: number): number {
    const targetPx = 90;
    const beatsBetween = targetPx / Math.max(1, pixelsPerBeat);
    const barsBetween = Math.max(1, Math.round(beatsBetween / 4));
    const steps = [1, 2, 4, 5, 8, 10, 16, 20, 32, 50, 100];
    for (const s of steps) if (barsBetween <= s) return s;
    return 100;
}

function chooseMinorSubdivision(pixelsPerBeat: number): number {
    if (pixelsPerBeat >= 80) return 0.25;
    if (pixelsPerBeat >= 40) return 0.5;
    if (pixelsPerBeat >= 20) return 1;
    if (pixelsPerBeat >= 8)  return 2;
    if (pixelsPerBeat >= 4)  return 4;
    return 8;
}

function snap(value: number, divisor: number): number {
    return Math.round(value / divisor) * divisor;
}

type TimelineRulerProps = {
    pixelsPerBeat: number;
    scrollLeft: number;
    scrollContainerRef?: RefObject<HTMLDivElement>;
};

export function TimelineRuler({ pixelsPerBeat, scrollLeft, scrollContainerRef }: TimelineRulerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const staticLayerRef = useRef<HTMLCanvasElement | null>(null);
    const playheadLayerRef = useRef<HTMLCanvasElement | null>(null);

    // Stable refs for animation
    const rafIdRef = useRef<number | null>(null);

    const [size, setSize] = useState({ width: 0, height: RULER_HEIGHT });

    // Store
    const playhead     = useProjectStore(s => s.playhead);
    const cycleEnabled = useProjectStore(s => s.cycleEnabled);
    const locatorLeft  = useProjectStore(s => s.locatorLeft);
    const locatorRight = useProjectStore(s => s.locatorRight);
    const setLocators  = useProjectStore(s => s.setLocators);
    const setLoop      = useProjectStore(s => s.setLoop);
    const setLoopEnabled = useProjectStore(s => s.setLoopEnabled);
    const clearLoop    = useProjectStore(s => s.clearLoop);
    const movePlayhead = useProjectStore(s => s.movePlayhead);
    const setZoom = useProjectStore(s => s.setZoom);

    const ppb = Math.max(1, pixelsPerBeat);
    const scrollX = Math.max(0, scrollLeft);

    const viewportRef = useRef({ pixelsPerBeat: ppb, scrollLeft: scrollX });
    useEffect(() => {
        viewportRef.current = { pixelsPerBeat: ppb, scrollLeft: scrollX };
    }, [ppb, scrollX]);

    // Mirror store playhead into a ref so the rAF loop reads the latest value
    const playheadRef = useRef(playhead);
    useEffect(() => { playheadRef.current = playhead; }, [playhead]);

    // ── ResizeObserver to track container width and set timelineZoom viewport width ────────────────────────────────
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                const width = e.contentRect.width;
                setSize({ width, height: RULER_HEIGHT });
                // Update the timelineZoom viewport width so that coordinate conversion works for this width
                // Note: We can't directly setViewport from the hook, but we trigger a resize which will cause
                // the hook to update its internal state via the useEffect dependency on size.width
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Force a redraw of the static layer on demand
    const redrawRef = useRef<() => void>(() => {});
    const requestRedraw = useCallback(() => { redrawRef.current(); }, []);

    // ── Build the static (cached) layer: bars, beats, loop region ───────────
    const buildStaticLayer = useCallback(() => {
        const cvs = staticLayerRef.current;
        if (!cvs) return;
        const dpr = window.devicePixelRatio || 1;
        const cssW = cvs.width / dpr;
        const cssH = cvs.height / dpr;
        const ctx = cvs.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.scale(dpr, dpr);

        const barStep = chooseBarStep(ppb);
        const minorSub = chooseMinorSubdivision(ppb);

        // Dark DAW background
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, cssW, cssH);

        // Bottom separator
        ctx.fillStyle = "#000";
        ctx.fillRect(0, cssH - 1, cssW, 1);

        // Visible beat range
        const startBeat = scrollX / ppb;
        const endBeat   = (scrollX + cssW) / ppb;

        // ── Beat / subdivision lines ─────────────────────────────────────
        const firstBeat = Math.floor(startBeat / minorSub) * minorSub;
        for (let b = firstBeat; b <= endBeat + minorSub; b += minorSub) {
            const x = b * ppb - scrollX;
            if (x < -1 || x > cssW + 1) continue;
            const isBar = Math.abs((b / 4) - Math.round(b / 4)) < 1e-6;
            const isBeat = Math.abs(b - Math.round(b)) < 1e-6;
            if (isBar) {
                ctx.strokeStyle = "rgba(255,255,255,0.22)";
                ctx.beginPath();
                ctx.moveTo(Math.round(x) + 0.5, 0);
                ctx.lineTo(Math.round(x) + 0.5, BAR_HEIGHT + BEAT_HEIGHT);
                ctx.stroke();
            } else if (isBeat) {
                ctx.strokeStyle = "rgba(255,255,255,0.07)";
                ctx.beginPath();
                ctx.moveTo(Math.round(x) + 0.5, BAR_HEIGHT);
                ctx.lineTo(Math.round(x) + 0.5, BAR_HEIGHT + BEAT_HEIGHT);
                ctx.stroke();
            } else {
                ctx.strokeStyle = "rgba(255,255,255,0.04)";
                ctx.beginPath();
                ctx.moveTo(Math.round(x) + 0.5, BAR_HEIGHT + 4);
                ctx.lineTo(Math.round(x) + 0.5, BAR_HEIGHT + BEAT_HEIGHT);
                ctx.stroke();
            }
        }

        // ── Bar number labels ────────────────────────────────────────────
        const firstBar = Math.floor(startBeat / 4);
        const lastBar  = Math.ceil(endBeat / 4);
        ctx.fillStyle = "rgba(255,255,255,0.78)";
        ctx.font = "600 10px ui-sans-serif, system-ui, -apple-system";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        for (let bar = firstBar; bar <= lastBar; bar++) {
            if (bar < 1) continue;
            if (bar % barStep !== 0) continue;
            const beat = (bar - 1) * 4;
            const x = beat * ppb - scrollX;
            if (x < 0 || x > cssW) continue;
            ctx.fillText(String(bar), Math.round(x) + 4, 3);
        }

        // ── Loop / cycle region ──────────────────────────────────────────
        if (cycleEnabled) {
            const x1 = locatorLeft  * ppb - scrollX;
            const x2 = locatorRight * ppb - scrollX;
            const w  = x2 - x1;
            if (x2 >= 0 && x1 <= cssW) {
                const ly = BAR_HEIGHT + BEAT_HEIGHT;
                ctx.fillStyle = "rgba(234,179,8,0.85)";
                ctx.fillRect(x1, ly, w, LOOP_HEIGHT);

                const grad = ctx.createLinearGradient(0, ly, 0, ly + LOOP_HEIGHT);
                grad.addColorStop(0, "rgba(255,255,255,0.18)");
                grad.addColorStop(1, "rgba(0,0,0,0.18)");
                ctx.fillStyle = grad;
                ctx.fillRect(x1, ly, w, LOOP_HEIGHT);

                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.fillRect(x1, ly, 1, LOOP_HEIGHT);
                ctx.fillRect(x2 - 1, ly, 1, LOOP_HEIGHT);

                ctx.fillStyle = "rgba(255,255,255,0.4)";
                ctx.fillRect(x1 + 1, ly + (LOOP_HEIGHT / 2) - 3, 1, 6);
                ctx.fillRect(x2 - 2, ly + (LOOP_HEIGHT / 2) - 3, 1, 6);
            }
        }
    }, [cycleEnabled, locatorLeft, locatorRight, ppb, scrollX, size.width]);

    // Keep the redraw callback in sync
    useEffect(() => {
        redrawRef.current = buildStaticLayer;
    }, [buildStaticLayer]);

    // ── rAF loop to repaint the playhead smoothly while playing ─────────────
    useEffect(() => {
        const tick = () => {
            const cvs = playheadLayerRef.current;
            if (cvs) {
                const ctx = cvs.getContext("2d");
                if (ctx) {
                    const dpr = window.devicePixelRatio || 1;
                    const cssW = cvs.width / dpr;
                    const cssH = cvs.height / dpr;
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, cvs.width, cvs.height);
                    ctx.scale(dpr, dpr);

                    const ppb = viewportRef.current.pixelsPerBeat;
                    const scrollX = viewportRef.current.scrollLeft;
                    const x = playheadRef.current * ppb - scrollX;
                    if (x >= -2 && x <= cssW + 2) {
                        // Red triangle at the top
                        ctx.fillStyle = "#ef4444";
                        ctx.beginPath();
                        ctx.moveTo(x - 5, 0);
                        ctx.lineTo(x + 5, 0);
                        ctx.lineTo(x, 8);
                        ctx.closePath();
                        ctx.fill();

                        // Vertical playhead line through all three layers
                        ctx.fillStyle = "rgba(239,68,68,0.7)";
                        ctx.fillRect(Math.round(x), 0, 1, cssH);
                    }
                }
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };
        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
        };
    }, []);

    // ── Resize both canvas layers when size changes ─────────────────────────
    useEffect(() => {
        const dpr = window.devicePixelRatio || 1;
        for (const cvs of [staticLayerRef.current, playheadLayerRef.current]) {
            if (!cvs) continue;
            cvs.width  = Math.max(1, Math.floor(size.width * dpr));
            cvs.height = Math.max(1, Math.floor(size.height * dpr));
            cvs.style.width  = `${size.width}px`;
            cvs.style.height = `${size.height}px`;
        }
        requestRedraw();
    }, [size.width, size.height, requestRedraw]);

    // ── Rebuild the static layer when state that affects it changes ─────────
    useEffect(() => {
        buildStaticLayer();
    }, [buildStaticLayer]);

    // ── Pointer interactions ────────────────────────────────────────────────
    const dragRef = useRef<null | {
        kind: "playhead" | "create-loop" | "move-loop" | "resize-left" | "resize-right";
        startX: number;          // screen px of initial mousedown
        startBeat: number;       // beat at initial mousedown
        originalLeft: number;
        originalRight: number;
        shift: boolean;
    }>(null);

    const getLoopHandleAtBeat = useCallback((beat: number) => {
        if (!cycleEnabled) return null;
        const ppb = viewportRef.current.pixelsPerBeat;
        if (Math.abs(beat - locatorLeft) * ppb <= HANDLE_WIDTH) return "resize-left";
        if (Math.abs(beat - locatorRight) * ppb <= HANDLE_WIDTH) return "resize-right";
        if (beat > locatorLeft && beat < locatorRight) return "move-loop";
        return null;
    }, [cycleEnabled, locatorLeft, locatorRight]);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ppb = viewportRef.current.pixelsPerBeat;
        const scrollX = viewportRef.current.scrollLeft;
        const beat = (x + scrollX) / ppb;
        e.currentTarget.setPointerCapture(e.pointerId);

        const inside = getLoopHandleAtBeat(beat);
        if (inside === "resize-left" || inside === "resize-right") {
            dragRef.current = {
                kind: inside,
                startX: x,
                startBeat: beat,
                originalLeft: locatorLeft,
                originalRight: locatorRight,
                shift: e.shiftKey
            };
        } else if (inside === "move-loop") {
            dragRef.current = {
                kind: "move-loop",
                startX: x,
                startBeat: beat,
                originalLeft: locatorLeft,
                originalRight: locatorRight,
                shift: e.shiftKey
            };
        } else {
            // Empty area: click moves the playhead; drag creates a new loop.
            movePlayhead(Math.max(0, beat));
            dragRef.current = {
                kind: "create-loop",
                startX: x,
                startBeat: beat,
                originalLeft: locatorLeft,
                originalRight: locatorRight,
                shift: e.shiftKey
            };
        }
    }, [getLoopHandleAtBeat, locatorLeft, locatorRight, movePlayhead]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ppb = viewportRef.current.pixelsPerBeat;
        const scrollX = viewportRef.current.scrollLeft;
        const beat = Math.max(0, (x + scrollX) / ppb);
        const dxBeats = (x - d.startX) / ppb;
        const noSnap = e.shiftKey || d.shift;

        if (d.kind === "create-loop") {
            // A click that wobbles by a pixel is not a drag. Without this,
            // clicking the ruler to move the playhead silently switched Cycle
            // on and looped the transport over whatever range the wobble
            // described — which plays nothing at all if the range holds no
            // notes, and looks like the app has gone silent.
            if (Math.abs(x - d.startX) < DRAG_THRESHOLD_PX) return;
            const lo = Math.min(d.startBeat, beat);
            const hi = Math.max(d.startBeat, beat);
            setLocators(lo, hi);
            setLoopEnabled(true);
        } else if (d.kind === "move-loop") {
            const w = d.originalRight - d.originalLeft;
            let newLeft = d.originalLeft + dxBeats;
            if (!noSnap) newLeft = snap(newLeft, 0.25);
            newLeft = Math.max(0, newLeft);
            setLocators(newLeft, newLeft + w);
            setLoopEnabled(true);
        } else if (d.kind === "resize-left") {
            let newLeft = d.originalLeft + dxBeats;
            if (!noSnap) newLeft = snap(newLeft, 0.25);
            newLeft = Math.max(0, Math.min(newLeft, d.originalRight - MIN_LOOP_BEATS));
            setLocators(newLeft, d.originalRight);
        } else if (d.kind === "resize-right") {
            let newRight = d.originalRight + dxBeats;
            if (!noSnap) newRight = snap(newRight, 0.25);
            newRight = Math.max(d.originalLeft + MIN_LOOP_BEATS, newRight);
            setLocators(d.originalLeft, newRight);
        }
    }, [setLocators, setLoopEnabled]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        // Only a drag that actually created a loop gets normalised to a usable
        // length. A plain click leaves the cycle exactly as the user left it.
        const dragged = Math.abs((e.clientX - e.currentTarget.getBoundingClientRect().left) - d.startX) >= DRAG_THRESHOLD_PX;
        const span = locatorRight - locatorLeft;
        if (d.kind === "create-loop" && dragged && span < MIN_LOOP_BEATS) {
            setLoop(d.startBeat, d.startBeat + 4, true);
        }
        dragRef.current = null;
    }, [locatorLeft, locatorRight, setLoop]);

    const onDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        clearLoop();
    }, [clearLoop]);

    const onWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const scroller = scrollContainerRef?.current;
        if (!scroller) return;

        if (e.ctrlKey || e.metaKey) {
            const rect = e.currentTarget.getBoundingClientRect();
            const pointerX = e.clientX - rect.left;
            const oldPpb = viewportRef.current.pixelsPerBeat;
            const oldScrollLeft = scroller.scrollLeft;
            const beatAtPointer = (oldScrollLeft + pointerX) / oldPpb;
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const nextPpb = Math.max(10, Math.min(240, oldPpb * zoomFactor));

            setZoom(nextPpb);
            requestAnimationFrame(() => {
                scroller.scrollLeft = Math.max(0, beatAtPointer * nextPpb - pointerX);
            });
        } else {
            scroller.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        }
    }, [scrollContainerRef, setZoom]);

    // Cursor feedback
    const [cursor, setCursor] = useState<string>("pointer");
    const onHover = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ppb = viewportRef.current.pixelsPerBeat;
        const scrollX = viewportRef.current.scrollLeft;
        const beat = (x + scrollX) / ppb;
        const inside = getLoopHandleAtBeat(beat);
        if (inside === "resize-left" || inside === "resize-right") setCursor("ew-resize");
        else if (inside === "move-loop") setCursor("grab");
        else setCursor("pointer");
    }, [getLoopHandleAtBeat]);

    return (
        <div
            ref={containerRef}
            className="relative w-full shrink-0 border-b border-black"
            style={{ height: RULER_HEIGHT, cursor, userSelect: "none", background: "#1a1a1a" }}
            onPointerDown={onPointerDown}
            onPointerMove={(e) => { onHover(e); onPointerMove(e); }}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
        >
            {/* Static layer: bars, beats, loop region */}
            <canvas
                ref={el => { staticLayerRef.current = el; }}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
            />
            {/* Animated layer: playhead, driven by rAF */}
            <canvas
                ref={el => { playheadLayerRef.current = el; }}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 2 }}
            />
        </div>
    );
}

export default TimelineRuler;
