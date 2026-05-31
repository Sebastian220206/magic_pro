"use client"

import React, { useState } from 'react'
import { X, Folder, ChevronDown } from 'lucide-react'

interface SaveDialogProps {
    projectName: string
    onClose: () => void
    onSave: (data: SaveData) => void
}

export interface SaveData {
    name: string
    organization: 'Package' | 'Folder'
    assets: {
        audioFiles: boolean
        samplerData: boolean
        alchemyData: boolean
        ultrabeatData: boolean
        spaceDesignerIR: boolean
        movieFile: boolean
        appleSoundLibrary: boolean
    }
}

export function SaveDialog({ projectName, onClose, onSave }: SaveDialogProps) {
    const [name, setName] = useState(() => {
        const baseName = projectName || "Magic Pro Project";
        return baseName.endsWith('.magicx') ? baseName : `${baseName}.magicx`;
    })
    const [organization, setOrganization] = useState<'Package' | 'Folder'>('Package')
    const [assets, setAssets] = useState({
        audioFiles: true,
        samplerData: true,
        alchemyData: true,
        ultrabeatData: false,
        spaceDesignerIR: false,
        movieFile: false,
        appleSoundLibrary: false
    })

    const handleSave = () => {
        onSave({
            name,
            organization,
            assets
        })
    }

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="bg-[#F2F2F7] w-[600px] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#1C1C1E] animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="text-center py-3 border-b border-[#D1D1D6]">
                    <h2 className="text-[15px] font-bold">Save</h2>
                </div>

                {/* Main Content */}
                <div className="p-8 pb-4 space-y-6">
                    {/* File Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-[13px] text-[#8E8E93] w-20 text-right">Save As:</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                className="flex-1 bg-white border border-[#D1D1D6] rounded-md px-3 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="text-[13px] text-[#8E8E93] w-20 text-right">Tags:</label>
                            <div className="flex-1 bg-white border border-[#D1D1D6] rounded-md h-9"></div>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="text-[13px] text-[#8E8E93] w-20 text-right">Where:</label>
                            <div className="flex-1 flex items-center gap-2 bg-white border border-[#D1D1D6] rounded-md px-3 py-1.5 cursor-default">
                                <Folder className="w-4 h-4 text-[#007AFF]" />
                                <span className="text-[14px]">Logic</span>
                                <div className="ml-auto flex items-center">
                                    <div className="w-4 h-4 flex items-center justify-center bg-[#D1D1D6] rounded-sm ml-2">
                                        <ChevronDown className="w-3 h-3 text-[#1C1C1E] opacity-60" />
                                    </div>
                                    <div className="w-4 h-4 flex items-center justify-center bg-[#D1D1D6] rounded-sm ml-1 rotate-180">
                                        <ChevronDown className="w-3 h-3 text-[#1C1C1E] opacity-60" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[#D1D1D6] pt-6 space-y-6">
                        {/* Organization */}
                        <div className="flex items-start gap-4">
                            <label className="text-[13px] text-[#1C1C1E] font-medium w-48 text-right pt-0.5">Organize my project as a:</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative w-4 h-4 flex items-center justify-center">
                                        <input
                                            type="radio"
                                            name="org"
                                            checked={organization === 'Package'}
                                            onChange={() => setOrganization('Package')}
                                            className="appearance-none w-4 h-4 rounded-full border border-[#D1D1D6] checked:bg-[#007AFF] checked:border-[#007AFF] focus:outline-none transition-all cursor-pointer"
                                        />
                                        {organization === 'Package' && <div className="absolute w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className="text-[14px]">Package</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative w-4 h-4 flex items-center justify-center">
                                        <input
                                            type="radio"
                                            name="org"
                                            checked={organization === 'Folder'}
                                            onChange={() => setOrganization('Folder')}
                                            className="appearance-none w-4 h-4 rounded-full border border-[#D1D1D6] checked:bg-[#007AFF] checked:border-[#007AFF] focus:outline-none transition-all cursor-pointer"
                                        />
                                        {organization === 'Folder' && <div className="absolute w-1.5 h-1.5 bg-white rounded-full"></div>}
                                    </div>
                                    <span className="text-[14px]">Folder</span>
                                </label>
                            </div>
                        </div>

                        {/* Assets */}
                        <div className="flex items-start gap-4">
                            <label className="text-[13px] text-[#1C1C1E] font-medium w-48 text-right pt-0.5">Copy the following files into your project:</label>
                            <div className="space-y-2">
                                {[
                                    { key: 'audioFiles', label: 'Audio files' },
                                    { key: 'samplerData', label: 'Sampler audio data' },
                                    { key: 'alchemyData', label: 'Alchemy audio data' },
                                    { key: 'ultrabeatData', label: 'Ultrabeat audio data' },
                                    { key: 'spaceDesignerIR', label: 'Space Designer impulse responses' },
                                    { key: 'movieFile', label: 'Movie file' },
                                    { key: 'appleSoundLibrary', label: 'Include Apple Sound Library Content' },
                                ].map((item) => (
                                    <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={assets[item.key as keyof typeof assets]}
                                            onChange={(e) => setAssets({ ...assets, [item.key]: e.target.checked })}
                                            className="w-4 h-4 rounded border-[#D1D1D6] text-[#007AFF] focus:ring-0 transition-all cursor-pointer"
                                        />
                                        <span className="text-[14px]">{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-transparent flex justify-end gap-3 mt-4 border-t border-transparent">
                    <button
                        onClick={onClose}
                        className="px-6 py-1.5 rounded-md border border-[#D1D1D6] bg-white text-[13px] hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-1.5 rounded-md bg-[#007AFF] text-white text-[13px] font-semibold hover:bg-[#0071E3] active:bg-[#0051A3] transition-colors shadow-sm"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
