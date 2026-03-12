"use client"
import { useProjectStore } from "@/store/projectStore"
import {
    Library, Info, Settings2, Sliders, Layout,
    Music, Pencil, Sun, LayoutGrid, List,
    SlidersHorizontal, Square
} from "lucide-react"

interface ViewControlBarProps {
    bottomPanel: 'mixer' | 'pianoroll' | 'smartcontrols';
    setBottomPanel: (panel: 'mixer' | 'pianoroll' | 'smartcontrols') => void;
}

export function ViewControlBar({ bottomPanel, setBottomPanel }: ViewControlBarProps) {
    const {
        showLibrary, toggleLibrary,
        showInspector, toggleInspector,
        showAutomation, toggleAutomation
    } = useProjectStore()

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
                    className="w-10 h-[38px] rounded-lg transition-all flex items-center justify-center border bg-[#252525] border-[#333] text-gray-500 hover:text-white px-1"
                    title="Fader"
                >
                    <div className="w-1 h-3 bg-gray-500 rounded-full"></div>
                </button>
            </div>

            {/* Center Section: Main Workarea Toggles */}
            <div className="flex items-center px-1.5 py-1 bg-[#252525] rounded-xl border border-[#333] gap-1 shadow-inner translate-x-12">
                <button
                    onClick={() => setBottomPanel('pianoroll')}
                    title="Editors"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${bottomPanel === 'pianoroll' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Pencil className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={() => setBottomPanel('smartcontrols')}
                    title="Plug-ins"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${bottomPanel === 'smartcontrols' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Sun className="w-5 h-5" strokeWidth={3} />
                </button>
                <button
                    onClick={() => setBottomPanel('mixer')}
                    title="Mixer"
                    className={`w-[60px] h-9 rounded-lg flex items-center justify-center transition-all ${bottomPanel === 'mixer' ? 'bg-[#3a3a3a] text-sky-400 shadow-lg border border-[#555]' : 'text-gray-500 hover:text-white'}`}
                >
                    <Sliders className="w-5 h-5" strokeWidth={3} />
                </button>
            </div>

            {/* Right Section: Piano Key Toggle */}
            <div className="flex items-center">
                <button
                    title="Play Surfaces"
                    className="w-[52px] h-[38px] rounded-lg bg-[#252525] border border-[#333] flex items-center justify-center text-gray-500 hover:text-white transition-all shadow-md group border-opacity-40"
                >
                    <Music className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    )
}
