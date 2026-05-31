"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useProjectStore } from "@/store/projectStore"
import {
    ChevronDown, Save, Share,
    Copy, Trash, Check,
    Download, Settings,
    FileText, Music,
    Layers, Plus, RotateCcw, X
} from "lucide-react"
import { useState } from "react"
import { BounceDialog } from "./BounceDialog"
import { ProjectInfoDialog } from "./ProjectInfoDialog"
import { ImportProjectDialog } from "./ImportProjectDialog"
import { SaveDialog, SaveData } from "./SaveDialog"
import { renderSongOffline } from "@/engine/export/OfflineRenderer"
import { encodeWav } from "@/engine/export/wavEncoder"

export function ProjectManager() {
    const { data: session } = useSession()
    const currentUserId = session?.user?.id || 'user-1'

    const {
        name, alternatives, currentAlternativeId,
        addAlternative, switchToAlternative,
        saveProject, saveAs, saveCopyAs, saveAsTemplate, revertTo,
        isDirty, closeProject
    } = useProjectStore()

    const [showMenu, setShowMenu] = useState(false)
    const [showBounce, setShowBounce] = useState(false)
    const [showSaveAs, setShowSaveAs] = useState(false)
    const [showProjectInfo, setShowProjectInfo] = useState(false)
    const [showImport, setShowImport] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState('')
    const [saveMode, setSaveMode] = useState<'SaveAs' | 'SaveCopy'>('SaveAs')
    const router = useRouter()

    const handleCreateAlternative = () => {
        const altName = prompt("Alternative Name:", `Alt ${alternatives.length + 1}`);
        if (altName) addAlternative(altName);
    }

    const onSaveDialogSubmit = async (data: SaveData) => {
        try {
            if (saveMode === 'SaveAs') {
                await saveAs(data, currentUserId);
                setShowSaveAs(false);
                const newId = useProjectStore.getState().id;
                if (newId) router.push(`/project/${newId}`);
            } else {
                await saveCopyAs(data, currentUserId);
                setShowSaveAs(false);
            }
        } catch (e) {
            console.error('Save failed:', e);
            alert('Failed to save project. Check console for details.');
        }
    }

    const handleSaveAsTemplate = () => {
        const templateName = prompt("Enter template name:", name);
        if (templateName) saveAsTemplate(templateName);
    }

    const handleExportWav = async () => {
        setExporting(true);
        setExportProgress('Preparing export...');
        setShowMenu(false);

        // Yield to event loop so the loading UI renders before heavy work
        await new Promise(r => setTimeout(r, 50));

        try {
            const state = useProjectStore.getState();
            const { tempo, tracks, clips, name } = state;

            if (!tempo || tempo <= 0) {
                throw new Error('Invalid project tempo');
            }

            setExportProgress('Mapping tracks and clips...');
            await new Promise(r => setTimeout(r, 10));

            const exportClips = clips.map(c => ({
                id: c.id,
                trackId: c.trackId,
                startBeat: c.startBeat ?? c.start,
                duration: c.duration,
                type: c.type as 'audio' | 'midi',
                offset: c.offset || 0,
                muted: c.muted || false,
                sampleId: c.sampleId,
                fileUrl: c.fileUrl,
                storageKey: (c as any).storageKey,
                playbackRate: c.playbackRate || 1,
                fadeIn: c.fadeIn ? { duration: c.fadeIn.duration } : undefined,
                fadeOut: c.fadeOut ? { duration: c.fadeOut.duration } : undefined,
                notes: c.notes,
            }));
            const exportTracks = tracks.map(t => ({
                id: t.id,
                name: t.name,
                volume: t.volume,
                pan: t.pan,
                muted: t.muted,
                soloed: t.soloed,
                instrument: t.instrument,
            }));

            setExportProgress('Rendering audio (this may take a moment)...');
            // Yield again so the progress message renders
            await new Promise(r => setTimeout(r, 10));

            console.time('[Export] Total render');
            const rendered = await renderSongOffline(exportClips, exportTracks, tempo);
            console.timeEnd('[Export] Total render');

            setExportProgress(`Rendered ${rendered.duration.toFixed(1)}s audio, encoding WAV...`);
            await new Promise(r => setTimeout(r, 10));

            console.log('[Export] Encoding WAV:', {
              channels: rendered.numberOfChannels,
              sampleRate: rendered.sampleRate,
              frames: rendered.length.toLocaleString(),
              duration: rendered.duration.toFixed(2),
            });
            console.time('[Export] WAV encode');
            const wavBlob = await encodeWav(rendered);
            console.timeEnd('[Export] WAV encode');
            const safeName = (name || 'export').replace(/[^a-zA-Z0-9]/g, '_');
            const url = URL.createObjectURL(wavBlob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[EXPORT DOWNLOAD]', `${safeName}.wav`);
        } catch (e) {
            console.error('[Export] Failed:', e);
            alert('Export failed. Check console for details.');
        } finally {
            setExporting(false);
            setExportProgress('');
        }
    };

    const handleCloseProject = () => {
        if (isDirty) {
            if (confirm("You have unsaved changes. Save before closing?")) {
                saveProject(currentUserId);
            }
        }
        closeProject();
        setShowMenu(false);
    }

    return (
        <div className="relative group/proj">
            {/* Desktop Project Name LCD Area - Integrated Style */}
            <div
                className="flex flex-col justify-center px-3 h-full border-r border-white/10 cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => setShowMenu(!showMenu)}
            >
                <div className="flex flex-col -gap-0.5">
                    <span className="text-[10px] font-black text-white/90 group-hover/proj:text-sky-400 uppercase tracking-widest truncate max-w-[140px]">
                        {name}{isDirty ? '*' : ''}
                    </span>
                    <div className="flex items-center gap-1 opacity-60">
                        <span className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">
                            {alternatives.find(a => a.id === currentAlternativeId)?.name || 'Main'}
                        </span>
                        <ChevronDown className="w-2 h-2 text-gray-600" />
                    </div>
                </div>
            </div>

            {/* Magic Professional Alternatives & Project Menu */}
            {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-[240px] bg-[#1a1a1a] border border-black shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-md overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Alternatives Section */}
                    <div className="p-2 border-b border-black bg-black/20">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alternatives</span>
                            <button onClick={handleCreateAlternative} className="p-1 hover:bg-sky-500/20 rounded transition-all"><Plus className="w-3.5 h-3.5 text-sky-500" /></button>
                        </div>
                        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto custom-scrollbar-v pr-1">
                            <div
                                onClick={() => { switchToAlternative('main'); setShowMenu(false); }}
                                className={`flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-black ${!currentAlternativeId ? 'bg-sky-500/10 text-sky-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'} cursor-pointer transition-all`}
                            >
                                <span>(Main Project)</span>
                                {!currentAlternativeId && <Check className="w-3.5 h-3.5" />}
                            </div>
                            {alternatives.map(alt => (
                                <div
                                    key={alt.id}
                                    onClick={() => { switchToAlternative(alt.id); setShowMenu(false); }}
                                    className={`flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-black ${currentAlternativeId === alt.id ? 'bg-sky-500/10 text-sky-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'} cursor-pointer transition-all`}
                                >
                                    <span className="truncate">{alt.name}</span>
                                    {currentAlternativeId === alt.id && <Check className="w-3.5 h-3.5" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Project Management Section */}
                    <div className="p-1">
                        <button onClick={() => { saveProject(currentUserId); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Save className="w-3.5 h-3.5 text-gray-600 group-hover:text-green-500" />
                            <span>Save Project</span>
                        </button>

                        <button onClick={() => { setSaveMode('SaveAs'); setShowSaveAs(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <FileText className="w-3.5 h-3.5 text-gray-600 group-hover:text-sky-500" />
                            <span>Save As...</span>
                        </button>

                        <button onClick={() => { setSaveMode('SaveCopy'); setShowSaveAs(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Copy className="w-3.5 h-3.5 text-gray-600 group-hover:text-sky-500" />
                            <span>Save a Copy As...</span>
                        </button>

                        <button onClick={handleExportWav} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-500" />
                            <span>Export as WAV...</span>
                        </button>

                        <button onClick={() => { handleSaveAsTemplate(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Layers className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-500" />
                            <span>Save as Template...</span>
                        </button>

                        <div className="h-[1px] bg-black/40 my-1 mx-2"></div>

                        <button onClick={() => { setShowImport(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-sky-500" />
                            <span>Import Project Settings...</span>
                        </button>

                        <button onClick={() => { setShowProjectInfo(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <FileText className="w-3.5 h-3.5 text-gray-600 group-hover:text-sky-500" />
                            <span>Project Information...</span>
                        </button>

                        <div className="h-[1px] bg-black/40 my-1 mx-2"></div>

                        <button onClick={() => { revertTo(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <RotateCcw className="w-3.5 h-3.5 text-gray-600 group-hover:text-orange-500" />
                            <span>Revert to Last Saved</span>
                        </button>

                        <div className="h-[1px] bg-black/40 my-1 mx-2"></div>

                        <button onClick={() => { setShowBounce(true); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
                            <Download className="w-3.5 h-3.5 text-gray-600 group-hover:text-sky-500" />
                            <span>Bounce Project (PCM)...</span>
                        </button>

                        <div className="h-[1px] bg-black/40 my-1 mx-2"></div>

                        <button onClick={handleCloseProject} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded transition-all group">
                            <X className="w-3.5 h-3.5 text-gray-600 group-hover:text-red-500" />
                            <span>Close Project</span>
                        </button>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-[#111] border-t border-black p-2 flex items-center justify-between">
                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest leading-none">Rev 1.0.4</span>
                        <div className="flex gap-1.5 overflow-hidden">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500/40"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showBounce && <BounceDialog onClose={() => setShowBounce(false)} />}
            {showSaveAs && (
                <SaveDialog
                    projectName={name}
                    onClose={() => setShowSaveAs(false)}
                    onSave={onSaveDialogSubmit}
                />
            )}
            {showProjectInfo && <ProjectInfoDialog onClose={() => setShowProjectInfo(false)} />}
            {showImport && <ImportProjectDialog onClose={() => setShowImport(false)} />}

            {/* Export progress overlay */}
            {exporting && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
                    <div className="bg-[#1a1a1a] border border-black rounded-lg p-8 flex flex-col items-center gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-bold text-gray-200">{exportProgress || 'Exporting...'}</span>
                        <span className="text-[10px] text-gray-500">Please wait, this may take a moment</span>
                    </div>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
