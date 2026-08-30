"use client"
import React, { useState, useRef, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { useProjectStore } from "@/store/projectStore"
import {
    beatsPerBar,
    beatsToSecondsWithTempoMap,
    clampTempo,
    formatClock,
    formatPosition,
    formatTimecode,
    frameRateLabel,
    scrubBeats,
    DIVISIONS_PER_BEAT,
} from "@/lib/transportPosition"
import {
    Play, Square, RotateCcw,
    SkipBack, SkipForward, Circle,
    Repeat, Volume2, Search,
    Layout, Sidebar, Settings,
    List, Music, FileText,
    Activity,
    ChevronDown, Power, Grid,
    Type, Flag, Clock, LucideIcon, Keyboard, Sun, Pencil
} from "lucide-react"
import { ControlBarCustomizer } from "./ControlBarCustomizer"
import { MasterVolume, OutputMeter } from "./MasterOutput"
import { GiantDisplay } from "./GiantDisplay"
import { MIDIActivity } from "./MIDIActivity"
import { LcdActivity } from "./LcdActivity"
import { LCD_DISPLAY_MODES } from "@/lib/lcdDisplayModes"
import { MagicMenu } from "./MagicMenu"

/** Time signatures the display offers. Matches what `setTimeSignature` accepts. */
const TIME_SIGNATURES = [
    '4/4', '3/4', '2/4', '5/4', '6/4',
    '2/2', '3/8', '6/8', '7/8', '9/8', '12/8',
];

const KEY_SIGNATURES = [
    'C maj', 'G maj', 'D maj', 'A maj', 'E maj', 'B maj', 'F# maj', 'F maj',
    'Bb maj', 'Eb maj', 'Ab maj', 'Db maj',
    'A min', 'E min', 'B min', 'F# min', 'C# min', 'G# min', 'D min',
    'G min', 'C min', 'F min', 'Bb min', 'Eb min',
];

/**
 * A clickable LCD field with a value picker.
 *
 * Portalled to <body> like the display-mode menu: as a child of the transport
 * bar it would be painted under the toolbar and the timeline, because an
 * ancestor establishes a stacking context and no z-index can escape one.
 *
 * `stopPropagation` on the trigger matters — the whole LCD is itself a click
 * target that opens the display-mode menu, so without it choosing a signature
 * would also open that.
 */
function LcdField({ label, value, options, onSelect }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (v: string) => void;
}) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
    const ref = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (!open) { setPos(null); return }
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        const width = 120
        setPos({
            top: r.bottom + 6,
            left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left + r.width / 2 - width / 2)),
        })
    }, [open])

    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Element | null
            if (t?.closest?.('[data-lcd-field]')) return
            if (!ref.current?.contains(t as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div
            ref={ref}
            data-lcd-cell={label.toLowerCase()}
            className="flex min-w-0 flex-col items-center text-center"
            onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        >
            {/* `tracking-widest` on 8px text was half the collision. */}
            <span data-lcd-label className="text-[8px] font-black text-studio-text-dim uppercase tracking-[0.06em] leading-none mb-1">{label}</span>
            <button
                data-lcd-value={label.toLowerCase()}
                title={`Change ${label.toLowerCase()}`}
                className={`text-[13px] font-black tabular-nums px-1 rounded transition-colors whitespace-nowrap ${open ? 'text-accent-cyan' : 'text-studio-text hover:text-accent-cyan'}`}
            >
                {value}
            </button>

            {open && pos && typeof document !== 'undefined' && createPortal(
                <div
                    data-lcd-field
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width: 120 }}
                    className="max-h-[300px] overflow-y-auto custom-scrollbar-v bg-studio-panel border border-studio-line-strong shadow-2xl rounded p-1 flex flex-col z-[9000] animate-in fade-in slide-in-from-top-1 duration-100"
                >
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => { onSelect(opt); setOpen(false) }}
                            className={`px-2 py-1 text-left text-[11px] font-bold rounded transition-colors ${
                                opt === value
                                    ? 'bg-accent-cyan text-[#04070b]'
                                    : 'text-studio-text hover:bg-accent-cyan/20'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}

export function TransportBar() {
    const [editingTempo, setEditingTempo] = useState(false);
    const [tempoInput, setTempoInput] = useState('');
    const {
        playing, play, stop, tempo, playhead, setTempo, movePlayhead,
        showLibrary, toggleLibrary,
        showInspector, toggleInspector,
        showToolbar, toggleToolbar,
        showGlobalTracks, toggleGlobalTracks,
        // The clock integrates the tempo track rather than dividing by the
        // single top-level tempo, so a project with a tempo change reads right.
        globalTracks,
        metronomeEnabled, toggleMetronome,
        countInEnabled, toggleCountIn, countInBars,
        showMixer, toggleMixer,
        showSmartControls, toggleSmartControls,
        showEditors, toggleEditors,
        // Which of the three the bottom panel is actually showing. All three
        // toggles set it, so without it every one of them can look active
        // while only one is on screen.
        bottomPanel,
        showNotePad, toggleNotePad,
        showLoopBrowser, toggleLoopBrowser,
        showBrowsers, toggleBrowsers,
        controlBarSettings, updateControlBar, toggleFloatingWindow,
        cycleEnabled, toggleCycle, autoSetLocators, setAutoSetLocators,
        skipCycleEnabled, toggleSkipCycle,
        locatorLeft, locatorRight, settings, updateProjectSettings,
        recording, toggleRecording, recordRepeat, discardAndReturn, flashback, toggleFlashback, flashbackCapture, replaceMode, toggleReplaceMode,
        autopunchEnabled, toggleAutopunch,
        showVirtualKeyboard, toggleVirtualKeyboard,
        timeSignature, setTimeSignature,
        keySignature, setKeySignature,
    } = useProjectStore()

    /** The M button's dropdown, which carries every menu the app has. */
    const [magicMenuOpen, setMagicMenuOpen] = useState(false)
    const [magicAnchor, setMagicAnchor] = useState<{ left: number; bottom: number } | null>(null)
    const magicButtonRef = useRef<HTMLButtonElement>(null)

    /**
     * Return the playhead to bar 1, stopping first if the transport is rolling.
     *
     * This was wired straight to `stop`, which leaves the playhead where it is
     * — so the button labelled "go to beginning" only stopped, and the next
     * play resumed from the middle of the project. `movePlayhead` stops for us
     * when playing, so one press both stops and rewinds.
     */
    const goToBeginning = () => movePlayhead(0)

    const [showCustomizer, setShowCustomizer] = useState(false)
    const [showLCDMenu, setShowLCDMenu] = useState(false)
    const lcdRef = useRef<HTMLDivElement>(null)
    const [lcdMenuPos, setLcdMenuPos] = useState<{ top: number; left: number } | null>(null)

    /*
     * The menu is portalled to <body>.
     *
     * As a child of the transport bar it was painted *under* the toolbar and
     * the timeline clips at every point along its height, however high its
     * z-index: an ancestor establishes a stacking context, and z-index only
     * orders siblings within one. Fixed positioning off the LCD's rect is the
     * only reliable escape.
     */
    useLayoutEffect(() => {
        if (!showLCDMenu) { setLcdMenuPos(null); return }
        const r = lcdRef.current?.getBoundingClientRect()
        if (!r) return
        const width = 220
        setLcdMenuPos({
            top: r.bottom,
            left: Math.max(8, Math.min(window.innerWidth - width - 8, r.left + r.width / 2 - width / 2)),
        })
    }, [showLCDMenu])

    // A click-to-open menu needs its own dismissal; hover used to do this.
    useEffect(() => {
        if (!showLCDMenu) return
        const onDown = (e: MouseEvent) => {
            const t = e.target as Element | null
            // The menu lives in a portal, so containment in the LCD is not enough.
            if (t?.closest?.('[data-lcd-menu]')) return
            if (!lcdRef.current?.contains(t as Node)) setShowLCDMenu(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLCDMenu(false) }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [showLCDMenu])
    const [scrubbing, setScrubbing] = useState(false)
    const [showCycleMenu, setShowCycleMenu] = useState(false)
    const [showMetronomeMenu, setShowMetronomeMenu] = useState(false)
    const [showCountInMenu, setShowCountInMenu] = useState(false)

    const setMetronomeSetting = useProjectStore(s => s.setMetronomeSetting);
    const setCountInBars = useProjectStore(s => s.setCountInBars);

    /*
     * Position, from the shared module.
     *
     * This used to be a local `formatTime` that computed the bar as
     * `Math.floor(beats / 4) + 1` — four beats to the bar, whatever the
     * project's time signature. The signature is chosen *in this very
     * display*, so setting 3/4 left the number beside that control
     * disagreeing with the ruler, the piano roll and the metronome.
     *
     * The clock was equally hopeful: it divided by the single top-level
     * `tempo` while playback reads `globalTracks.tempo`, so a project with a
     * tempo change showed a time that drifted from what you heard.
     */
    const barsPerSig = beatsPerBar(timeSignature);
    const playheadSeconds = beatsToSecondsWithTempoMap(playhead, globalTracks?.tempo);

    const { bar, beat, div, tick } = formatPosition(playhead, { beatsPerBar: barsPerSig });
    const { mins, secs, ms } = formatClock(playheadSeconds);
    const timecode = formatTimecode(playheadSeconds, settings?.frameRate ?? 25);

    const posLeft = formatPosition(locatorLeft, { beatsPerBar: barsPerSig });
    const posRight = formatPosition(locatorRight, { beatsPerBar: barsPerSig });
    const posEnd = formatPosition(settings.projectEnd, { beatsPerBar: barsPerSig });

    const renderFormattedPos = (f: any) => `${f.bar} ${f.beat} ${f.div} ${f.tick}`;

    const onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowCustomizer(true);
    };

    /*
     * Quick Help has no implementation anywhere — its handler is `() => { }`
     * and its `active` is the literal `false`. It sits in the same cluster as
     * three buttons that do work, so it is dimmed and says why rather than
     * being the one that silently does nothing.
     */
    const UNAVAILABLE_VIEW_BUTTONS: Record<string, string | undefined> = {
        quickHelp: 'Quick Help is not built yet',
    };

    const VIEW_BUTTON_LABELS: Record<string, string> = {
        library: 'Library', inspector: 'Inspector', quickHelp: 'Quick Help',
        toolbar: 'Toolbar', smartControls: 'Smart Controls', mixer: 'Mixer',
        editors: 'Editors', musicalTyping: 'Musical Typing',
    };

    const renderViewButton = (id: keyof typeof controlBarSettings.viewButtons, icon: LucideIcon, action: () => void, active: boolean) => {
        if (!controlBarSettings.viewButtons[id]) return null;
        const label = VIEW_BUTTON_LABELS[id] ?? id;
        // A button with no action is dimmed and says why, rather than looking
        // pressable and doing nothing when pressed.
        const unavailable = UNAVAILABLE_VIEW_BUTTONS[id];
        return (
            <button
                key={id}
                data-view-button={id}
                disabled={!!unavailable}
                title={unavailable ?? label}
                aria-label={label}
                aria-pressed={active}
                onClick={action}
                className={`p-1.5 rounded-sm border border-black/40 shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all transform ${unavailable ? 'opacity-35 cursor-default text-studio-text-dim' : 'active:scale-95'} ${active ? 'bg-accent-cyan/30 text-accent-cyan border-accent-cyan/40 shadow-inner' : 'bg-gradient-to-b from-white/10 to-transparent text-studio-text-mid' } ${unavailable || active ? '' : 'hover:text-white'}`}
            >
                {React.createElement(icon, { className: "w-[18px] h-[18px]" })}
            </button>
        );
    };

    const TRANSPORT_LABELS: Record<string, string> = {
        goBeginning: 'Go to Beginning',
        rewind: 'Rewind One Bar',
        forward: 'Forward One Bar',
        stop: 'Stop',
        play: 'Play',
        pause: 'Pause',
        record: 'Record',
    };

    const renderTransportButton = (id: keyof typeof controlBarSettings.transportButtons, icon: LucideIcon, action?: () => void, active?: boolean, colorClass?: string) => {
        if (!controlBarSettings.transportButtons[id]) return null;
        return (
            <button
                key={id}
                onClick={action}
                title={TRANSPORT_LABELS[id] ?? id}
                aria-label={TRANSPORT_LABELS[id] ?? id}
                className={`p-1.5 transition-all transform active:scale-90 ${active ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,165,233,0.8)]' : colorClass || 'text-studio-text-dim hover:text-white'}`}
            >
                {React.createElement(icon, { className: `w-[18px] h-[18px] ${active ? 'fill-accent-cyan' : 'fill-current'}` })}
            </button>
        );
    };

    /*
     * Dragging inside the LCD.
     *
     * Both of these live inside the div whose onClick opens the display-mode
     * menu, so both must stop propagation — `LcdField` already guards against
     * exactly this and says so in a comment; the tempo was missed, which is
     * why clicking it opened the editor *and* the menu at the same time.
     *
     * Listeners go on the window, not the element: the LCD is 36px tall and
     * the pointer leaves it almost immediately during a drag.
     */
    const DRAG_THRESHOLD_PX = 3;

    const beginScrub = (e: React.MouseEvent) => {
        // `preventDefault` only — stopping propagation here would keep the
        // mousedown from reaching the document listener that dismisses the
        // display menu, leaving it stuck open.
        e.preventDefault();
        const startX = e.clientX;
        const startBeats = playhead;
        let moved = false;

        const onMove = (me: MouseEvent) => {
            const dx = me.clientX - startX;
            if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
            moved = true;
            setScrubbing(true);
            // `movePlayhead` stops the transport when playing, the same as
            // dragging the ruler does. Consistent, and deliberate.
            movePlayhead(scrubBeats(startBeats, dx, {
                fine: me.shiftKey,
                snapBars: me.altKey,
                beatsPerBar: barsPerSig,
            }));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setScrubbing(false);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const beginTempoDrag = (e: React.MouseEvent) => {
        const startY = e.clientY;
        const startTempo = tempo;
        let moved = false;

        const onMove = (me: MouseEvent) => {
            const dy = startY - me.clientY;
            if (!moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
            moved = true;
            setScrubbing(true);
            setTempo(clampTempo(startTempo + dy / (me.shiftKey ? 12 : 3), startTempo));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setScrubbing(false);
            // No movement means it was a click: open the editor, as before.
            if (!moved) { setTempoInput(String(useProjectStore.getState().tempo)); setEditingTempo(true); }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /** Position readouts are draggable; wraps whichever one is showing. */
    const scrubbable = (node: React.ReactNode) => (
        <div
            data-lcd-scrub
            role="slider"
            aria-label="Playhead position"
            aria-valuenow={Math.round(playhead * 100) / 100}
            tabIndex={0}
            title="Drag to scrub. Shift for fine, Alt to snap to bars."
            onMouseDown={beginScrub}
            // The readout is a control in its own right now, so a click on it
            // must not also fall through to the display-mode menu.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                const step = e.shiftKey ? barsPerSig : 1;
                if (e.key === 'ArrowRight') { e.preventDefault(); movePlayhead(playhead + step); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); movePlayhead(Math.max(0, playhead - step)); }
            }}
            className={`cursor-ew-resize select-none rounded outline-none transition-colors ${scrubbing ? 'bg-accent-cyan/10' : 'hover:bg-white/[0.04]'} focus-visible:ring-1 focus-visible:ring-accent-cyan`}
        >
            {node}
        </div>
    );

    // LCD Renderers
    const renderBeatsPos = (small = false) => (
        <div data-lcd-field="position" className={`flex flex-col items-center ${small ? 'min-w-[50px]' : 'min-w-[80px]'}`}>
            {!small && <span className="text-[8px] font-black text-accent-cyan/40 uppercase tracking-widest leading-none mb-1">Position</span>}
            <div className={`flex gap-2 items-baseline text-accent-cyan/90 font-mono tracking-tighter tabular-nums drop-shadow-[0_0_3px_rgba(14,165,233,0.3)] ${small ? 'gap-1 scale-90' : ''}`}>
                <span data-lcd-value="bar" className={`${small ? 'text-[14px]' : 'text-[18px]'} font-black`}>{bar}</span>
                <span data-lcd-value="beat" className={`${small ? 'text-[12px]' : 'text-[15px]'} font-black`}>{beat}</span>
                <span data-lcd-value="div" className={`${small ? 'text-[10px]' : 'text-[13px]'} font-black`}>{div}</span>
                <span data-lcd-value="tick" className={`${small ? 'text-[9px]' : 'text-[11px]'} font-black opacity-60`}>{tick}</span>
            </div>
        </div>
    );

    const renderTimePos = (small = false) => (
        <div data-lcd-field="time" className={`flex flex-col items-center ${small ? 'min-w-[60px]' : 'min-w-[100px]'}`}>
            {!small && <span className="text-[8px] font-black text-accent-cyan/40 uppercase tracking-widest leading-none mb-1">Time</span>}
            <div className={`flex gap-1 items-baseline text-accent-cyan/90 font-mono tracking-tighter tabular-nums drop-shadow-[0_0_3px_rgba(14,165,233,0.3)] ${small ? 'scale-90' : ''}`}>
                <span data-lcd-value="mins" className={`${small ? 'text-[14px]' : 'text-[20px]'} font-black`}>{mins}</span>
                <span className="text-[12px] opacity-40">:</span>
                <span data-lcd-value="secs" className={`${small ? 'text-[14px]' : 'text-[20px]'} font-black`}>{secs}</span>
                <span className="text-[12px] opacity-40">.</span>
                <span className={`${small ? 'text-[11px]' : 'text-[13px]'} font-black opacity-60`}>{ms}</span>
            </div>
        </div>
    );

    /**
     * Timecode.
     *
     * `settings.frameRate` has been stored and set in Project Settings for a
     * long time and no display read it. The rate is snapped to one the MTC
     * machinery supports before use — the field is a free numeric input, so a
     * project can hold 60, and `MTC_FRAME_RATES[60]` is undefined.
     */
    const renderTimecode = () => (
        <div data-lcd-field="timecode" className="flex flex-col items-center min-w-[130px]">
            <span
                data-lcd-label
                title={`Frame rate from Project Settings: ${frameRateLabel(settings?.frameRate ?? 25)}`}
                className="text-[8px] font-black text-accent-cyan/40 uppercase tracking-[0.06em] leading-none mb-1"
            >
                {frameRateLabel(settings?.frameRate ?? 25)}
            </span>
            <div className="flex items-baseline text-accent-cyan/90 font-mono tracking-tighter tabular-nums drop-shadow-[0_0_3px_rgba(14,165,233,0.3)]">
                <span data-lcd-value="timecode" className="text-[18px] font-black whitespace-nowrap">{timecode}</span>
            </div>
        </div>
    );

    const renderTempoValue = (className: string) => {
        if (editingTempo) {
            return (
                <input
                    autoFocus
                    className={`${className} bg-transparent outline-none border-b border-accent-cyan w-14 text-center`}
                    type="number"
                    min={20}
                    max={300}
                    step={1}
                    value={tempoInput}
                    onChange={(e) => setTempoInput(e.target.value)}
                    onBlur={() => {
                        const v = parseInt(tempoInput);
                        if (!isNaN(v) && v >= 1) setTempo(v);
                        setEditingTempo(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            const v = parseInt(tempoInput);
                            if (!isNaN(v) && v >= 1) setTempo(v);
                            setEditingTempo(false);
                        }
                        if (e.key === 'Escape') setEditingTempo(false);
                    }}
                />
            );
        }
        return (
            <span
                data-lcd-tempo
                title="Click to type, drag to set the tempo at the playhead"
                className={className + ' cursor-ns-resize select-none hover:text-accent-cyan'}
                onMouseDown={beginTempoDrag}
                onClick={(e) => e.stopPropagation()}
            >
                {tempo}
            </span>
        );
    };

    const renderProjectInfo = () => (
        /*
            A grid, not `justify-around`.
            The LCD is `flex-1` between three `shrink-0` groups, so at 1600px it
            gets far less than its 580px ceiling — and `justify-around`
            distributes slack it does not have. The labels ran together
            ("TEMPOSIGNATURE KEY") and the key wrapped onto a second line.
        */
        <div data-lcd-project className="flex-1 grid grid-cols-3 gap-x-3 px-2 border-l border-white/5 ml-2">
            <div data-lcd-cell="tempo" className="flex min-w-0 flex-col items-center text-center">
                <span data-lcd-label className="text-[8px] font-black text-studio-text-dim uppercase tracking-[0.06em] leading-none mb-1">Tempo</span>
                {renderTempoValue('text-[13px] font-black text-studio-text tabular-nums')}
            </div>
            {/*
              * Signature and key read the project. Both were hard-coded — the
              * display showed 4/4 and C maj whatever the project actually was,
              * so changing either elsewhere left the control bar contradicting
              * the ruler.
              */}
            <LcdField
                label="Sig"
                value={timeSignature}
                options={TIME_SIGNATURES}
                onSelect={setTimeSignature}
            />
            <LcdField
                label="Key"
                value={keySignature}
                options={KEY_SIGNATURES}
                onSelect={setKeySignature}
            />
        </div>
    );

    const renderLCDContent = () => {
        const mode = controlBarSettings.displayMode;
        switch (mode) {
            case 'Beats': return scrubbable(renderBeatsPos());
            case 'Time': return scrubbable(renderTimePos());
            case 'Timecode': return scrubbable(renderTimecode());
            case 'Beats & Time': return (
                <div className="flex-1 flex items-center justify-center gap-10">
                    {scrubbable(renderBeatsPos())}
                    <div className="w-px h-5 bg-white/5"></div>
                    {scrubbable(renderTimePos())}
                </div>
            );
            case 'Beats & Project': return (
                <div className="flex-1 flex items-center justify-between">
                    {scrubbable(renderBeatsPos())}
                    {renderProjectInfo()}
                </div>
            );
            case 'Custom': return (
                <div className="flex-1 flex items-center h-full gap-3 px-1">
                    {/* Position Area */}
                    <div className="flex flex-col border-r border-white/5 pr-3">
                        <div className="flex gap-4">
                            {renderBeatsPos(true)}
                            {renderTimePos(true)}
                        </div>
                    </div>

                    {/* Locators Area */}
                    <div className="flex flex-col min-w-[90px] border-r border-white/5 pr-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[7px] text-studio-text-dim font-bold uppercase tracking-tighter">Left</span>
                            <span className={`text-[10px] font-mono tracking-tighter ${cycleEnabled || skipCycleEnabled ? 'text-yellow-500' : 'text-studio-text-mid'}`}>{renderFormattedPos(posLeft)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[7px] text-studio-text-dim font-bold uppercase tracking-tighter">Right</span>
                            <span className={`text-[10px] font-mono tracking-tighter ${cycleEnabled || skipCycleEnabled ? 'text-yellow-500' : 'text-studio-text-mid'}`}>{renderFormattedPos(posRight)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[7px] text-studio-text-mid font-bold uppercase tracking-tighter">End</span>
                            <span className="text-[10px] text-accent-cyan/80 font-mono tracking-tighter">{renderFormattedPos(posEnd)}</span>
                        </div>
                    </div>

                    {/* Project Detail Area */}
                    <div className="flex-1 flex justify-around">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Temp</span>
                                {renderTempoValue('text-[11px] text-studio-text font-black')}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Key</span>
                                {/* Was the literal "C Major", contradicting the
                                    Key field two modes over. */}
                                <span className="text-[10px] text-studio-text-mid truncate w-14 uppercase whitespace-nowrap">{keySignature}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Sgn</span>
                                {/* Was the literal "4/4". */}
                                <span className="text-[11px] text-studio-text font-black whitespace-nowrap">{timeSignature}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Div</span>
                                {/* Derived from the module's constant rather than asserted. */}
                                <span className="text-[10px] text-studio-text-mid">/{DIVISIONS_PER_BEAT * 4}</span>
                            </div>
                        </div>
                    </div>

                    {/* MIDI & Performance Area */}
                    <div className="flex items-center h-full pl-2">
                        <MIDIActivity customStyle={true} />
                    </div>
                </div>
            );
            default: return renderBeatsPos();
        }
    };

    return (
        <div
            /*
             * `overflow-x-auto` with `justify-start` below the width where
             * everything fits: this row holds more controls than a phone is
             * wide, and it used to simply clip — the tempo display and the
             * right-hand group ran off the edge with no way to reach them.
             * Scrolling keeps every control reachable instead of hiding some.
             *
             * `daw-scrollbar-thin` keeps the scrollbar from stealing height
             * from a 52px row.
             */
            className="h-[62px] bg-gradient-to-b from-studio-control to-studio-raised border-b border-black flex items-center px-4 gap-4 justify-start xl:justify-between overflow-x-auto overflow-y-hidden daw-scrollbar-thin shrink-0 z-[100] shadow-[0_4px_10px_rgba(0,0,0,0.5)] select-none"
            onContextMenu={onContextMenu}
        >

            {/*
                1. View Toggles, behind the wordmark.

                At rest the corner reads MAGIC PRO. The M is a button in its
                own right and stays put; the letters beside it fade under the
                cursor and the toggles fade in. Those two layers sit in the same
                box — the toggles hold the width in normal flow and the letters
                are laid over them — so nothing beside this shifts when the swap
                happens.

                The keyboard clause matters as much as the hover one: the
                buttons stay in the tab order while transparent, and without it
                a keyboard user would be focusing controls they cannot see. It
                is `:focus-visible`, not `:focus-within` — a click leaves the
                button focused, and with `focus-within` the row stayed revealed
                after every press, with the cursor nowhere near it.
            */}
            {controlBarSettings.showViews && (
                <div data-view-toggles-shell className="group relative flex items-center shrink-0">
                {/*
                    The M is a button, not part of the wordmark.

                    It never fades and is always clickable — the cursor arriving
                    swaps the letters beside it for the toggles, and leaves this
                    one where it is. Same chrome as the toggles, so it reads as
                    the first of them rather than as a letter that happens to be
                    pressable.
                */}
                <div className="relative shrink-0">
                    <button
                        data-magic-button
                        ref={magicButtonRef}
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = magicButtonRef.current?.getBoundingClientRect();
                            if (rect) setMagicAnchor({ left: rect.left, bottom: rect.bottom });
                            setMagicMenuOpen(v => !v);
                        }}
                        title="Magic Pro — every menu"
                        aria-label="Magic Pro menu"
                        aria-expanded={magicMenuOpen}
                        /*
                            Boxless at rest, so it is the M of MAGIC PRO rather
                            than a button sitting next to one. The chrome fades
                            in with the toggles, where it belongs to that row.
                            Padding and border width never change — only their
                            colour — so the letters beside it do not move when
                            the box appears.
                        */
                        className={`px-1.5 py-1 rounded-sm border transition-all transform active:scale-95 ${magicMenuOpen
                            ? 'bg-accent-cyan/30 border-accent-cyan/50 text-accent-cyan'
                            : 'border-transparent bg-transparent text-studio-text group-hover:border-black/40 group-hover:bg-gradient-to-b group-hover:from-white/10 group-hover:to-transparent hover:!border-accent-cyan/50 hover:text-white'}`}
                    >
                        <span className="text-[19px] leading-none font-extralight tracking-[0.16em] drop-shadow-[0_0_10px_rgba(34,211,238,0.30)]">
                            M
                        </span>
                    </button>
                    {magicMenuOpen && <MagicMenu anchor={magicAnchor} onClose={() => setMagicMenuOpen(false)} />}
                </div>

                {/*
                    Everything that swaps: the rest of the wordmark, or the
                    toggles. Nudged left so "AGIC" meets the M at its own letter
                    spacing rather than across the button's padding.
                */}
                <div className="relative flex items-center -ml-1.5">
                <div
                    data-view-toggles
                    className="flex items-center gap-1.5 shrink-0 pl-2 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:pointer-events-auto"
                >
                    {renderViewButton('library', Sidebar, toggleLibrary, showLibrary)}
                    {renderViewButton('inspector', Layout, toggleInspector, showInspector)}
                    {renderViewButton('quickHelp', Search, () => { }, false)}
                    {renderViewButton('toolbar', Settings, toggleToolbar, showToolbar)}
                    <div className="w-px h-6 bg-black/40 mx-1"></div>
                    {/*
                        Smart Controls, Mixer, Editors — the three that share
                        the bottom panel, in that order.

                        The two on the outside were here once and were removed:
                        both were `() => { }` with `active` hard-coded false, so
                        neither could be pressed into doing anything or into
                        looking pressed. They have real store actions now, and
                        the panel each one opens is the panel it reports.

                        Active means "this is the panel you are looking at" —
                        `showMixer` alone was not enough, because pressing
                        Editors sets `bottomPanel` without clearing `showMixer`,
                        so the mixer button stayed lit over a piano roll.
                    */}
                    {renderViewButton('smartControls', Sun, toggleSmartControls,
                        showSmartControls && bottomPanel === 'smartcontrols')}
                    {renderViewButton('mixer', List, toggleMixer,
                        showMixer && bottomPanel === 'mixer')}
                    {renderViewButton('editors', Pencil, toggleEditors,
                        showEditors && bottomPanel === 'pianoroll')}
                    {renderViewButton('musicalTyping', Keyboard, toggleVirtualKeyboard, showVirtualKeyboard)}
                </div>

                {/*
                    The resting state. `pointer-events-none` so it never eats a
                    click meant for the button underneath it — the wordmark is
                    still painted at the moment the cursor arrives.
                */}
                <div
                    data-wordmark
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center gap-2 pointer-events-none select-none transition-opacity duration-200 opacity-100 group-hover:opacity-0 group-has-[:focus-visible]:opacity-0"
                >
                    <span className="text-[19px] leading-none font-extralight tracking-[0.16em] text-studio-text drop-shadow-[0_0_10px_rgba(34,211,238,0.30)]">
                        AGIC
                    </span>
                    <span className="text-[19px] leading-none font-extralight tracking-[0.16em] text-accent-cyan drop-shadow-[0_0_14px_var(--accent-cyan-glow)]">
                        PRO
                    </span>
                </div>
                </div>
                </div>
            )}

            {/* 2. Transport Center-Left (Logic Standard Layout) */}
            {controlBarSettings.showTransport && (
                <div className="flex items-center gap-2 px-6 shrink-0">
                    <div className="flex bg-black/40 rounded-sm border border-black/60 p-0.5">
                        {renderTransportButton('goBeginning', SkipBack, goToBeginning)}
                        {renderTransportButton('rewind', SkipBack, () => movePlayhead(Math.max(0, playhead - 1)))}
                        {renderTransportButton('forward', SkipForward, () => movePlayhead(playhead + 1))}
                    </div>

                    <div className="flex bg-black/40 rounded-sm border border-black/60 p-0.5 shadow-inner">
                        {renderTransportButton('stop', Square, stop)}
                        {renderTransportButton('play', Play, () => { if (!playing) play() }, playing)}
                    </div>

                    <button 
                        onClick={toggleRecording}
                        className={`p-1.5 transition-all transform active:scale-90 ${recording ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-red-600/60 hover:text-red-500'}`}
                        title="Record (R)"
                    >
                        <Circle className={`w-[19px] h-[19px] ${recording ? 'fill-red-500' : 'fill-current'}`} />
                    </button>

                    <button
                        onClick={recordRepeat}
                        className="p-1.5 border border-black/40 rounded-sm text-[11px] text-white hover:bg-white/10"
                        title="Record Repeat (Shift+R)"
                    >
                        RPT
                    </button>

                    <button
                        onClick={() => { flashbackCapture(); }}
                        className={`p-1.5 border border-black/40 rounded-sm text-[11px] ${flashback ? 'bg-cyan-500 text-black' : 'text-white hover:bg-white/10'}`}
                        title="Flashback Capture (Alt+R)"
                    >
                        FB
                    </button>

                    <button
                        onClick={discardAndReturn}
                        className="p-1.5 border border-black/40 rounded-sm text-[11px] text-white hover:bg-white/10"
                        title="Discard Live Recording (Shift+D)"
                    >
                        CLR
                    </button>

                    {/* Recording Modes Strip */}
                    <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/5">
                        {controlBarSettings.modes.replace && (
                            <button 
                                onClick={() => toggleReplaceMode()}
                                className={`h-6 px-1.5 border border-black/40 rounded-sm text-[8px] font-black transition-all ${replaceMode ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'bg-black/20 text-studio-text-dim hover:text-white'}`}
                                title="Replace Mode"
                            >
                                REPLACE
                            </button>
                        )}
                        {controlBarSettings.modes.autopunch && (
                            <button 
                                onClick={() => toggleAutopunch()}
                                className={`h-6 px-1.5 border border-black/40 rounded-sm text-[8px] font-black transition-all ${autopunchEnabled ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-black/20 text-studio-text-dim hover:text-white'}`}
                                title="Autopunch Mode"
                            >
                                PUNCH
                            </button>
                        )}
                    </div>

                    {controlBarSettings.transportButtons.skipCycle && (
                        <button
                            onClick={toggleSkipCycle}
                            className={`p-1.5 border border-black/40 rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all ${skipCycleEnabled ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]' : 'bg-black/20 text-studio-text-dim hover:text-white'}`}
                            title="Skip Cycle"
                        >
                            <SkipCycleIcon className="w-[18px] h-[18px]" />
                        </button>
                    )}

                    <div className="relative">
                        <button
                            onClick={toggleCycle}
                            onContextMenu={(e) => { e.preventDefault(); setShowCycleMenu(!showCycleMenu); }}
                            className={`p-1.5 border border-black/40 rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all relative ${cycleEnabled ? 'bg-yellow-500/30 text-yellow-500 border-yellow-500/40 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]' : 'bg-black/20 text-studio-text-dim hover:text-white'}`}
                        >
                            <Repeat className="w-[18px] h-[18px]" />
                            {autoSetLocators !== 'off' && (
                                <div className="absolute -top-1 -right-1 px-0.5 bg-yellow-500 text-black text-[7px] font-black rounded-[1px] leading-none py-0.5 border border-black/20">
                                    AUTO
                                </div>
                            )}
                        </button>

                        {showCycleMenu && (
                            <div className="absolute top-[34px] left-0 w-[200px] bg-studio-panel border border-black shadow-2xl rounded p-1 flex flex-col z-[500] animate-in fade-in slide-in-from-top-1 duration-100">
                                <span className="px-3 py-1.5 text-[8px] font-black text-studio-text-dim uppercase tracking-widest border-b border-white/5 mb-1">Auto Set Locators</span>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${autoSetLocators === 'off' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { setAutoSetLocators('off'); setShowCycleMenu(false); }}>Off</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${autoSetLocators === 'marquee' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { setAutoSetLocators('marquee'); setShowCycleMenu(false); }}>By Marquee Selection</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${autoSetLocators === 'region' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { setAutoSetLocators('region'); setShowCycleMenu(false); }}>By Region Selection</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${autoSetLocators === 'note' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { setAutoSetLocators('note'); setShowCycleMenu(false); }}>By Note Selection</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${autoSetLocators === 'marker' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { setAutoSetLocators('marker'); setShowCycleMenu(false); }}>By Marker Selection</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Logic Pro High-Fidelity LCD Display (The Brain) */}
            {controlBarSettings.showDisplay && (
                <div
                    /*
                        A floor as well as a ceiling.

                        The LCD is `flex-1` between three `shrink-0` groups, so
                        it never reaches its 580px ceiling — measured at a 1600px
                        window it was getting about 200px, leaving the
                        tempo/signature/key grid 86px wide with 15px cells. That
                        is the collision. The row is already `overflow-x-auto`
                        with a comment saying scrolling is the designed response
                        to a narrow window, so a minimum here is consistent with
                        the intent rather than a new behaviour.
                    */
                    className={`flex-1 ${controlBarSettings.displayMode === 'Custom' ? 'min-w-[600px] max-w-[720px]' : 'min-w-[430px] max-w-[580px]'} h-9 bg-black rounded shadow-[inset_0_2px_10px_rgba(0,0,0,1)] border border-white/5 flex items-center px-4 gap-6 relative overflow-visible group transition-all duration-300`}
                >
                    <div className="absolute inset-x-0 h-[1.5px] bg-accent-cyan/20 top-0 opacity-40"></div>

                    {/*
                      * LCD Main Area.
                      *
                      * Click to open, not hover. The menu was opened on
                      * mouseenter and closed on mouseleave, but it renders
                      * below the LCD with a few pixels between them — moving
                      * the pointer towards it crossed a gap belonging to
                      * neither element, so mouseleave fired and the menu
                      * vanished before it could be clicked. It was visible and
                      * unusable.
                      */}
                    {/*
                        The menu opens from the triangle, not from anywhere on
                        the LCD. A click handler over the whole panel fought
                        every control inside it: the tempo opened the editor and
                        the menu together, and once the position readout became
                        draggable it had to swallow clicks to stay usable —
                        which then blocked the document-level handler that
                        closes the menu, so it could not be dismissed either.
                    */}
                    <div
                        ref={lcdRef}
                        className="flex-1 flex items-center justify-between"
                    >

                        {renderLCDContent()}

                        {/*
                            The triangle is the control now.

                            It was a decorative div that appeared on hover with
                            no handler, while the menu opened from a click
                            anywhere on the LCD — which stopped working the
                            moment the position readout became draggable. A
                            hover-revealed arrow that opens a menu is what it
                            already looked like.
                        */}
                        <button
                            data-lcd-menu-button
                            title="Change what this display shows"
                            aria-label="Display options"
                            onClick={(e) => { e.stopPropagation(); setShowLCDMenu(v => !v); }}
                            className="absolute right-1 top-0 h-full px-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] border-t-white/40 hover:border-t-sky-500"></div>
                        </button>

                        {/* LCD Context Menu */}
                        {showLCDMenu && lcdMenuPos && typeof document !== 'undefined' && createPortal(
                            <div
                                data-lcd-menu
                                onClick={(e) => e.stopPropagation()}
                                style={{ position: 'fixed', top: lcdMenuPos.top, left: lcdMenuPos.left }}
                                className="w-[220px] bg-studio-panel border border-black shadow-2xl rounded p-1 flex flex-col z-[9000] animate-in fade-in slide-in-from-top-1 duration-100">
                                {/* One list, shared with the store's type and
                                    the customiser — see lib/lcdDisplayModes. */}
                                {LCD_DISPLAY_MODES.map(mode => (
                                    <button
                                        key={mode}
                                        data-lcd-mode={mode}
                                        className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === mode ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`}
                                        onClick={() => { updateControlBar({ displayMode: mode }); setShowLCDMenu(false) }}
                                    >{mode}</button>
                                ))}
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => toggleFloatingWindow('giantBeats')}>Open Giant Beats Display</button>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => toggleFloatingWindow('giantTime')}>Open Giant Time Display</button>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => { setShowCustomizer(true); setShowLCDMenu(false) }}>Customize Control Bar and Display...</button>
                                {/*
                                    "Project Management", "Clean Up Project..."
                                    and "Consolidate Assets..." were here as
                                    buttons with no onClick and no
                                    implementation anywhere in the store —
                                    three entries that highlighted under the
                                    cursor and did nothing when pressed.
                                */}
                            </div>,
                            document.body
                        )}
                    </div>

                    <div className="w-px h-5 bg-white/5"></div>

                    {/*
                        Was "CPU/Drive (Professional Tech Detail)": two bars
                        pinned at 20% and 45%, one of them animated so it looked
                        alive, and an icon with no handler — all of it
                        brightening on hover as though it could be pressed.
                        It now reads the scheduler's real voice and clip counts.
                    */}
                    {controlBarSettings.displayOptions?.performanceMeter !== false && (
                        <LcdActivity playing={playing} />
                    )}
                </div>
            )}

            {/* 4. Right Controls (Global Utilities) */}
            {controlBarSettings.showModes && (
                <div className="flex items-center gap-1.5 px-6 shrink-0">
                    {controlBarSettings.modes.tuner && <button className="p-1 px-2 border border-black/40 rounded-sm bg-black/20 text-[10px] text-studio-text-dim font-bold hover:text-white active:scale-95">TUNER</button>}
                    {controlBarSettings.modes.solo && <button className="p-1.5 border border-black/40 rounded-sm bg-yellow-500/20 text-yellow-500 active:scale-95 shadow-inner"><Grid className="w-4 h-4" /></button>}

                    <div className="w-px h-6 bg-black/40 mx-1"></div>

                    {controlBarSettings.modes.metronome && (
                        <div className="relative">
                            <button
                                onClick={toggleMetronome}
                                onContextMenu={(e) => { e.preventDefault(); setShowMetronomeMenu(!showMetronomeMenu); }}
                                className={`p-1.5 border rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all flex items-center justify-center 
                                    ${settings.metronome.simpleMode ? 
                                        (metronomeEnabled ? 'bg-purple-500/30 text-purple-400 border-purple-500/40' : 'bg-black/20 text-studio-text-dim border-black/40 hover:text-white') : 
                                        (settings.metronome.clickWhilePlaying ? 'bg-purple-500/30 text-purple-400 border-purple-500/40' : 
                                        (settings.metronome.clickWhileRecording ? 'bg-black/20 text-purple-400 border-purple-500/40' : 'bg-black/20 text-studio-text-dim border-black/40 hover:text-white'))}
                                `}
                            >
                                <Music className="w-[17px] h-[17px]" />
                            </button>
                            {showMetronomeMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMetronomeMenu(false)}></div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-studio-raised border border-studio-line-strong rounded shadow-2xl z-[100] py-1 text-studio-text font-sans">
                                        <button
                                            className="w-full px-3 py-1 text-left text-[12px] flex items-center justify-between hover:bg-accent-cyan hover:text-white"
                                            onClick={() => { setMetronomeSetting('simpleMode', !settings.metronome.simpleMode); setShowMetronomeMenu(false); }}
                                        >
                                            <span className="flex items-center gap-2">
                                                {settings.metronome.simpleMode ? <span className="font-bold">✓</span> : <span className="w-2" />}
                                                Simple Mode
                                            </span>
                                        </button>
                                        <div className="h-px bg-black/20 my-1 mx-2" />
                                        <div className={settings.metronome.simpleMode ? 'opacity-50 pointer-events-none' : ''}>
                                            <button
                                                className="w-full px-3 py-1 text-left text-[12px] flex items-center justify-between hover:bg-accent-cyan hover:text-white"
                                                onClick={() => { setMetronomeSetting('clickWhileRecording', !settings.metronome.clickWhileRecording); setShowMetronomeMenu(false); }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {settings.metronome.clickWhileRecording ? <span className="font-bold">✓</span> : <span className="w-2" />}
                                                    Click While Recording
                                                </span>
                                            </button>
                                            <button
                                                className={`w-full px-3 py-1 text-left text-[12px] flex items-center justify-between hover:bg-accent-cyan hover:text-white pl-8 ${!settings.metronome.clickWhileRecording ? 'opacity-50 pointer-events-none' : ''}`}
                                                onClick={() => { setMetronomeSetting('onlyDuringCountIn', !settings.metronome.onlyDuringCountIn); setShowMetronomeMenu(false); }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {settings.metronome.onlyDuringCountIn ? <span className="font-bold text-accent-cyan">✓</span> : <span className="w-2" />}
                                                    ... only During Count-In
                                                </span>
                                            </button>
                                            <button
                                                className="w-full px-3 py-1 text-left text-[12px] flex items-center justify-between hover:bg-accent-cyan hover:text-white"
                                                onClick={() => { setMetronomeSetting('clickWhilePlaying', !settings.metronome.clickWhilePlaying); setShowMetronomeMenu(false); }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {settings.metronome.clickWhilePlaying ? <span className="font-bold">✓</span> : <span className="w-2" />}
                                                    Click While Playing
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {controlBarSettings.modes.countIn && (
                        <div className="relative">
                            <button
                                onClick={toggleCountIn}
                                onContextMenu={(e) => { e.preventDefault(); setShowCountInMenu(!showCountInMenu); }}
                                className={`p-1.5 border border-black/40 rounded-sm shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all ${countInEnabled ? 'bg-accent-cyan/30 text-accent-cyan border-accent-cyan/40 text-[10px] font-black' : 'bg-black/20 text-studio-text-dim hover:text-white'}`}
                            >
                                <span className="text-[10px] font-black uppercase">1 2 3 4</span>
                            </button>
                            {showCountInMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowCountInMenu(false)}></div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 bg-studio-raised border border-studio-line-strong rounded shadow-2xl z-[100] py-1 text-studio-text font-sans">
                                        <div className="px-3 py-1 text-[10px] font-black text-studio-text-dim uppercase tracking-wider mb-1">Count-in</div>
                                        <div className="h-px bg-black/20 my-1 mx-2" />
                                        {[1, 2, 3, 4, 5, 6].map(bar => (
                                            <button
                                                key={bar}
                                                className="w-full px-3 py-1 text-left text-[12px] flex items-center justify-between hover:bg-accent-cyan hover:text-white"
                                                onClick={() => { setCountInBars(bar); setShowCountInMenu(false); }}
                                            >
                                                <span className="flex items-center gap-2">
                                                    {countInBars === bar ? <span className="font-bold">✓</span> : <span className="w-2" />}
                                                    {bar} {bar === 1 ? 'Bar' : 'Bars'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="w-px h-6 bg-black/40 mx-2"></div>

                    {/* Master Output Section */}
                    {controlBarSettings.modes.masterOutput === 'Volume' && <MasterVolume />}
                    {controlBarSettings.modes.masterOutput === 'Meter' && <OutputMeter />}

                    <div className="w-px h-6 bg-black/40 mx-2"></div>

                    {/* Right Side Browser Toggles (Logic Right Dock) */}
                    <div className="flex gap-1">
                        <button onClick={toggleGlobalTracks} className={`p-1.5 rounded-sm transition-all ${showGlobalTracks ? 'text-yellow-500' : 'text-studio-text-dim hover:text-white'}`}><Flag className="w-[17px] h-[17px]" /></button>
                        <button onClick={toggleLoopBrowser} className={`p-1.5 rounded-sm transition-all ${showLoopBrowser ? 'text-accent-cyan' : 'text-studio-text-dim hover:text-white'}`}><Music2 className="w-[17px] h-[17px]" /></button>
                        <button onClick={toggleBrowsers} className={`p-1.5 rounded-sm transition-all ${showBrowsers ? 'text-studio-text-mid' : 'text-studio-text-dim hover:text-white'}`}><FolderIcon className="w-[17px] h-[17px]" /></button>
                    </div>
                </div>
            )}

            {/* Modals & Floating Windows */}
            {showCustomizer && <ControlBarCustomizer onClose={() => setShowCustomizer(false)} />}
            {controlBarSettings.floatingWindows.giantBeats && (
                <GiantDisplay type="giantBeats" onClose={() => toggleFloatingWindow('giantBeats')} />
            )}
            {controlBarSettings.floatingWindows.giantTime && (
                <GiantDisplay type="giantTime" onClose={() => toggleFloatingWindow('giantTime')} />
            )}


        </div>
    )
}

function FolderIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
    )
}

function Music2({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="8" cy="18" r="4" /><path d="M12 18V2l7 4" />
        </svg>
    )
}

function SkipCycleIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M7 6v12M17 6v12" opacity="0.4" />
            <path d="M11 9l-3 3 3 3M13 9l3 3-3 3" />
        </svg>
    )
}
