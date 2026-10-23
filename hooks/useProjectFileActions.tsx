"use client"
import { useCallback } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useToast } from '@/components/Toast';
import { renderSongOffline } from '@/engine/export/OfflineRenderer';
import { encodeWav } from '@/engine/export/wavEncoder';
import {
    Save, FileText, Copy, Download, Layers, RotateCcw, X, Music, Printer, type LucideIcon,
} from 'lucide-react';
import { exportMidiFromClips } from '@/lib/midiExport';
import { generatePrintContent } from '@/lib/printExport';

/**
 * The project-file commands, in one place.
 *
 * These lived inside `ProjectManager`, which is the Alternatives popover — so
 * Save a Copy As, Export as WAV, Save as Template, Import Project Settings,
 * Project Information, Revert and Bounce were reachable only from a menu about
 * project alternatives. The File menu beside it listed New, Open, Save, Save
 * As and Export Audio, none of which had an action at all.
 *
 * Both menus render from this list now. The dialogs they open are held in the
 * store rather than in a hook, because two components calling a hook get two
 * copies of its state — the File menu would have set a flag that the component
 * rendering the dialog never saw.
 */

export interface ProjectFileCommand {
    id: string;
    label: string;
    shortcut?: string;
    icon: LucideIcon;
    /** Draw a divider above this entry. */
    separatorBefore?: boolean;
    /** Tints the row, for the one command that discards work. */
    destructive?: boolean;
    run: () => void;
}

export function useProjectFileActions(): {
    commands: ProjectFileCommand[];
    exportWav: () => Promise<void>;
} {
    const { toast } = useToast();
    const name = useProjectStore(s => s.name);
    const isDirty = useProjectStore(s => s.isDirty);
    const saveProject = useProjectStore(s => s.saveProject);
    const saveAsTemplate = useProjectStore(s => s.saveAsTemplate);
    const revertTo = useProjectStore(s => s.revertTo);
    const closeProject = useProjectStore(s => s.closeProject);
    const setDialog = useProjectStore(s => s.setProjectFileDialog);
    const setExportStatus = useProjectStore(s => s.setProjectExportStatus);

    /**
     * Render the project and hand back a WAV.
     *
     * The `await` gaps are there so each progress line paints before the work
     * that follows blocks the main thread; without them the overlay shows one
     * message for the whole render.
     */
    const exportWav = useCallback(async () => {
        setExportStatus('Preparing export...');
        await new Promise(r => setTimeout(r, 50));

        try {
            const state = useProjectStore.getState();
            const { tempo, tracks, clips, name: projectName } = state;
            if (!tempo || tempo <= 0) throw new Error('Invalid project tempo');

            setExportStatus('Mapping tracks and clips...');
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
                storageKey: (c as unknown as { storageKey?: string }).storageKey,
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
                // Without this the bounce is dry and silently differs from playback.
                plugins: t.plugins,
            }));

            setExportStatus('Rendering audio (this may take a moment)...');
            await new Promise(r => setTimeout(r, 10));

            const rendered = await renderSongOffline(exportClips, exportTracks, tempo, {
                onPluginFailure: (failed) => {
                    // Never let a plugin silently drop out of an export.
                    toast(
                        `Some plugins could not be rendered and were bypassed: ${failed.join(', ')}`,
                        'error',
                    );
                },
            });

            setExportStatus(`Rendered ${rendered.duration.toFixed(1)}s audio, encoding WAV...`);
            await new Promise(r => setTimeout(r, 10));

            const wavBlob = await encodeWav(rendered);
            const safeName = (projectName || 'export').replace(/[^a-zA-Z0-9]/g, '_');
            const url = URL.createObjectURL(wavBlob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('[Export] Failed:', e);
            toast('Export failed. Check the console for details.', 'error');
        } finally {
            setExportStatus(null);
        }
    }, [toast, setExportStatus]);

    const saveTemplate = useCallback(() => {
        const templateName = prompt('Enter template name:', name);
        if (templateName) saveAsTemplate(templateName);
    }, [name, saveAsTemplate]);

    const close = useCallback(() => {
        if (isDirty && confirm('You have unsaved changes. Save before closing?')) {
            saveProject();
        }
        closeProject();
    }, [isDirty, saveProject, closeProject]);

    const exportMidi = useCallback(() => {
        const state = useProjectStore.getState();
        const midiClips = state.clips.filter(c => c.type === 'midi') as any[];
        if (midiClips.length === 0) {
            toast('No MIDI regions found to export.', 'error');
            return;
        }
        exportMidiFromClips(midiClips, state.tempo || 120, `${state.name || 'project'}.mid`);
        toast(`Exported ${midiClips.length} MIDI regions.`, 'success');
    }, [toast]);

    const printProject = useCallback(() => {
        const state = useProjectStore.getState();
        const html = generatePrintContent({
            name: state.name || 'Project',
            tempo: state.tempo,
            timeSignature: state.timeSignature,
            keySignature: state.keySignature,
            tracks: state.tracks,
        });
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            w.print();
        } else {
            toast('Popup blocked — allow popups to print project sheet.', 'error');
        }
    }, [toast]);

    const commands: ProjectFileCommand[] = [
        { id: 'save', label: 'Save Project', shortcut: 'Cmd+S', icon: Save, run: saveProject },
        { id: 'saveAs', label: 'Save As...', shortcut: 'Cmd+Shift+S', icon: FileText, run: () => setDialog('saveAs') },
        { id: 'saveCopy', label: 'Save a Copy As...', icon: Copy, run: () => setDialog('saveCopy') },
        { id: 'exportWav', label: 'Export as WAV...', icon: Download, run: () => { void exportWav(); } },
        { id: 'exportMidi', label: 'Export Project as MIDI...', icon: Music, run: exportMidi },
        { id: 'printSheet', label: 'Print Track Sheet (PDF)...', icon: Printer, run: printProject },
        { id: 'template', label: 'Save as Template...', icon: Layers, run: saveTemplate },
        { id: 'import', label: 'Import Project Settings...', icon: Download, separatorBefore: true, run: () => setDialog('import') },
        { id: 'info', label: 'Project Information...', icon: FileText, run: () => setDialog('info') },
        { id: 'revert', label: 'Revert to Last Saved', icon: RotateCcw, separatorBefore: true, run: revertTo },
        { id: 'bounce', label: 'Bounce Project (PCM)...', icon: Download, run: () => setDialog('bounce') },
        { id: 'close', label: 'Close Project', icon: X, separatorBefore: true, destructive: true, run: close },
    ];

    return { commands, exportWav };
}
