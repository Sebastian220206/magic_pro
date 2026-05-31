"use client"

import React, { useState } from 'react'
import {
    Plus, Clock, Grid, Folder, FileType, User, ChevronRight, ChevronDown,
    Settings, Play, Mic, Speaker, Music, Activity, Layers, Download,
    Waves, Sliders, Clapperboard, Music2, Zap, LayoutGrid
} from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'

interface ProjectChooserProps {
    onClose: () => void
    onChoose: (settings: any) => void
    onOpenProject: (id: string) => void
}

export function ProjectChooser({ onClose, onChoose, onOpenProject }: ProjectChooserProps) {
    const { recentProjects, demoProjects } = useProjectStore()
    const [selectedCategory, setSelectedCategory] = useState<string>('New Project')
    const [selectedTemplate, setSelectedTemplate] = useState('Empty Project')
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [detailsExpanded, setDetailsExpanded] = useState(false)

    // Project Settings State
    const [settings, setSettings] = useState({
        useMusicalGrid: true,
        useFlexTime: true,
        tempo: 120,
        keySignature: 'C Major',
        timeSignature: '4/4',
        inputDevice: 'System Setting',
        outputDevice: 'System Setting',
        sampleRate: 44.1,
        frameRate: 25,
        projectFormat: 'stereo',
        spatialAudioMode: 'Off',
        surroundFormat: '5.1 (ITU 775)'
    })

    const categories = [
        { id: 'New Project', icon: Plus, label: 'New Project' },
        { id: 'Recent', icon: Clock, label: 'Recent' },
        { id: 'Live Loops Grids', icon: Grid, label: 'Live Loops Grids' },
        { id: 'Demo Projects', icon: Folder, label: 'Demo Projects' },
        { id: 'Project Templates', icon: FileType, label: 'Project Templates' },
        { id: 'My Templates', icon: User, label: 'My Templates' },
    ]

    const newProjectTemplates = [
        {
            id: 'Empty Project', label: 'Empty Project', description: 'Create an empty project', icon: (
                <div className="relative w-full h-full bg-[#8E8E93] rounded-md flex flex-col gap-[2px] p-2">
                    <div className="w-1/2 h-4 bg-[#C7C7CC] rounded-sm opacity-60"></div>
                    <div className="w-full h-4 bg-[#C7C7CC] rounded-sm opacity-60"></div>
                    <div className="w-3/4 h-4 bg-[#C7C7CC] rounded-sm opacity-60"></div>
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                        <Plus className="w-3 h-3 text-white" />
                    </div>
                </div>
            )
        },
        {
            id: 'Live Loops', label: 'Live Loops', description: 'Create a Live Loops project', icon: (
                <div className="relative w-full h-full bg-[#8E8E93] rounded-md grid grid-cols-3 grid-rows-3 gap-[2px] p-2">
                    {[...Array(9)].map((_, i) => (
                        <div key={i} className="bg-[#C7C7CC] rounded-[1px] opacity-60"></div>
                    ))}
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                        <Plus className="w-3 h-3 text-white" />
                    </div>
                </div>
            )
        },
    ]

    const projectTemplates = [
        {
            id: 'Hip Hop', label: 'Hip Hop', description: 'Create a Hip Hop project with drum pads and bass', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center">
                    <div className="w-16 h-12 bg-[#D1D1D6]/20 rounded border border-white/30 p-1.5 flex flex-col gap-1">
                        <div className="flex gap-1">
                            <div className="w-3 h-2 bg-white/80 rounded-[1px]"></div>
                            <div className="w-full h-2 bg-white/20 rounded-[1px]"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 flex-1">
                            {[...Array(9)].map((_, i) => (
                                <div key={i} className="bg-white/90 rounded-[1px]"></div>
                            ))}
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'Electronic', label: 'Electronic', description: 'Create an Electronic music project', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center">
                    <div className="w-20 h-12 flex items-center justify-center">
                        <svg viewBox="0 0 100 40" className="w-full h-full text-white/90" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M0 20 L20 20 L25 10 L30 30 L35 5 L40 35 L50 20 L100 20" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            )
        },
        {
            id: 'Songwriter', label: 'Songwriter', description: 'Create a Songwriter project for acoustic recordings', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center overflow-hidden">
                    <div className="relative flex items-center justify-center">
                        {/* Guitar Silhouette */}
                        <div className="w-10 h-16 bg-white/90 rounded-[40%] relative">
                            <div className="absolute top-[-5px] left-1/2 -translate-x-1/2 w-4 h-6 bg-white/90 rounded-sm"></div>
                            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#5A5A5A]"></div>
                        </div>
                        {/* Fingerboard Lines */}
                        <div className="absolute flex flex-col gap-1.5 opacity-30">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="w-20 h-[1px] bg-black"></div>
                            ))}
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'Orchestral', label: 'Orchestral', description: 'Create an Orchestral project with classical arrangements', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center gap-2">
                    <div className="w-8 h-16 bg-white/90 rounded-full relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-4 bg-white/90 rounded-sm"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[1px] h-full bg-black/20"></div>
                    </div>
                    <div className="w-8 h-10 border-2 border-white/60 flex flex-col p-1 gap-1">
                        <div className="w-full h-[1px] bg-white/40"></div>
                        <div className="w-full h-[1px] bg-white/40"></div>
                        <div className="w-full h-[1px] bg-white/40"></div>
                    </div>
                </div>
            )
        },
        {
            id: 'Multi-Track', label: 'Multi-Track', description: 'Create a Multi-Track recording project', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center">
                    <div className="w-20 h-14 bg-black/20 rounded border border-white/20 p-2 flex gap-1.5">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-[1px] h-full bg-white/20"></div>
                                <div className={`w-3 h-4 bg-white/90 rounded-sm ${i % 2 === 0 ? 'mt-2' : 'mb-2'}`}></div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 'Music For Picture', label: 'Music For Picture', description: 'Compose music for film and video', icon: (
                <div className="w-full h-full bg-[#5A5A5A] flex items-center justify-center">
                    <div className="w-16 h-12 bg-white/90 rounded-sm relative overflow-hidden flex flex-col">
                        <div className="h-4 bg-black/80 flex gap-1 p-0.5">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex-1 bg-white skew-x-[-20deg]"></div>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col gap-1 p-2">
                            <div className="w-full h-[1px] bg-black/20"></div>
                            <div className="w-full h-[1px] bg-black/20"></div>
                            <div className="w-full h-[1px] bg-black/20"></div>
                        </div>
                    </div>
                </div>
            )
        },
    ]

    const getCurrentTemplates = () => {
        switch (selectedCategory) {
            case 'New Project': return newProjectTemplates;
            case 'Project Templates': return projectTemplates;
            default: return [];
        }
    }

    const handleCategoryClick = (catId: string) => {
        setSelectedCategory(catId)
        if (catId === 'Recent' && recentProjects.length > 0) {
            setSelectedProjectId(recentProjects[0].id)
        } else if (catId === 'Demo Projects' && demoProjects.length > 0) {
            setSelectedProjectId(demoProjects[0].id)
        } else {
            setSelectedProjectId(null)
            // Set default template for category
            if (catId === 'New Project') setSelectedTemplate('Empty Project')
            else if (catId === 'Project Templates') setSelectedTemplate('Hip Hop')
        }
    }

    const renderMainContent = () => {
        if (selectedCategory === 'Recent') {
            return (
                <div className="flex flex-col gap-1">
                    {recentProjects.map((proj) => (
                        <div
                            key={proj.id}
                            onClick={() => setSelectedProjectId(proj.id)}
                            onDoubleClick={() => onOpenProject(proj.id)}
                            className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${selectedProjectId === proj.id ? 'bg-[#007AFF] text-white' : 'hover:bg-black/5'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${proj.previewColor} border border-black/10`}></div>
                            <div className="flex-1 flex flex-col">
                                <span className="text-[14px] font-semibold">{proj.name}</span>
                                <span className={`text-[12px] ${selectedProjectId === proj.id ? 'text-white/80' : 'text-gray-500'}`}>
                                    {new Date(proj.lastOpened).toLocaleString()}
                                </span>
                            </div>
                            <span className={`text-[12px] font-mono ${selectedProjectId === proj.id ? 'text-white/60' : 'text-gray-400'}`}>
                                {proj.tempo} BPM
                            </span>
                        </div>
                    ))}
                    {recentProjects.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                            <Clock className="w-12 h-12 mb-4 opacity-20" />
                            <p>No recent projects found</p>
                        </div>
                    )}
                </div>
            )
        }

        if (selectedCategory === 'Demo Projects') {
            return (
                <div className="grid grid-cols-2 gap-8">
                    {demoProjects.map((demo) => (
                        <div key={demo.id} className="flex flex-col items-center gap-3">
                            <button
                                onClick={() => setSelectedProjectId(demo.id)}
                                onDoubleClick={() => onOpenProject(demo.id)}
                                className={`w-full aspect-video rounded-lg overflow-hidden transition-all bg-gradient-to-br ${demo.previewColor} border border-black/10 shadow-sm ring-offset-2 ${selectedProjectId === demo.id ? 'ring-2 ring-[#007AFF]' : 'hover:opacity-90'
                                    }`}
                            >
                                <div className="w-full h-full flex items-center justify-center">
                                    <Play className="w-8 h-8 text-white/50" />
                                </div>
                            </button>
                            <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${selectedProjectId === demo.id ? 'bg-[#007AFF] text-white' : 'text-[#1C1C1E]'
                                }`}>
                                {demo.name}
                            </span>
                        </div>
                    ))}
                </div>
            )
        }

        // Template View
        const activeTemplates = getCurrentTemplates();
        
        return (
            <div className={`grid gap-x-8 gap-y-10 ${selectedCategory === 'Project Templates' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
                {activeTemplates.map((tpl) => (
                    <div key={tpl.id} className="flex flex-col items-center gap-3">
                        <button
                            onClick={() => setSelectedTemplate(tpl.id)}
                            className={`rounded-lg overflow-hidden transition-all shadow-md group ${
                                selectedCategory === 'Project Templates' ? 'w-full aspect-[4/3]' : 'w-32 h-24'
                            } ${selectedTemplate === tpl.id
                                ? 'ring-[3px] ring-[#007AFF] ring-offset-1 scale-[1.02]'
                                : 'hover:scale-[1.02] hover:shadow-lg'
                                }`}
                        >
                            {tpl.icon}
                        </button>
                        <span className={`text-[13px] font-bold px-3 py-1 rounded-full transition-all ${selectedTemplate === tpl.id
                            ? 'bg-[#007AFF] text-white'
                            : 'text-[#1C1C1E]'
                            }`}>
                            {tpl.label}
                        </span>
                    </div>
                ))}
                {activeTemplates.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                        <FileType className="w-12 h-12 mb-4 opacity-20" />
                        <p>No templates available in this category</p>
                    </div>
                )}
            </div>
        )
    }

    const handleAction = () => {
        if (selectedCategory === 'Recent' || selectedCategory === 'Demo Projects') {
            if (selectedProjectId) onOpenProject(selectedProjectId)
        } else {
            onChoose(settings)
        }
    }

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#F2F2F7] w-full max-w-[900px] h-[650px] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#1C1C1E]">

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-[200px] bg-[#D1D1D6] border-r border-[#AEAEB2] flex flex-col pt-6">
                        <div className="flex-1 px-2 space-y-0.5">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryClick(cat.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${selectedCategory === cat.id
                                        ? 'bg-[#007AFF] text-white shadow-sm'
                                        : 'text-[#1C1C1E] hover:bg-black/5'
                                        }`}
                                >
                                    <cat.icon className={`w-4 h-4 ${selectedCategory === cat.id ? 'text-white' : 'text-[#8E8E93]'}`} />
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-4 mt-auto">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-black/5 text-[12px] font-medium text-[#1C1C1E]">
                                <Folder className="w-4 h-4 text-[#8E8E93]" />
                                Get More Sounds
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col bg-white">
                        <div className="text-center py-4 border-b border-[#E5E5EA]">
                            <h2 className="text-[14px] font-bold text-[#1C1C1E]">
                                {selectedCategory === 'Recent' ? 'Recent Projects' : selectedCategory === 'Demo Projects' ? 'Demo Projects' : 'Choose a Project'}
                            </h2>
                        </div>

                        <div className="flex-1 p-8 overflow-y-auto">
                            {renderMainContent()}
                        </div>

                        {/* Details Drawer */}
                        {(selectedCategory === 'New Project' || selectedCategory === 'Live Loops Grids' || selectedCategory === 'Project Templates') && (
                            <div className="border-t border-[#E5E5EA] bg-[#F2F2F7]">
                                <button
                                    onClick={() => setDetailsExpanded(!detailsExpanded)}
                                    className="w-full h-8 flex items-center px-4 gap-2 hover:bg-black/[0.03] transition-colors"
                                >
                                    <ChevronRight className={`w-3.5 h-3.5 text-[#8E8E93] transition-transform ${detailsExpanded ? 'rotate-90' : ''}`} />
                                    <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">Details</span>
                                    <div className="flex-1 flex justify-center">
                                        <span className="text-[11px] text-[#8E8E93] italic">
                                            {getCurrentTemplates().find(t => t.id === selectedTemplate)?.description}
                                        </span>
                                    </div>
                                </button>

                                {detailsExpanded && (
                                    <div className="p-6 grid grid-cols-2 gap-x-12 gap-y-4 animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-28">Project format:</label>
                                                <select
                                                    value={settings.projectFormat}
                                                    onChange={(e) => setSettings({ ...settings, projectFormat: e.target.value })}
                                                    className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px] focus:outline-none focus:border-[#007AFF]"
                                                >
                                                    <option value="stereo">Stereo</option>
                                                    <option value="surround">Surround</option>
                                                    <option value="dolby-atmos">Spatial Audio (Dolby Atmos)</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-28">Spatial Audio:</label>
                                                <select
                                                    value={settings.spatialAudioMode}
                                                    onChange={(e) => setSettings({ ...settings, spatialAudioMode: e.target.value })}
                                                    className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px] focus:outline-none focus:border-[#007AFF]"
                                                >
                                                    <option value="Off">Off</option>
                                                    <option value="Dolby Atmos">Dolby Atmos</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-28">Surround format:</label>
                                                <select
                                                    value={settings.surroundFormat}
                                                    onChange={(e) => setSettings({ ...settings, surroundFormat: e.target.value })}
                                                    className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px] focus:outline-none focus:border-[#007AFF]"
                                                >
                                                    <option>Quadraphonic</option>
                                                    <option>LCR (Pro Logic)</option>
                                                    <option>5.1 (ITU 775)</option>
                                                    <option>6.1 (ES/EX)</option>
                                                    <option>7.1</option>
                                                    <option>7.1 (SDDS)</option>
                                                    <option>5.1.2</option>
                                                    <option>5.1.4</option>
                                                    <option>7.1.2</option>
                                                    <option>7.1.4</option>
                                                </select>
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={settings.useMusicalGrid} onChange={(e) => setSettings({ ...settings, useMusicalGrid: e.target.checked })} className="rounded text-[#007AFF] focus:ring-0" />
                                                <span className="text-[12px]">Use musical grid</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={settings.useFlexTime} onChange={(e) => setSettings({ ...settings, useFlexTime: e.target.checked })} className="rounded text-[#007AFF] focus:ring-0" />
                                                <span className="text-[12px]">Use Flex Time</span>
                                            </label>

                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24">Tempo:</label>
                                                <div className="flex-1 flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={settings.tempo}
                                                        onChange={(e) => setSettings({ ...settings, tempo: parseInt(e.target.value) })}
                                                        className="w-16 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px] focus:outline-none focus:border-[#007AFF]"
                                                    />
                                                    <button className="h-6 px-2 bg-white border border-[#D1D1D6] rounded text-[10px] font-medium hover:bg-gray-50 active:bg-gray-100">Tap Tempo</button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24">Key Signature:</label>
                                                <select
                                                    value={settings.keySignature}
                                                    onChange={(e) => setSettings({ ...settings, keySignature: e.target.value })}
                                                    className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px] focus:outline-none focus:border-[#007AFF]"
                                                >
                                                    <option>C Major</option>
                                                    <option>C minor</option>
                                                    <option>G Major</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24">Time Signature:</label>
                                                <div className="flex-1 flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={4}
                                                        className="w-8 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px]"
                                                    />
                                                    <span className="text-[12px]">/</span>
                                                    <input
                                                        type="number"
                                                        value={4}
                                                        className="w-8 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24">Input Device:</label>
                                                <select
                                                    className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px]"
                                                    value={settings.inputDevice}
                                                >
                                                    <option>System Setting</option>
                                                    <option>Built-in Microphone</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24">Output Device:</label>
                                                <select className="flex-1 h-6 bg-white border border-[#D1D1D6] rounded px-1 text-[12px]">
                                                    <option>System Setting</option>
                                                    <option>Built-in Output</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 pt-2">
                                                <label className="text-[12px] w-24 text-[#8E8E93]">Sample Rate:</label>
                                                <select className="flex-1 h-6 bg-transparent text-[12px] text-[#8E8E93]">
                                                    <option>44.1 kHz</option>
                                                    <option>48 kHz</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between gap-4">
                                                <label className="text-[12px] w-24 text-[#8E8E93]">Frame Rate:</label>
                                                <select className="flex-1 h-6 bg-transparent text-[12px] text-[#8E8E93]">
                                                    <option>25 fps</option>
                                                    <option>24 fps</option>
                                                    <option>30 fps</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-14 bg-[#F2F2F7] border-t border-[#AEAEB2] px-4 flex items-center justify-between">
                    <div className="px-3 py-1.5 rounded-md border border-[#D1D1D6] bg-gray-100 text-[13px] text-gray-400 cursor-not-allowed">
                        Open an existing project... <span className="text-[10px] ml-1">(use dashboard)</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-1.5 rounded-md border border-[#D1D1D6] bg-white text-[13px] hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAction}
                            className="px-6 py-1.5 rounded-md bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0071E3] transition-colors shadow-sm"
                        >
                            {selectedCategory === 'Recent' || selectedCategory === 'Demo Projects' ? 'Open' : 'Choose'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
