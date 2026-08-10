"use client"
import { useProjectStore } from "@/store/projectStore"
import { useFullscreen } from "@/hooks/useFullscreen"
import {
    Library, Info, Settings2, Sliders, Layout,
    Music, Pencil, Sun, LayoutGrid, List,
    SlidersHorizontal, Square, Maximize2, Minimize2
} from "lucide-react"

interface ViewControlBarProps {
    bottomPanel: 'mixer' | 'pianoroll' | 'smartcontrols';
}

export function ViewControlBar({ bottomPanel }: ViewControlBarProps) {
    const {
        showLibrary, toggleLibrary,
        showInspector, toggleInspector,
        showAutomation, toggleAutomation,
        showMixer, toggleMixer,
        showSmartControls, toggleSmartControls,
        showEditors, toggleEditors,
        toggleVirtualKeyboard,
        showVirtualKeyboard
    } = useProjectStore()

    const { isFullscreen, isSupported, toggle } = useFullscreen()

    return (
        <div className="h-[52px] bg-studio-panel border-t border-studio-line flex items-center px-6 justify-between select-none z-50 shrink-0">
            {/* Left Section: Drawer Toggles */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={toggleLibrary}
                    title="Browser (Library)"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showLibrary ? 'bg-studio-control border-studio-line-strong text-accent-cyan shadow-inner' : 'bg-studio-raised border-studio-line text-studio-text-dim hover:text-white'}`}
                >
                    <LayoutGrid className="w-[18px] h-[18px]" fill={showLibrary ? "currentColor" : "none"} />
                </button>
                <button
                    onClick={toggleInspector}
                    title="Inspector"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showInspector ? 'bg-studio-control border-studio-line-strong text-accent-cyan shadow-inner' : 'bg-studio-raised border-studio-line text-studio-text-dim hover:text-white'}`}
                >
                    <SlidersHorizontal className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={toggleAutomation}
                    title="Automation"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showAutomation ? 'bg-studio-control border-studio-line-strong text-accent-cyan shadow-inner' : 'bg-studio-raised border-studio-line text-studio-text-dim hover:text-white'} px-1`}
                >
                    <div className={`w-1 h-3 rounded-full ${showAutomation ? 'bg-accent-cyan' : 'bg-studio-control'}`}></div>
                </button>
            </div>

            {/* Center Section: Main Workarea Toggles */}
            <div className="flex items-center px-1.5 py-1 bg-studio-raised rounded-xl border border-studio-line gap-1 shadow-inner translate-x-12">
                <button
                    onClick={toggleEditors}
                    title="Editors"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showEditors && bottomPanel === 'pianoroll' ? 'bg-studio-control text-accent-cyan shadow-lg border border-studio-line-strong' : 'text-studio-text-dim hover:text-white'}`}
                >
                    <Pencil className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={toggleSmartControls}
                    title="Plug-ins"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showSmartControls && bottomPanel === 'smartcontrols' ? 'bg-studio-control text-accent-cyan shadow-lg border border-studio-line-strong' : 'text-studio-text-dim hover:text-white'}`}
                >
                    <Sun className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={toggleMixer}
                    title="Mixer"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showMixer && bottomPanel === 'mixer' ? 'bg-studio-control text-accent-cyan shadow-lg border border-studio-line-strong' : 'text-studio-text-dim hover:text-white'}`}
                >
                    <Sliders className="w-5 h-5" strokeWidth={3} />
                </button>
            </div>

            {/* Right Section: Fullscreen & Play Surfaces */}
            <div className="flex items-center gap-2">
                {isSupported && (
                    <button
                        onClick={toggle}
                        title={isFullscreen ? "Exit Fullscreen (F11)" : "Enter Fullscreen (F11)"}
                        className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${isFullscreen ? 'bg-studio-control border-studio-line-strong text-accent-cyan shadow-inner' : 'bg-studio-raised border-studio-line text-studio-text-dim hover:text-white'}`}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-[18px] h-[18px]" />
                        ) : (
                            <Maximize2 className="w-[18px] h-[18px]" />
                        )}
                    </button>
                )}
                <button
                    onClick={() => toggleVirtualKeyboard()}
                    title="Play Surfaces"
                    className={`w-[52px] h-[38px] rounded-lg flex items-center justify-center transition-all shadow-md group border border-opacity-40 ${showVirtualKeyboard ? 'bg-studio-control border-studio-line-strong text-accent-cyan' : 'bg-studio-raised border-studio-line text-studio-text-dim hover:text-white'}`}
                >
                    <Music className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    )
}
