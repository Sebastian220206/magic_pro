"use client"
import { useRouter } from "next/navigation"
import { useProjectStore } from "@/store/projectStore"
import {
    ChevronDown, Save, Share,
    Copy, Trash, Check,
    Settings, Music, Plus,
} from "lucide-react"
import { useState } from "react"
import { useProjectFileActions } from "@/hooks/useProjectFileActions"
import { BounceDialog } from "./BounceDialog"
import { ProjectInfoDialog } from "./ProjectInfoDialog"
import { ImportProjectDialog } from "./ImportProjectDialog"
import { SaveDialog, SaveData } from "./SaveDialog"

export function ProjectManager({ compact = false }: { compact?: boolean } = {}) {
    // The file commands moved to `useProjectFileActions`; what is left here is
    // what this popover is actually about — the project's alternatives.
    const {
        name, alternatives, currentAlternativeId,
        addAlternative, switchToAlternative, saveAs, saveCopyAs,
        // Still used here: the dot beside the project name.
        isDirty,
    } = useProjectStore()

    const [showMenu, setShowMenu] = useState(false)
    const { commands } = useProjectFileActions()
    const projectFileDialog = useProjectStore(s => s.projectFileDialog)
    const setProjectFileDialog = useProjectStore(s => s.setProjectFileDialog)
    const projectExportStatus = useProjectStore(s => s.projectExportStatus)
    const router = useRouter()

    const handleCreateAlternative = () => {
        const altName = prompt("Alternative Name:", `Alt ${alternatives.length + 1}`);
        if (altName) addAlternative(altName);
    }

    const onSaveDialogSubmit = async (data: SaveData) => {
        try {
            if (projectFileDialog === 'saveAs') {
                await saveAs(data);
                setProjectFileDialog('none');
                const newId = useProjectStore.getState().id;
                if (newId) router.push(`/project/${newId}`);
            } else {
                await saveCopyAs(data);
                setProjectFileDialog('none');
            }
        } catch (e) {
            console.error('Save failed:', e);
            alert('Failed to save project. Check console for details.');
        }
    }

    const alternativeName = alternatives.find(a => a.id === currentAlternativeId)?.name || 'Main';

    return (
        <div className="relative group/proj">
            {/*
              * The project menu's trigger.
              *
              * `compact` is the menu-bar form: one line, 24px tall. The two-line
              * LCD form used to sit inside the transport display; this is the
              * only route to Save a Copy As, Save as Template, Export as WAV,
              * Import Project Settings, Project Information, Revert and the
              * alternatives list, so it moved rather than being deleted.
              */}
            {compact ? (
                <button
                    data-project-menu
                    onClick={() => setShowMenu(!showMenu)}
                    title={`${name}${isDirty ? ' (unsaved changes)' : ''} — project menu`}
                    className="flex items-center gap-1.5 px-2 h-full text-[11px] font-bold text-studio-text hover:bg-white/10 transition-colors"
                >
                    <span className="truncate max-w-[160px]">{name}{isDirty ? '*' : ''}</span>
                    <span className="text-[9px] text-studio-text-dim uppercase tracking-wider">{alternativeName}</span>
                    <ChevronDown className="w-3 h-3 text-studio-text-dim" />
                </button>
            ) : (
                <div
                    className="flex flex-col justify-center px-3 h-full border-r border-white/10 cursor-pointer hover:bg-white/[0.03] transition-colors"
                    data-project-menu
                    onClick={() => setShowMenu(!showMenu)}
                >
                    <div className="flex flex-col -gap-0.5">
                        <span className="text-[10px] font-black text-white/90 group-hover/proj:text-accent-cyan uppercase tracking-widest truncate max-w-[140px]">
                            {name}{isDirty ? '*' : ''}
                        </span>
                        <div className="flex items-center gap-1 opacity-60">
                            <span className="text-[7px] font-bold text-studio-text-mid uppercase tracking-wider">
                                {alternativeName}
                            </span>
                            <ChevronDown className="w-2 h-2 text-studio-text-dim" />
                        </div>
                    </div>
                </div>
            )}

            {/* Magic Professional Alternatives & Project Menu */}
            {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-[240px] bg-studio-panel border border-black shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-md overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Alternatives Section */}
                    <div className="p-2 border-b border-black bg-black/20">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <span className="text-[10px] font-black text-studio-text-dim uppercase tracking-widest">Alternatives</span>
                            <button onClick={handleCreateAlternative} className="p-1 hover:bg-accent-cyan/20 rounded transition-all"><Plus className="w-3.5 h-3.5 text-accent-cyan" /></button>
                        </div>
                        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto custom-scrollbar-v pr-1">
                            <div
                                onClick={() => { switchToAlternative('main'); setShowMenu(false); }}
                                className={`flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-black ${!currentAlternativeId ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-studio-text-mid hover:bg-white/5 hover:text-white'} cursor-pointer transition-all`}
                            >
                                <span>(Main Project)</span>
                                {!currentAlternativeId && <Check className="w-3.5 h-3.5" />}
                            </div>
                            {alternatives.map(alt => (
                                <div
                                    key={alt.id}
                                    onClick={() => { switchToAlternative(alt.id); setShowMenu(false); }}
                                    className={`flex items-center justify-between px-3 py-1.5 rounded text-[11px] font-black ${currentAlternativeId === alt.id ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-studio-text-mid hover:bg-white/5 hover:text-white'} cursor-pointer transition-all`}
                                >
                                    <span className="truncate">{alt.name}</span>
                                    {currentAlternativeId === alt.id && <Check className="w-3.5 h-3.5" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Project Management Section */}
                    {/*
                        One list, shared with the File menu in the menu bar.
                        These commands used to be written out here and nowhere
                        else, which made this popover — a menu about project
                        alternatives — the only route to Export as WAV, Bounce
                        and Close Project.
                    */}
                    <div className="p-1">
                        {commands.map(cmd => (
                            <div key={cmd.id}>
                                {cmd.separatorBefore && <div className="h-[1px] bg-black/30 my-1 mx-2" />}
                                <button
                                    onClick={() => { cmd.run(); setShowMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-black rounded transition-all group ${cmd.destructive
                                        ? 'text-studio-text-mid hover:text-red-400 hover:bg-red-500/5'
                                        : 'text-studio-text-mid hover:text-white hover:bg-white/5'}`}
                                >
                                    <cmd.icon className={`w-3.5 h-3.5 text-studio-text-dim ${cmd.destructive ? 'group-hover:text-red-500' : 'group-hover:text-accent-cyan'}`} />
                                    <span>{cmd.label}</span>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="bg-studio-sunken border-t border-black p-2 flex items-center justify-between">
                        <span className="text-[9px] font-black text-studio-text-dim uppercase tracking-widest leading-none">Rev 1.0.4</span>
                        <div className="flex gap-1.5 overflow-hidden">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan/40"></div>
                        </div>
                    </div>
                </div>
            )}

            {/*
                Modals.
                Which one is open lives in the store, because the File menu in
                the menu bar opens the same dialogs and this component is the
                one that renders them.
            */}
            {projectFileDialog === 'bounce' && <BounceDialog onClose={() => setProjectFileDialog('none')} />}
            {(projectFileDialog === 'saveAs' || projectFileDialog === 'saveCopy') && (
                <SaveDialog
                    projectName={name}
                    onClose={() => setProjectFileDialog('none')}
                    onSave={onSaveDialogSubmit}
                />
            )}
            {projectFileDialog === 'info' && <ProjectInfoDialog onClose={() => setProjectFileDialog('none')} />}
            {projectFileDialog === 'import' && <ImportProjectDialog onClose={() => setProjectFileDialog('none')} />}

            {/* Export progress overlay */}
            {projectExportStatus !== null && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
                    <div className="bg-studio-panel border border-black rounded-lg p-8 flex flex-col items-center gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                        <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-bold text-studio-text">{projectExportStatus || 'Exporting...'}</span>
                        <span className="text-[10px] text-studio-text-dim">Please wait, this may take a moment</span>
                    </div>
                </div>
            )}


        </div>
    )
}
