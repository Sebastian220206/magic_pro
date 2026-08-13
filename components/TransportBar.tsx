"use client"
import React, { useState, useRef, useEffect, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { useProjectStore } from "@/store/projectStore"
import {
    Play, Square, RotateCcw,
    SkipBack, SkipForward, Circle,
    Repeat, Volume2, Search,
    Layout, Sidebar, Settings,
    List, Music, FileText,
    MonitorPlay, Activity,
    ChevronDown, Power, Grid,
    Type, Flag, Clock, LucideIcon, Keyboard
} from "lucide-react"
import { ControlBarCustomizer } from "./ControlBarCustomizer"
import { MasterVolume, OutputMeter } from "./MasterOutput"
import { GiantDisplay } from "./GiantDisplay"
import { MIDIActivity } from "./MIDIActivity"

export function TransportBar() {
    const [editingTempo, setEditingTempo] = useState(false);
    const [tempoInput, setTempoInput] = useState('');
    const {
        playing, play, stop, tempo, playhead, setTempo,
        showLibrary, toggleLibrary,
        showInspector, toggleInspector,
        showToolbar, toggleToolbar,
        showGlobalTracks, toggleGlobalTracks,
        metronomeEnabled, toggleMetronome,
        countInEnabled, toggleCountIn, countInBars,
        showMixer, toggleMixer,
        showNotePad, toggleNotePad,
        showLoopBrowser, toggleLoopBrowser,
        showBrowsers, toggleBrowsers,
        controlBarSettings, updateControlBar, toggleFloatingWindow,
        cycleEnabled, toggleCycle, autoSetLocators, setAutoSetLocators,
        skipCycleEnabled, toggleSkipCycle,
        locatorLeft, locatorRight, settings, updateProjectSettings,
        recording, toggleRecording, recordRepeat, discardAndReturn, flashback, toggleFlashback, flashbackCapture, replaceMode, toggleReplaceMode,
        autopunchEnabled, toggleAutopunch,
        showVirtualKeyboard, toggleVirtualKeyboard
    } = useProjectStore()

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
    const [showCycleMenu, setShowCycleMenu] = useState(false)
    const [showMetronomeMenu, setShowMetronomeMenu] = useState(false)
    const [showCountInMenu, setShowCountInMenu] = useState(false)

    const setMetronomeSetting = useProjectStore(s => s.setMetronomeSetting);
    const setCountInBars = useProjectStore(s => s.setCountInBars);

    const formatTime = (beats: number) => {
        const bar = Math.floor(beats / 4) + 1;
        const beat = Math.floor(beats % 4) + 1;
        const div = Math.floor((beats % 1) * 4) + 1;
        const tick = Math.floor((((beats % 1) * 4) % 1) * 240);

        // Absolute time calculation
        const totalSeconds = (beats / tempo) * 60;
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);

        return {
            bar: bar.toString(),
            beat: beat.toString(),
            div: div.toString(),
            tick: tick.toString().padStart(3, '0'),
            mins: mins.toString().padStart(2, '0'),
            secs: secs.toString().padStart(2, '0'),
            ms: ms.toString().padStart(3, '0')
        };
    };

    const { bar, beat, div, tick, mins, secs, ms } = formatTime(playhead);
    const posLeft = formatTime(locatorLeft);
    const posRight = formatTime(locatorRight);
    const posEnd = formatTime(settings.projectEnd);

    const renderFormattedPos = (f: any) => `${f.bar} ${f.beat} ${f.div} ${f.tick}`;

    const onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowCustomizer(true);
    };

    const renderViewButton = (id: keyof typeof controlBarSettings.viewButtons, icon: LucideIcon, action: () => void, active: boolean) => {
        if (!controlBarSettings.viewButtons[id]) return null;
        return (
            <button
                key={id}
                onClick={action}
                className={`p-1.5 rounded-sm border border-black/40 shadow-[inset_0_1px_rgba(255,255,255,0.05)] transition-all transform active:scale-95 ${active ? 'bg-accent-cyan/30 text-accent-cyan border-accent-cyan/40 shadow-inner' : 'bg-gradient-to-b from-white/10 to-transparent text-studio-text-mid hover:text-white'}`}
            >
                {React.createElement(icon, { className: "w-[18px] h-[18px]" })}
            </button>
        );
    };

    const renderTransportButton = (id: keyof typeof controlBarSettings.transportButtons, icon: LucideIcon, action?: () => void, active?: boolean, colorClass?: string) => {
        if (!controlBarSettings.transportButtons[id]) return null;
        return (
            <button
                key={id}
                onClick={action}
                className={`p-1.5 transition-all transform active:scale-90 ${active ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(34,165,233,0.8)]' : colorClass || 'text-studio-text-dim hover:text-white'}`}
            >
                {React.createElement(icon, { className: `w-[18px] h-[18px] ${active ? 'fill-accent-cyan' : 'fill-current'}` })}
            </button>
        );
    };

    // LCD Renderers
    const renderBeatsPos = (small = false) => (
        <div className={`flex flex-col items-center ${small ? 'min-w-[50px]' : 'min-w-[80px]'}`}>
            {!small && <span className="text-[8px] font-black text-accent-cyan/40 uppercase tracking-widest leading-none mb-1">Position</span>}
            <div className={`flex gap-2 items-baseline text-accent-cyan/90 font-mono tracking-tighter tabular-nums drop-shadow-[0_0_3px_rgba(14,165,233,0.3)] ${small ? 'gap-1 scale-90' : ''}`}>
                <span className={`${small ? 'text-[14px]' : 'text-[18px]'} font-black`}>{bar}</span>
                <span className={`${small ? 'text-[12px]' : 'text-[15px]'} font-black`}>{beat}</span>
                <span className={`${small ? 'text-[10px]' : 'text-[13px]'} font-black`}>{div}</span>
                <span className={`${small ? 'text-[9px]' : 'text-[11px]'} font-black opacity-60`}>{tick}</span>
            </div>
        </div>
    );

    const renderTimePos = (small = false) => (
        <div className={`flex flex-col items-center ${small ? 'min-w-[60px]' : 'min-w-[100px]'}`}>
            {!small && <span className="text-[8px] font-black text-accent-cyan/40 uppercase tracking-widest leading-none mb-1">Time</span>}
            <div className={`flex gap-1 items-baseline text-accent-cyan/90 font-mono tracking-tighter tabular-nums drop-shadow-[0_0_3px_rgba(14,165,233,0.3)] ${small ? 'scale-90' : ''}`}>
                <span className={`${small ? 'text-[14px]' : 'text-[20px]'} font-black`}>{mins}</span>
                <span className="text-[12px] opacity-40">:</span>
                <span className={`${small ? 'text-[14px]' : 'text-[20px]'} font-black`}>{secs}</span>
                <span className="text-[12px] opacity-40">.</span>
                <span className={`${small ? 'text-[11px]' : 'text-[13px]'} font-black opacity-60`}>{ms}</span>
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
                className={className + ' cursor-pointer hover:text-accent-cyan'}
                onClick={() => { setTempoInput(String(tempo)); setEditingTempo(true); }}
            >
                {tempo}
            </span>
        );
    };

    const renderProjectInfo = () => (
        <div className="flex-1 flex justify-around px-2 border-l border-white/5 ml-2">
            <div className="flex flex-col items-center min-w-[32px]">
                <span className="text-[8px] font-black text-studio-text-dim uppercase tracking-widest leading-none mb-1">Tempo</span>
                {renderTempoValue('text-[13px] font-black text-studio-text tabular-nums')}
            </div>
            <div className="flex flex-col items-center min-w-[32px]">
                <span className="text-[8px] font-black text-studio-text-dim uppercase tracking-widest leading-none mb-1">Signature</span>
                <span className="text-[13px] font-black text-studio-text">4/4</span>
            </div>
            <div className="flex flex-col items-center min-w-[32px]">
                <span className="text-[8px] font-black text-studio-text-dim uppercase tracking-widest leading-none mb-1">Key</span>
                <span className="text-[13px] font-black text-studio-text">C maj</span>
            </div>
        </div>
    );

    const renderLCDContent = () => {
        const mode = controlBarSettings.displayMode;
        switch (mode) {
            case 'Beats': return renderBeatsPos();
            case 'Time': return renderTimePos();
            case 'Beats & Time': return (
                <div className="flex-1 flex items-center justify-center gap-10">
                    {renderBeatsPos()}
                    <div className="w-px h-5 bg-white/5"></div>
                    {renderTimePos()}
                </div>
            );
            case 'Beats & Project': return (
                <div className="flex-1 flex items-center justify-between">
                    {renderBeatsPos()}
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
                                <span className="text-[10px] text-studio-text-mid truncate w-10 uppercase">C Major</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Sgn</span>
                                <span className="text-[11px] text-studio-text font-black">4/4</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] text-studio-text-dim font-bold uppercase">Div</span>
                                <span className="text-[10px] text-studio-text-mid">/16</span>
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
            className="h-[52px] bg-gradient-to-b from-studio-control to-studio-raised border-b border-black flex items-center px-4 gap-4 justify-start xl:justify-between overflow-x-auto overflow-y-hidden daw-scrollbar-thin shrink-0 z-[100] shadow-[0_4px_10px_rgba(0,0,0,0.5)] select-none"
            onContextMenu={onContextMenu}
        >

            {/* 1. View Toggles (Logic Left Control) */}
            {controlBarSettings.showViews && (
                <div className="flex items-center gap-1.5 shrink-0">
                    {renderViewButton('library', Sidebar, toggleLibrary, showLibrary)}
                    {renderViewButton('inspector', Layout, toggleInspector, showInspector)}
                    {renderViewButton('quickHelp', Search, () => { }, false)}
                    {renderViewButton('toolbar', Settings, toggleToolbar, showToolbar)}
                    <div className="w-px h-6 bg-black/40 mx-1"></div>
                    {renderViewButton('smartControls', Activity, () => { }, false)}
                    {renderViewButton('mixer', List, toggleMixer, showMixer)}
                    {renderViewButton('editors', MonitorPlay, () => { }, false)}
                    {renderViewButton('musicalTyping', Keyboard, toggleVirtualKeyboard, showVirtualKeyboard)}
                </div>
            )}

            {/* 2. Transport Center-Left (Logic Standard Layout) */}
            {controlBarSettings.showTransport && (
                <div className="flex items-center gap-2 px-6 shrink-0">
                    <div className="flex bg-black/40 rounded-sm border border-black/60 p-0.5">
                        {renderTransportButton('goBeginning', SkipBack, stop)}
                        {renderTransportButton('rewind', SkipBack)}
                        {renderTransportButton('forward', SkipForward)}
                    </div>

                    <div className="flex bg-black/40 rounded-sm border border-black/60 p-0.5 shadow-inner">
                        {renderTransportButton('stop', Square, stop)}
                        {renderTransportButton('play', Play, play, playing)}
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
                    className={`flex-1 ${controlBarSettings.displayMode === 'Custom' ? 'max-w-[720px]' : 'max-w-[580px]'} h-9 bg-black rounded shadow-[inset_0_2px_10px_rgba(0,0,0,1)] border border-white/5 flex items-center px-4 gap-6 relative overflow-visible group transition-all duration-300`}
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
                    <div
                        ref={lcdRef}
                        className="flex-1 flex items-center justify-between cursor-pointer"
                        onClick={() => setShowLCDMenu(v => !v)}
                    >

                        {renderLCDContent()}

                        {/* Dropdown Indicator */}
                        <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[4px] border-t-white/40 group-hover:border-t-sky-500"></div>
                        </div>

                        {/* LCD Context Menu */}
                        {showLCDMenu && lcdMenuPos && typeof document !== 'undefined' && createPortal(
                            <div
                                data-lcd-menu
                                onClick={(e) => e.stopPropagation()}
                                style={{ position: 'fixed', top: lcdMenuPos.top, left: lcdMenuPos.left }}
                                className="w-[220px] bg-studio-panel border border-black shadow-2xl rounded p-1 flex flex-col z-[9000] animate-in fade-in slide-in-from-top-1 duration-100">
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === 'Beats & Project' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { updateControlBar({ displayMode: 'Beats & Project' }); setShowLCDMenu(false) }}>Beats & Project</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === 'Beats & Time' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { updateControlBar({ displayMode: 'Beats & Time' }); setShowLCDMenu(false) }}>Beats & Time</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === 'Beats' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { updateControlBar({ displayMode: 'Beats' }); setShowLCDMenu(false) }}>Beats</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === 'Time' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { updateControlBar({ displayMode: 'Time' }); setShowLCDMenu(false) }}>Time</button>
                                <button className={`px-3 py-1.5 text-left text-[11px] font-bold ${controlBarSettings.displayMode === 'Custom' ? 'bg-accent-cyan text-white' : 'text-studio-text hover:bg-white/5'}`} onClick={() => { updateControlBar({ displayMode: 'Custom' }); setShowLCDMenu(false) }}>Custom</button>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => toggleFloatingWindow('giantBeats')}>Open Giant Beats Display</button>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => toggleFloatingWindow('giantTime')}>Open Giant Time Display</button>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors" onClick={() => { setShowCustomizer(true); setShowLCDMenu(false) }}>Customize Control Bar and Display...</button>
                                <div className="h-px bg-white/5 my-1 mx-2"></div>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text-dim hover:text-white transition-opacity uppercase tracking-widest text-[8px]">Project Management</button>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors">Clean Up Project...</button>
                                <button className="px-3 py-1.5 text-left text-[11px] font-bold text-studio-text hover:bg-accent-cyan hover:text-white rounded transition-colors">Consolidate Assets...</button>
                            </div>,
                            document.body
                        )}
                    </div>

                    <div className="w-px h-5 bg-white/5"></div>

                    {/* CPU/Drive (Professional Tech Detail) */}
                    <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity pr-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="w-6 h-[1.5px] bg-studio-sunken rounded-full overflow-hidden"><div className="h-full bg-accent-cyan w-[20%] animate-pulse"></div></div>
                            <div className="w-6 h-[1.5px] bg-studio-sunken rounded-full overflow-hidden"><div className="h-full bg-green-500 w-[45%]"></div></div>
                        </div>
                        <Activity className="w-3.5 h-3.5 text-accent-cyan" />
                    </div>
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
