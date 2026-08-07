'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import type { WamCatalogEntry } from '@/app/api/wam-registry/route';

interface PluginBrowserProps {
    trackId: string;
    /**
     * Which half of the catalogue to offer. Instruments and effects are
     * different actions — one replaces what the track plays, the other adds to
     * its chain — so they are reached from different places in the UI.
     */
    mode?: 'all' | 'instrument' | 'effect';
    onClose: () => void;
}

/**
 * Browse and install Web Audio Module plugins.
 *
 * The catalogue is served by `/api/wam-registry`, which rewrites every plugin
 * path to a proxied URL — so the client never sees or chooses an upstream host.
 */
export function PluginBrowser({ trackId, mode = 'all', onClose }: PluginBrowserProps) {
    const addWamPlugin = useProjectStore(s => s.addWamPlugin);
    const setWamInstrument = useProjectStore(s => s.setWamInstrument);

    const [entries, setEntries] = useState<WamCatalogEntry[]>([]);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string>('');
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<string>('All');
    const [installing, setInstalling] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch('/api/wam-registry');
                if (!res.ok) throw new Error(`Catalogue unavailable (${res.status})`);
                const data = await res.json();
                if (cancelled) return;
                setEntries(data.plugins ?? []);
                setState('ready');
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Could not load plugins');
                setState('error');
            }
        })();

        return () => { cancelled = true; };
    }, []);

    /** Entries the current mode allows, before search and category filters. */
    const inScope = useMemo(() => {
        if (mode === 'instrument') return entries.filter(e => e.isInstrument);
        if (mode === 'effect') return entries.filter(e => !e.isInstrument);
        return entries;
    }, [entries, mode]);

    const categories = useMemo(() => {
        const seen = new Set<string>();
        inScope.forEach(e => e.categories.forEach(c => seen.add(c)));
        return ['All', ...Array.from(seen).sort()];
    }, [inScope]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return inScope.filter(e => {
            if (category !== 'All' && !e.categories.includes(category)) return false;
            if (!q) return true;
            return e.name.toLowerCase().includes(q)
                || e.vendor.toLowerCase().includes(q)
                || e.description?.toLowerCase().includes(q)
                || e.keywords.some(k => k.toLowerCase().includes(q));
        });
    }, [inScope, query, category]);

    const install = async (entry: WamCatalogEntry) => {
        setInstalling(entry.identifier);
        const ref = { identifier: entry.identifier, name: entry.name, url: entry.url };

        try {
            if (entry.isInstrument) {
                // Instruments generate sound from MIDI and have no audio input,
                // so they replace the track's instrument rather than joining
                // the insert chain.
                const ok = await setWamInstrument(trackId, ref);
                if (!ok) setError(`${entry.name} could not be loaded.`);
            } else {
                addWamPlugin(trackId, ref);
                // The chain builds asynchronously; keep the button disabled
                // briefly so a double-click doesn't add it twice.
                await new Promise(r => setTimeout(r, 700));
            }
        } finally {
            setInstalling(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[860px] max-w-[94vw] h-[620px] max-h-[88vh] bg-[#1c1c1f] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <span className="text-[12px] font-bold text-gray-200">
                        {mode === 'instrument' ? 'Instruments' : mode === 'effect' ? 'Audio Effects' : 'Plugins'}
                    </span>
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search…"
                            className="w-full bg-black/40 border border-white/10 rounded pl-7 pr-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-sky-500/50"
                        />
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-auto p-1 text-gray-500 hover:text-white transition-colors"
                        aria-label="Close plugin browser"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 overflow-x-auto shrink-0">
                    {categories.map(c => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`px-2.5 py-1 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${category === c ? 'bg-sky-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {state === 'loading' && (
                        <div className="flex items-center justify-center h-full text-gray-500 text-[11px] gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading plugin catalogue…
                        </div>
                    )}

                    {state === 'error' && (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                            <p className="text-[11px] text-red-400">{error}</p>
                            <p className="text-[10px] text-gray-500">
                                Plugins are fetched through this app; check your connection.
                            </p>
                        </div>
                    )}

                    {state === 'ready' && (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {visible.map(entry => (
                                <div
                                    key={entry.identifier}
                                    className="bg-black/30 border border-white/5 rounded-lg p-3 flex flex-col gap-2 hover:border-sky-500/40 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold text-gray-100 truncate">{entry.name}</div>
                                            <div className="text-[10px] text-gray-500 truncate">{entry.vendor}</div>
                                        </div>
                                        {entry.isInstrument && (
                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                                                INST
                                            </span>
                                        )}
                                    </div>

                                    {entry.description && (
                                        <p className="text-[10px] text-gray-500 line-clamp-2">{entry.description}</p>
                                    )}

                                    <button
                                        onClick={() => install(entry)}
                                        disabled={installing === entry.identifier}
                                        title={entry.isInstrument
                                            ? 'Replaces this track\'s instrument'
                                            : 'Adds to this track\'s insert chain'}
                                        className="mt-auto px-2 py-1 rounded text-[10px] font-bold bg-white/5 text-gray-300 hover:bg-sky-500 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-gray-300 transition-colors"
                                    >
                                        {installing === entry.identifier
                                            ? 'Loading…'
                                            : entry.isInstrument ? 'Load' : 'Add'}
                                    </button>
                                </div>
                            ))}

                            {visible.length === 0 && (
                                <div className="col-span-full py-16 text-center text-[11px] text-gray-600">
                                    No plugins match that search.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <footer className="px-4 py-2 border-t border-white/5 text-[10px] text-gray-600 shrink-0">
                    {state === 'ready' && `${visible.length} of ${entries.length} plugins`}
                </footer>
            </div>
        </div>
    );
}
