"use client"
import { useRouter } from "next/navigation"
import { useProjectStore } from "@/store/projectStore"
import { BounceDialog } from "./BounceDialog"
import { ProjectInfoDialog } from "./ProjectInfoDialog"
import { ImportProjectDialog } from "./ImportProjectDialog"
import { SaveDialog, SaveData } from "./SaveDialog"

/**
 * The dialogs the project-file commands open, and nothing else.
 *
 * These used to hang off `ProjectManager`, which was rendered inside the
 * simulated menu bar. That made a popover about project alternatives the only
 * thing keeping Save As, Save a Copy As, Import Project Settings, Project
 * Information and Bounce alive: the commands write `projectFileDialog` into
 * the store, and if whatever renders that field is not mounted they set a flag
 * and nothing opens. Removing the bar removed the dialogs with it.
 *
 * So they are mounted from the studio page directly, with no trigger attached.
 * Which dialog is open lives in the store, so any menu can open any of them
 * without knowing this exists.
 */
export function ProjectFileDialogs() {
    const router = useRouter()
    const name = useProjectStore(s => s.name)
    const saveAs = useProjectStore(s => s.saveAs)
    const saveCopyAs = useProjectStore(s => s.saveCopyAs)
    const projectFileDialog = useProjectStore(s => s.projectFileDialog)
    const setProjectFileDialog = useProjectStore(s => s.setProjectFileDialog)
    const projectExportStatus = useProjectStore(s => s.projectExportStatus)

    const onSaveDialogSubmit = async (data: SaveData) => {
        try {
            if (projectFileDialog === 'saveAs') {
                await saveAs(data)
                setProjectFileDialog('none')
                const newId = useProjectStore.getState().id
                if (newId) router.push(`/project/${newId}`)
            } else {
                await saveCopyAs(data)
                setProjectFileDialog('none')
            }
        } catch (e) {
            console.error('Save failed:', e)
            alert('Failed to save project. Check console for details.')
        }
    }

    return (
        <>
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
        </>
    )
}
