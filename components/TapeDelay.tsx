"use client"
import React, { useState, useEffect, useRef } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { Power, RotateCcw, ChevronLeft, ChevronRight, Link2, MoreHorizontal } from 'lucide-react'

interface TapeDelayProps {
    trackId: string;
    pluginId: string;
}

export function TapeDelay({ trackId, pluginId }: TapeDelayProps) {
    const { updatePluginParams, tracks } = useProjectStore()
    const track = tracks.find(t => t.id === trackId)
    const plugin = track?.plugins.find(p => p.id === pluginId)
    const params = plugin?.params || {}

    const [activeTab, setActiveTab] = useState<'MAIN' | 'DETAILS'>('MAIN')

    const updateParam = (key: string, val: number) => {
        updatePluginParams(trackId, pluginId, { [key]: val })
    }

    return (
        <div className="w-[940px] bg-[#1e2a35] rounded-lg overflow-hidden flex flex-col shadow-2xl border border-black/40 font-sans select-none text-white/90">
            {/* Top Toolbar - Standard Magic Pro Style */}
            <div className="h-10 bg-gradient-to-b from-[#4a4a4a] to-[#2a2a2a] border-b border-black flex items-center px-2 justify-between">
                <div className="flex items-center gap-1.5">
                    <button className="w-7 h-7 bg-black/40 rounded flex items-center justify-center border border-white/5 hover:bg-white/10 group shadow-inner">
                        <Power className="w-3.5 h-3.5 text-sky-400 group-hover:text-white" fill="currentColor" />
                    </button>
                    
                    <div className="flex items-center bg-black/30 border border-white/5 rounded h-7 px-2 ml-1 cursor-pointer hover:bg-white/5">
                        <span className="text-[11px] font-bold text-gray-300 tracking-tight">Factory Default</span>
                        <ChevronDownSmall className="w-2.5 h-2.5 ml-2 text-gray-500" />
                    </div>

                    <div className="flex ml-1">
                        <button className="w-6 h-7 bg-black/20 border border-white/5 rounded-l flex items-center justify-center hover:bg-white/5 disabled:opacity-30">
                            <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button className="w-6 h-7 bg-black/20 border-l-0 border border-white/5 rounded-r flex items-center justify-center hover:bg-white/5">
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="flex h-7 ml-2 bg-black/40 rounded overflow-hidden border border-white/5">
                        <button className="px-2.5 text-[9px] font-black uppercase text-sky-400 border-r border-white/5 hover:bg-white/5 bg-sky-950/30">Compare</button>
                        <button className="px-2.5 text-[9px] font-black uppercase text-gray-400 border-r border-white/5 hover:bg-white/5">Copy</button>
                        <button className="px-2.5 text-[9px] font-black uppercase text-gray-400 hover:bg-white/5">Paste</button>
                    </div>

                    <div className="flex h-7 ml-2 bg-black/40 rounded overflow-hidden border border-white/5">
                        <button className="px-2.5 text-[9px] font-black uppercase text-gray-400 border-r border-white/5 hover:bg-white/5">Undo</button>
                        <button className="px-2.5 text-[9px] font-black uppercase text-gray-400 hover:bg-white/5">Redo</button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-black/40 border border-white/5 rounded h-7 px-2">
                        <span className="text-[10px] text-gray-500 mr-2">View:</span>
                        <span className="text-[10px] font-bold text-gray-300">88%</span>
                        <div className="flex flex-col ml-1.5 gap-0.5">
                            <ChevronUpTiny className="w-1.5 h-1.5 text-gray-500" />
                            <ChevronDownTiny className="w-1.5 h-1.5 text-gray-500" />
                        </div>
                    </div>
                    <button className="w-7 h-7 bg-black/40 rounded border border-white/5 flex items-center justify-center hover:bg-white/5">
                        <Link2 className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col p-8 gap-10 bg-gradient-to-b from-[#243444] to-[#1a2530]">
                {/* Top Section: Delay, Character, Feedback */}
                <div className="flex h-[320px]">
                    {/* DELAY Section */}
                    <div className="flex-1 flex flex-col items-center border-r border-white/5 px-6">
                        <h2 className="text-[16px] font-semibold text-[#8cc6ff] uppercase tracking-[4px] mb-8">Delay</h2>
                        
                        <div className="w-full flex justify-between items-start mb-4">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-2">Tempo Sync</span>
                                <button className="w-8 h-8 rounded bg-black/40 border border-white/10 flex items-center justify-center shadow-inner hover:bg-white/10 transition-colors">
                                    <MusicNote className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Delay Time</span>
                                <span className="text-[15px] font-bold text-[#b8f56e]">0.0 ms</span>
                            </div>

                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Note</span>
                                <div className="flex items-center gap-1.5 group cursor-pointer">
                                    <span className="text-[11px] text-gray-400 font-bold group-hover:text-white transition-colors">1/16 triplet</span>
                                    <div className="flex flex-col gap-0.5">
                                        <ChevronUpTiny className="w-1.5 h-1.5 text-gray-600" />
                                        <ChevronDownTiny className="w-1.5 h-1.5 text-gray-600" />
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col items-center">
                                    <span className="text-[9px] uppercase text-gray-600 font-bold mb-0.5">Deviation</span>
                                    <span className="text-[11px] text-gray-500 font-bold">-34.00 %</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center mt-2">
                            <ControlKnob 
                                size={110} 
                                value={params.delayTime || 0} 
                                onChange={(v) => updateParam('delayTime', v)}
                                color="#b8f56e"
                            />
                            <div className="flex gap-2 mt-4">
                                <button className="px-3 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] text-gray-400 font-bold hover:bg-white/10">: 2</button>
                                <button className="px-3 py-0.5 bg-black/40 rounded border border-white/10 text-[10px] text-gray-400 font-bold hover:bg-white/10">x 2</button>
                            </div>
                        </div>

                        <div className="w-full mt-auto pt-6 border-t border-white/5 flex items-center gap-4">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Smoothing</span>
                            <div className="flex-1 h-[1px] bg-black relative">
                                <div className="absolute top-[-3px] left-0 h-1.5 w-[1px] bg-gray-500" />
                                <div className="absolute top-[-3px] right-0 h-1.5 w-[1px] bg-gray-500" />
                                <div 
                                    className="absolute top-[-6px] h-3 w-1.5 bg-gray-400 cursor-pointer shadow-lg hover:bg-white" 
                                    style={{ left: '25%' }}
                                />
                            </div>
                            <span className="text-[12px] font-bold text-[#b8f56e] w-12 text-right">40 ms</span>
                        </div>
                    </div>

                    {/* CHARACTER Section */}
                    <div className="flex-1 flex flex-col items-center border-r border-white/5 px-6">
                        <h2 className="text-[16px] font-semibold text-[#8cc6ff] uppercase tracking-[4px] mb-8">Character</h2>
                        
                        <div className="flex gap-12 mt-4">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Clip Threshold</span>
                                <span className="text-[14px] font-bold text-[#b8f56e] mb-4">0.0 dB</span>
                                <ControlKnob size={68} value={0.5} color="#b8f56e" showScale labelMin="-20" labelMax="20" />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Spread</span>
                                <span className="text-[14px] font-bold text-[#b8f56e] mb-4">0</span>
                                <ControlKnob size={68} value={0.5} color="#b8f56e" />
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center">
                            <span className="text-[9px] uppercase text-gray-500 font-bold mb-3">Tape Head Mode</span>
                            <div className="flex h-7 bg-black/40 rounded p-0.5 border border-white/5">
                                <button className="px-4 text-[10px] font-black uppercase text-white bg-[#2a3a4a] rounded-sm shadow-sm">Clean</button>
                                <button className="px-4 text-[10px] font-black uppercase text-gray-500 hover:text-gray-300">Diffuse</button>
                            </div>
                        </div>

                        <div className="w-full mt-auto pt-6 border-t border-white/5 flex flex-col gap-2">
                           <div className="flex justify-between text-[10px] uppercase text-gray-500 font-bold">
                                <span>Low Cut</span>
                                <span>High Cut</span>
                           </div>
                           <div className="flex justify-between text-[12px] font-bold text-[#b8f56e]">
                                <span>20 Hz</span>
                                <span>20000 Hz</span>
                           </div>
                           <div className="h-1 bg-black/60 rounded-full relative mt-1">
                                <div className="absolute inset-y-0 bg-[#b8f56e]/40 rounded-full" style={{ left: '0%', right: '0%' }} />
                                <div className="absolute top-[-5px] left-0 h-3.5 w-[2px] bg-white cursor-ew-resize before:content-[''] before:absolute before:inset-y-0 before:left-[-4px] before:right-[-4px]" />
                                <div className="absolute top-[-5px] right-0 h-3.5 w-[2px] bg-white cursor-ew-resize before:content-[''] before:absolute before:inset-y-0 before:left-[-4px] before:right-[-4px]" />
                           </div>
                        </div>
                    </div>

                    {/* FEEDBACK Section */}
                    <div className="w-[180px] flex flex-col items-center px-4">
                        <h2 className="text-[16px] font-semibold text-[#8cc6ff] uppercase tracking-[4px] mb-8">Feedback</h2>
                        
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Feedback</span>
                            <span className="text-[14px] font-bold text-[#b8f56e] mb-4">0 %</span>
                            <ControlKnob size={68} value={0.1} color="#b8f56e" />
                        </div>

                        <div className="mt-12 flex flex-col items-center">
                            <span className="text-[9px] uppercase text-gray-500 font-bold mb-3">Freeze</span>
                            <button className="w-14 h-7 bg-black/40 rounded border border-white/5 text-[9px] font-black uppercase text-gray-500 hover:bg-white/5 transition-colors">
                                OFF
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Modulation & Output */}
                <div className="flex flex-1 border-t border-white/5 pt-10">
                    {/* MODULATION */}
                    <div className="flex-[3] flex flex-col items-center border-r border-white/5 px-6">
                        <h2 className="text-[16px] font-semibold text-[#8cc6ff] uppercase tracking-[4px] mb-8">Modulation</h2>
                        <div className="w-full flex justify-around">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">LFO Rate</span>
                                <span className="text-[13px] font-bold text-[#b8f56e] mb-4">0.20 Hz</span>
                                <ControlKnob size={60} value={0.2} color="#b8f56e" showScale labelMin="0" labelMax="10" />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">LFO Intensity</span>
                                <span className="text-[13px] font-bold text-[#b8f56e] mb-4">0 %</span>
                                <ControlKnob size={60} value={0.15} color="#b8f56e" />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Flutter Rate</span>
                                <span className="text-[13px] font-bold text-[#b8f56e] mb-4">0.0 Hz</span>
                                <ControlKnob size={60} value={0.1} color="#b8f56e" showScale labelMin="0" labelMax="10" />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] uppercase text-gray-500 font-bold mb-1">Flutter Intensity</span>
                                <span className="text-[13px] font-bold text-[#b8f56e] mb-4">0 %</span>
                                <ControlKnob size={60} value={0.1} color="#b8f56e" />
                            </div>
                        </div>
                    </div>

                    {/* OUTPUT */}
                    <div className="flex-1 flex flex-col items-center px-6">
                        <h2 className="text-[16px] font-semibold text-[#8cc6ff] uppercase tracking-[4px] mb-8">Output</h2>
                        <div className="flex gap-16 mt-4 items-end">
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[9px] uppercase text-gray-500 font-bold">Dry</span>
                                <span className="text-[12px] font-bold text-gray-400">0 %</span>
                                <VerticalSlider height={160} value={0} />
                            </div>
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[9px] uppercase text-gray-500 font-bold">Wet</span>
                                <span className="text-[12px] font-bold text-[#b8f56e]">100 %</span>
                                <VerticalSlider height={160} value={1} color="#b8f56e" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Branding Bar */}
            <div className="h-8 bg-black flex items-center justify-center text-[10px] font-medium tracking-[8px] text-gray-600 uppercase italic">
                Tape Delay
            </div>
        </div>
    )
}

function ControlKnob({ 
    size, value, onChange, color="#b8f56e", showScale=false, labelMin, labelMax 
}: { 
    size: number, value: number, onChange?: (v: number) => void, color?: string,
    showScale?: boolean, labelMin?: string, labelMax?: string
}) {
    const angle = value * 270 - 135
    
    return (
        <div className="relative group" style={{ width: size, height: size }}>
            {/* Background Circle with physical depth */}
            <div 
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-black to-[#333] border border-black/40 shadow-[0_4px_10px_rgba(0,0,0,0.5)]" 
                style={{}}
            />
            {/* Tick Marks (Pseudo) */}
            {showScale && (
                <>
                    <div className="absolute -bottom-4 left-0 text-[8px] font-black text-gray-700">{labelMin}</div>
                    <div className="absolute -bottom-4 right-0 text-[8px] font-black text-gray-700">{labelMax}</div>
                </>
            )}
            
            {/* Inner Rotation Part */}
            <div 
                className="absolute inset-[3px] rounded-full bg-[#3c4c5c] shadow-inner flex items-center justify-center overflow-hidden"
                style={{ transform: `rotate(${angle}deg)` }}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/5 opacity-50" />
                <div className="w-[1px] h-1/2 bg-[#b8f56e] absolute top-0 shadow-[0_0_8px_rgba(184,245,110,0.8)]" />
            </div>

            {/* Glow / Value Ring */}
            <svg className="absolute inset-0 -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="3"
                />
                <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={`${value * 270} 360`}
                    className="opacity-40"
                    style={{ transformOrigin: 'center', transform: 'rotate(-45deg)' }}
                />
            </svg>
        </div>
    )
}

function VerticalSlider({ height, value, color="#555" }: { height: number, value: number, color?: string }) {
    return (
        <div className="w-6 flex flex-col items-center" style={{ height }}>
            <div className="flex-1 w-[2px] bg-black relative rounded-full">
                {/* Visual track */}
                {value > 0 && (
                    <div 
                        className="absolute bottom-0 left-0 right-0 rounded-full" 
                        style={{ height: `${value * 100}%`, backgroundColor: color, boxShadow: `0 0 15px ${color}66` }}
                    />
                )}
                {/* Handle */}
                <div 
                    className="absolute w-5 h-2.5 bg-gradient-to-b from-[#7a7a7a] to-[#4a4a4a] border border-black rounded-sm shadow-xl cursor-pointer left-1/2 -ml-2.5 hover:brightness-125 transition-all"
                    style={{ bottom: `calc(${value * 100}% - 5px)` }}
                >
                    <div className="w-full h-[1px] bg-white/10 mt-[2px]" />
                </div>
            </div>
        </div>
    )
}

function MusicNote({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    )
}

function ChevronDownSmall({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}

function ChevronUpTiny({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="50,30 80,60 20,60" />
        </svg>
    )
}

function ChevronDownTiny({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="currentColor">
            <polygon points="20,40 80,40 50,70" />
        </svg>
    )
}
