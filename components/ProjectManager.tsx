"use client"
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

export function ProjectManager() {
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
    const [saveMode, setSaveMode] = useState<'SaveAs' | 'SaveCopy'>('SaveAs')

    const handleCreateAlternative = () => {
        const altName = prompt("Alternative Name:", `Alt ${alternatives.length + 1}`);
        if (altName) addAlternative(altName);
    }

    const onSaveDialogSubmit = (data: SaveData) => {
        if (saveMode === 'SaveAs') {
            saveAs(data);
        } else {
            saveCopyAs(data);
        }
        setShowSaveAs(false);
    }

    const handleSaveAsTemplate = () => {
        const templateName = prompt("Enter template name:", name);
        if (templateName) saveAsTemplate(templateName);
    }

    const handleCloseProject = () => {
        if (isDirty) {
            if (confirm("You have unsaved changes. Save before closing?")) {
                saveProject('user-1');
            }
        }
        closeProject();
        setShowMenu(false);
    }

    return (
        <div className="relative">
            {/* Desktop Project Name LCD Area */}
            <div
                className="flex items-center gap-3 px-4 py-1.5 bg-[#000] border border-[#333] rounded-md shadow-inner cursor-pointer hover:border-sky-500/40 group active:scale-95 transition-all"
                onClick={() => setShowMenu(!showMenu)}
            >
                <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white/90 group-hover:text-white uppercase tracking-wider truncate max-w-[120px]">
                        {name}{isDirty ? '*' : ''}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-sky-500/80 uppercase tracking-tighter">
                            {alternatives.find(a => a.id === currentAlternativeId)?.name || 'Main'}
                        </span>
                        <ChevronDown className="w-2.5 h-2.5 text-gray-700" />
                    </div>
                </div>
            </div>

            {/* Logic Professional Alternatives & Project Menu */}
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
                        <button onClick={() => { saveProject('user-1'); setShowMenu(false); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black text-gray-400 hover:text-white hover:bg-white/5 rounded transition-all group">
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

            <style jsx>{`
                .custom-scrollbar-v::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-v::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-v::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
            `}</style>
        </div>
    )
}
