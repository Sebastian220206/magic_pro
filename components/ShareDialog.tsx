"use client"

import { useState } from "react"
import { useProjectStore } from "@/store/projectStore"
import { X, Share2, Download } from "lucide-react"

export function ShareDialog() {
    const { showShareDialog, toggleShareDialog, shareProject, name } = useProjectStore();

    const [mode, setMode] = useState<'project' | 'song' | 'aaf' | 'xml' | 'musicxml'>('project');
    const [destination, setDestination] = useState<'download' | 'web-share'>('download');
    const [copyAssets, setCopyAssets] = useState(true);
    const [compressPackage, setCompressPackage] = useState(true);
    const [customName, setCustomName] = useState('');

    if (!showShareDialog) return null;

    const onSubmit = async () => {
        await shareProject({
            format: mode,
            destination,
            includeAssets: copyAssets,
            compress: compressPackage,
            customName: customName || `${name || 'Untitled'}_Share`
        });
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9000] flex items-center justify-center p-4">
            <div className="bg-[#2c2c2e] w-full max-w-2xl rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col overflow-hidden animate-in fade-in duration-200">
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-white">Share Project</h2>
                    <button onClick={() => toggleShareDialog(false)} className="p-2 text-gray-400 hover:text-white rounded-full"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-200">
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-gray-400">Share As</label>
                        <select value={mode} onChange={e => setMode(e.target.value as any)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2"> 
                            <option value="project">Project Package (dawproj)</option>
                            <option value="song">Song Mixdown (audio file)</option>
                            <option value="aaf">AAF File</option>
                            <option value="xml">Final Cut Pro XML</option>
                            <option value="musicxml">MusicXML</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-gray-400">Destination</label>
                        <select value={destination} onChange={e => setDestination(e.target.value as any)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2">
                            <option value="download">Download to Disk</option>
                            <option value="web-share">Use Web Share/API (if available)</option>
                        </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="block text-xs font-semibold uppercase text-gray-400">File Name</label>
                        <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder={`${name || 'Untitled'}_Share`} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 placeholder:text-gray-500" />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-semibold uppercase text-gray-400">Options</label>
                        <div className="flex items-center gap-2">
                            <input id="assets" type="checkbox" checked={copyAssets} onChange={() => setCopyAssets(!copyAssets)} />
                            <label htmlFor="assets" className="text-xs">Include all project assets in package</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input id="compress" type="checkbox" checked={compressPackage} onChange={() => setCompressPackage(!compressPackage)} />
                            <label htmlFor="compress" className="text-xs">Compress package (recommended for cross-platform)</label>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2">
                    <button onClick={() => toggleShareDialog(false)} className="px-4 py-2 text-sm font-bold uppercase text-gray-400 border border-white/10 rounded-xl hover:text-white">Cancel</button>
                    <button onClick={onSubmit} className="px-5 py-2 flex items-center gap-2 text-sm font-bold uppercase text-white bg-sky-500 rounded-xl hover:bg-sky-400">
                        <Share2 className="w-4 h-4" />
                        Share
                    </button>
                </div>
            </div>
        </div>
    )
}
