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
        <div className="h-[52px] bg-[#1a1a1a] border-t border-[#000] flex items-center px-6 justify-between select-none z-50 shrink-0">
            {/* Left Section: Drawer Toggles */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={toggleLibrary}
                    title="Browser (Library)"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showLibrary ? 'bg-[#333] border-[#555] text-sky-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
                >
                    <LayoutGrid className="w-[18px] h-[18px]" fill={showLibrary ? "currentColor" : "none"} />
                </button>
                <button
                    onClick={toggleInspector}
                    title="Inspector"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showInspector ? 'bg-[#333] border-[#555] text-sky-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
                >
                    <SlidersHorizontal className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={toggleAutomation}
                    title="Automation"
                    className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${showAutomation ? 'bg-[#333] border-[#555] text-sky-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'} px-1`}
                >
                    <div className={`w-1 h-3 rounded-full ${showAutomation ? 'bg-sky-400' : 'bg-gray-500'}`}></div>
                </button>
            </div>

            {/* Center Section: Main Workarea Toggles */}
            <div className="flex items-center px-1.5 py-1 bg-[#252525] rounded-xl border border-[#333] gap-1 shadow-inner translate-x-12">
                <button
                    onClick={toggleEditors}
                    title="Editors"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showEditors && bottomPanel === 'pianoroll' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Pencil className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={toggleSmartControls}
                    title="Plug-ins"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showSmartControls && bottomPanel === 'smartcontrols' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Sun className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={toggleMixer}
                    title="Mixer"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${showMixer && bottomPanel === 'mixer' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
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
                        className={`w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border ${isFullscreen ? 'bg-[#333] border-[#555] text-sky-400 shadow-inner' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
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
                    className={`w-[52px] h-[38px] rounded-lg flex items-center justify-center transition-all shadow-md group border border-opacity-40 ${showVirtualKeyboard ? 'bg-[#333] border-[#555] text-sky-400' : 'bg-[#252525] border-[#333] text-gray-500 hover:text-white'}`}
                >
                    <Music className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    )
}
