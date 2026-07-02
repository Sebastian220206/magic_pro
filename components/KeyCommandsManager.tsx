"use client"

import React, { useMemo, useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { UploadCloud, DownloadCloud, RefreshCw, Key, Search } from 'lucide-react'

const normalizeShortcut = (shortcut: string) => shortcut.trim().replace(/\s+/g, ' ')

export function KeyCommandsManager() {
    const {
        globalSettings,
        projectKeyCommands,
        assignKeyCommand,
        removeKeyCommand,
        resetKeyCommands,
        importKeyCommands,
        exportKeyCommands,
        assignProjectKeyCommand,
        removeProjectKeyCommand,
        resetProjectKeyCommands,
        importProjectKeyCommands,
        exportProjectKeyCommands,
    } = useProjectStore()

    const [scope, setScope] = useState<'effective' | 'global' | 'project'>('effective')
    const [selectedCategory, setSelectedCategory] = useState<'All' | string>('All')
    const [search, setSearch] = useState('')
    const [importPayload, setImportPayload] = useState('')
    const [statusMessage, setStatusMessage] = useState('')

    const effectiveCommands = useMemo(() => {
        const global = globalSettings.keyCommands
        const proj = projectKeyCommands.length ? projectKeyCommands : []
        const projectMap = new Map(proj.map(c => [c.id, c]))
        const source = proj.length ? proj : global
        if (!proj.length) return global
        return global.map(g => projectMap.get(g.id) || g)
    }, [globalSettings.keyCommands, projectKeyCommands])

    const candidates = useMemo(() => {
        const source = scope === 'global' ? globalSettings.keyCommands : scope === 'project' ? projectKeyCommands : effectiveCommands
        const query = search.toLowerCase()
        return source.filter(cmd => {
            const category = cmd.category || 'Other'
            if (selectedCategory !== 'All' && category !== selectedCategory) return false
            if (query && !(cmd.name.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query) || cmd.id.toLowerCase().includes(query))) return false
            return true
        })
    }, [scope, selectedCategory, search, globalSettings.keyCommands, projectKeyCommands, effectiveCommands])

    const categories = useMemo(() => {
        const all = new Set<string>(['All'])
        globalSettings.keyCommands.forEach(cmd => all.add(cmd.category || 'Other'))
        projectKeyCommands.forEach(cmd => all.add(cmd.category || 'Other'))
        return Array.from(all)
    }, [globalSettings.keyCommands, projectKeyCommands])

    const getCurrentShortcut = (cmdId: string) => {
        const proj = projectKeyCommands.find(cmd => cmd.id === cmdId)
        if (proj) return proj.shortcut
        const glob = globalSettings.keyCommands.find(cmd => cmd.id === cmdId)
        return glob?.shortcut || ''
    }

    const handleAssign = (cmdId: string, raw: string) => {
        const shortcut = normalizeShortcut(raw)
        if (!shortcut) {
            if (scope === 'project') {
                removeProjectKeyCommand(cmdId)
            } else {
                removeKeyCommand(cmdId)
            }
            setStatusMessage('Shortcut cleared.')
            return
        }

        const allCommands = effectiveCommands
        const existing = allCommands.find(k => k.shortcut.toLowerCase() === shortcut.toLowerCase())
        if (existing && existing.id !== cmdId) {
            setStatusMessage(`Conflict: '${shortcut}' already used by '${existing.name}'.`)
            return
        }

        if (scope === 'project' || (scope === 'effective' && projectKeyCommands.length > 0)) {
            assignProjectKeyCommand(cmdId, shortcut)
        } else {
            assignKeyCommand(cmdId, shortcut)
        }

        setStatusMessage(`Assigned ${shortcut} to command`)
    }

    const handleImport = (forProject: boolean) => {
        try {
            const payload = JSON.parse(importPayload) as any[]
            if (!Array.isArray(payload)) throw new Error('Import data must be an array of key commands.')
            if (forProject) {
                importProjectKeyCommands(payload)
            } else {
                importKeyCommands(payload)
            }
            setStatusMessage('Imported key commands successfully.')
        } catch (err) {
            setStatusMessage(`Import failed: ${err instanceof Error ? err.message : 'invalid JSON'}`)
        }
    }

    const downloadFile = (filename: string, content: string) => {
        if (typeof window === 'undefined') return
        const blob = new Blob([content], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
        setStatusMessage(`Exported ${filename}`)
    }

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-start">
                <div className="space-x-2 flex flex-wrap items-center">
                    <button onClick={() => setScope('effective')} className={`px-2 py-1 rounded ${scope === 'effective' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Effective</button>
                    <button onClick={() => setScope('global')} className={`px-2 py-1 rounded ${scope === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Global</button>
                    <button onClick={() => setScope('project')} className={`px-2 py-1 rounded ${scope === 'project' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Project</button>
                    <span className="text-xs text-gray-500">Current scope decides store operation.</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { resetKeyCommands(); setStatusMessage('Global defaults restored.') }} className="px-2 py-1 bg-white border rounded flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Global Default</button>
                    <button onClick={() => { resetProjectKeyCommands(); setStatusMessage('Project defaults restored.') }} className="px-2 py-1 bg-white border rounded flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Project Default</button>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                    className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Search commands"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm">
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>

            <div className="mb-2 text-xs text-gray-500">{statusMessage}</div>

            <div className="overflow-auto max-h-[340px] border rounded bg-white">
                <table className="w-full text-[12px]">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="p-2 text-left">Command</th>
                            <th className="p-2 text-left">Category</th>
                            <th className="p-2 text-left">Description</th>
                            <th className="p-2 text-left">Assigned</th>
                            <th className="p-2 text-left">Set</th>
                        </tr>
                    </thead>
                    <tbody>
                        {candidates.map(cmd => {
                            const existing = effectiveCommands.find(c => c.id === cmd.id)
                            const conflict = existing && existing.shortcut && existing.shortcut !== cmd.shortcut && existing.shortcut.toLowerCase() === cmd.shortcut.toLowerCase()
                            return (
                                <tr key={cmd.id} className={conflict ? 'bg-red-50' : ''}>
                                    <td className="p-2 whitespace-nowrap font-semibold">{cmd.name}</td>
                                    <td className="p-2 whitespace-nowrap">{cmd.category || 'Other'}</td>
                                    <td className="p-2 text-gray-600">{cmd.description}</td>
                                    <td className="p-2 whitespace-nowrap">{getCurrentShortcut(cmd.id) || <span className="text-gray-400">(none)</span>}</td>
                                    <td className="p-2">
                                        <input
                                            className="w-full border border-gray-300 rounded px-1 py-0.5 text-[12px]"
                                            value={getCurrentShortcut(cmd.id)}
                                            onChange={e => handleAssign(cmd.id, e.target.value)}
                                            placeholder="e.g. Ctrl+Shift+P"
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => downloadFile('keycommands-global.json', exportKeyCommands())} className="px-2 py-2 bg-white border rounded flex items-center justify-center gap-1"><DownloadCloud className="w-4 h-4" /> Export Global</button>
                <button onClick={() => downloadFile('keycommands-project.json', exportProjectKeyCommands())} className="px-2 py-2 bg-white border rounded flex items-center justify-center gap-1"><DownloadCloud className="w-4 h-4" /> Export Project</button>
                <button onClick={() => { navigator.clipboard.writeText(exportProjectKeyCommands()); setStatusMessage('Project key commands copied to clipboard'); }} className="px-2 py-2 bg-white border rounded flex items-center justify-center gap-1"><Key className="w-4 h-4" /> Copy Project</button>
            </div>

            <div className="flex gap-2 items-start pt-2">
                <textarea
                    className="flex-1 border border-gray-300 rounded p-2 text-xs h-24"
                    placeholder="Paste JSON here to import"
                    value={importPayload}
                    onChange={e => setImportPayload(e.target.value)}
                />
                <div className="flex flex-col gap-1">
                    <button onClick={() => handleImport(false)} className="px-2 py-1 bg-white border rounded flex items-center justify-center gap-1"><UploadCloud className="w-4 h-4" /> Import Global</button>
                    <button onClick={() => handleImport(true)} className="px-2 py-1 bg-white border rounded flex items-center justify-center gap-1"><UploadCloud className="w-4 h-4" /> Import Project</button>
                </div>
            </div>
        </div>
    )
}
