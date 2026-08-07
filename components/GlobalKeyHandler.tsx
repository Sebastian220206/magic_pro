"use client"

import { useEffect, useMemo } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/AudioEngineAdapter'

export function GlobalKeyHandler() {
    const {
        toggleNewTrackDialog,
        addTrack,
        isDirty,
        saveProject,
        tracks,
        selectedTrackIds,
        focusedTrackId,
        selectTrack,
        duplicateTracks,
        toggleSearchAndSelect,
        toggleColorPalette,
        updateTrackZoom,
        resetAllTrackZoom,
        toggleTrackHeaderConfig,
        clips,
        selectedClipId,
        selectedClipIds,
        selectClip,
        selectClips,
        copySelectedClips,
        cutSelectedClips,
        pasteClipsAtPlayhead,
        deleteSelectedClips,
        makeAlias,
        selectAliasesOfRegion,
        selectOriginalOfAlias,
        reassignAlias,
        selectOrphanAliases,
        convertOrphanAliasesToCopies,
        deleteOrphanAliases,
        stemSplitter,
        splitRegionBySilence,
        recordRepeat,
        toggleRecording,
        discardAndReturn,
        flashbackCapture,
        toggleVirtualKeyboard,
        toggleStepInput,
        snap,
        globalSettings,
        projectKeyCommands,
        play,
        stop,
        playing,
        playhead,
        movePlayhead,
        locatorLeft,
        locatorRight,
        setLocators,
        cycleEnabled,
        skipCycleEnabled,
        toggleCycle,
        toggleAutopunch,
        toggleMetronome,
        toggleCountIn,
        toggleSelectionBasedProcessing,
        addMarker,
        setAutoSetLocators,
    } = useProjectStore();

    // ✅ FIXED: useMemo moved to the top level, outside of useEffect
    const combinedKeyCommands = useMemo(() => {
        const projectMap = new Map(projectKeyCommands.map(k => [k.id, k]));
        return globalSettings.keyCommands.map(g => projectMap.get(g.id) || g);
    }, [globalSettings.keyCommands, projectKeyCommands]);

    useEffect(() => {
        const normalizeKeyEvent = (e: KeyboardEvent) => {
            const parts: string[] = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.metaKey) parts.push('Cmd');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');

            let key = e.key;
            if (key === ' ') key = 'Space';
            if (key === 'Esc') key = 'Escape';
            if (key === 'ArrowLeft') key = 'ArrowLeft';
            if (key === 'ArrowRight') key = 'ArrowRight';
            if (key === 'ArrowUp') key = 'ArrowUp';
            if (key === 'ArrowDown') key = 'ArrowDown';
            if (e.code.startsWith('Numpad')) {
                if (e.code === 'NumpadEnter') key = 'NumpadEnter';
                else if (e.code === 'NumpadMultiply') key = 'Numpad*';
                else if (e.code === 'NumpadSubstract' || e.code === 'NumpadSubtract') key = 'Numpad-';
                else if (e.code === 'NumpadAdd') key = 'Numpad+';
                else if (e.code === 'NumpadDecimal') key = 'Numpad.';
                else key = e.code.replace('Numpad', 'Numpad');
            }

            if (key.length === 1) key = key.toUpperCase();
            parts.push(key);
            return parts.join('+');
        };

        const goToSelectedClipBounds = () => {
            const inClip = selectedClipId || selectedClipIds[0];
            if (!inClip) return;
            const clip = clips.find(c => c.id === inClip);
            if (!clip) return;
            const sb = clip.startBeat ?? clip.start;
            setLocators(sb, sb + clip.duration);
            movePlayhead(sb);
        };

        const goToSelectionPoints = (which: 'start' | 'end') => {
            if (!selectedClipIds.length) return;
            const selectedClipsList = clips.filter(c => selectedClipIds.includes(c.id));
            if (!selectedClipsList.length) return;
            const line = which === 'start' ? Math.min(...selectedClipsList.map(c => c.startBeat ?? c.start)) : Math.max(...selectedClipsList.map(c => (c.startBeat ?? c.start) + c.duration));
            movePlayhead(line);
        };

        const goToEndOfLastRegion = () => {
            const last = clips.reduce((prev, c) => Math.max(prev, (c.startBeat ?? c.start) + c.duration), 0);
            movePlayhead(last);
        };

        const handleActionFromCommand = (commandId: string, e?: KeyboardEvent) => {
            if (e) e.preventDefault();
            switch (commandId) {
                case 'play_stop':
                    if (playing) stop(); else play();
                    break;
                case 'play':
                    play();
                    break;
                case 'pause':
                    if (playing) stop();
                    break;
                case 'stop':
                    stop();
                    break;
                case 'record':
                case 'record_toggle':
                    toggleRecording();
                    break;
                case 'discard_and_return':
                    discardAndReturn();
                    break;
                case 'record_into_cell':
                    recordRepeat();
                    break;
                case 'flashback_capture':
                    flashbackCapture();
                    break;
                case 'toggle_metronome':
                    toggleMetronome();
                    break;
                case 'toggle_cycle':
                    toggleCycle();
                    break;
                case 'toggle_autopunch':
                    toggleAutopunch();
                    break;
                case 'bypass_control_surfaces':
                    useProjectStore.getState().toggleControlSurfacesBypass();
                    break;
                case 'toggle_count_in':
                    toggleCountIn();
                    break;
                case 'toggle_selection_processing':
                case 'preview_selection_processing':
                    toggleSelectionBasedProcessing();
                    break;
                case 'rewind':
                    movePlayhead(Math.max(0, playhead - 1));
                    break;
                case 'forward':
                    movePlayhead(playhead + 1);
                    break;
                case 'fast_rewind':
                    movePlayhead(Math.max(0, playhead - 4));
                    break;
                case 'fast_forward':
                    movePlayhead(playhead + 4);
                    break;
                case 'go_to_left_locator':
                    movePlayhead(locatorLeft);
                    break;
                case 'go_to_right_locator':
                    movePlayhead(locatorRight);
                    break;
                case 'go_to_beginning':
                    movePlayhead(0);
                    break;
                case 'go_to_selection_start':
                    goToSelectionPoints('start');
                    break;
                case 'go_to_selection_end':
                    goToSelectionPoints('end');
                    break;
                case 'go_to_end_last_region':
                    goToEndOfLastRegion();
                    break;
                case 'set_punch_in':
                    setLocators(playhead, locatorRight);
                    break;
                case 'set_punch_out':
                    setLocators(locatorLeft, playhead);
                    break;
                case 'set_locators_by_regions':
                    goToSelectedClipBounds();
                    break;
                case 'set_rounded_locators':
                    setLocators(Math.round(locatorLeft), Math.round(locatorRight));
                    break;
                case 'skip_cycle':
                    setLocators(locatorLeft, locatorRight);
                    break;
                case 'move_locators_forward':
                    setLocators(locatorLeft + 1, locatorRight + 1);
                    break;
                case 'move_locators_backward':
                    setLocators(Math.max(0, locatorLeft - 1), Math.max(0, locatorRight - 1));
                    break;
                case 'double_cycle_length':
                    if (cycleEnabled) setLocators(locatorLeft, locatorLeft + (locatorRight - locatorLeft) * 2);
                    break;
                case 'halve_cycle_length':
                    if (cycleEnabled) setLocators(locatorLeft, locatorLeft + Math.max(1, (locatorRight - locatorLeft) / 2));
                    break;
                case 'create_marker':
                    addMarker(playhead, 'Marker');
                    break;
                default:
                    break;
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;

            const hotkey = normalizeKeyEvent(e);
            const mapping = combinedKeyCommands.find(k => k.shortcut.toLowerCase() === hotkey.toLowerCase()) || globalSettings.keyCommands.find(k => k.shortcut.toLowerCase() === hotkey.toLowerCase());
            
            if (mapping) {
                handleActionFromCommand(mapping.id, e);
                return;
            }

            const isMod = e.metaKey || e.ctrlKey;
            const isAlt = e.altKey;
            const isShift = e.shiftKey;

            if (isMod && !isAlt && !isShift) {
                switch (e.key.toLowerCase()) {
                    case 'a':
                        e.preventDefault();
                        addTrack({ name: "Audio", type: 'audio', color: '#38bdf8', icon: 'mic' });
                        break;
                    case 'p':
                        e.preventDefault();
                        addTrack({ name: "Drummer", type: 'drummer', color: '#fbbf24', icon: 'drum' });
                        break;
                    case 'x':
                        e.preventDefault();
                        addTrack({ name: "MIDI", type: 'external-midi', color: '#10b981', icon: 'midi' });
                        break;
                    case 't':
                        e.preventDefault();
                        toggleSearchAndSelect(true);
                        break;
                    case 'c':
                        e.preventDefault();
                        toggleColorPalette(true);
                        break;
                    case 'h':
                        e.preventDefault();
                        toggleTrackHeaderConfig(true);
                        break;
                }
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (focusedTrackId) {
                    const track = tracks.find(t => t.id === focusedTrackId);
                    if (track) {
                        const newZoom = (track.zoom || 1) > 1.5 ? 1 : 3;
                        updateTrackZoom(focusedTrackId, newZoom);
                    }
                }
            }
            if (e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                resetAllTrackZoom();
            }

            if (isMod && !isAlt) {
                if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    if (isShift) duplicateTracks('content'); else duplicateTracks('settings');
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    duplicateTracks('shared');
                }
                if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveProject();
                }
                if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    toggleVirtualKeyboard();
                }
                if (e.key.toLowerCase() === 'i') {
                    e.preventDefault();
                    toggleStepInput();
                }
                if (e.key.toLowerCase() === 'c') {
                    e.preventDefault();
                    copySelectedClips();
                }
                if (e.key.toLowerCase() === 'x') {
                    e.preventDefault();
                    cutSelectedClips();
                }
                if (e.key.toLowerCase() === 'v') {
                    e.preventDefault();
                    pasteClipsAtPlayhead();
                }
            }

            if (isMod && isAlt) {
                const clipId = selectedClipId || selectedClipIds[0];
                if (e.key.toLowerCase() === 'a' && clipId) {
                    e.preventDefault();
                    const clip = clips.find(c => c.id === clipId);
                    if (clip) makeAlias(clip.id, clip.trackId, playhead);
                }
                if (e.key.toLowerCase() === 'l' && clipId) {
                    e.preventDefault();
                    selectAliasesOfRegion(clipId);
                }
                if (e.key.toLowerCase() === 'o' && clipId) {
                    e.preventDefault();
                    selectOriginalOfAlias(clipId);
                }
                if (e.key.toLowerCase() === 'y' && selectedClipIds.length === 2) {
                    e.preventDefault();
                    const [first, second] = selectedClipIds;
                    const maybeAlias = clips.find(c => c.id === first)?.aliasOf ? first : second;
                    const maybeSource = clips.find(c => c.id === first)?.aliasOf ? second : first;
                    if (maybeAlias && maybeSource) reassignAlias(maybeAlias, maybeSource);
                }
                if (e.key.toLowerCase() === 'p') {
                    e.preventDefault();
                    selectOrphanAliases();
                }
                if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    convertOrphanAliasesToCopies();
                }
                if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    deleteOrphanAliases();
                }
                if (e.key.toLowerCase() === 's' && clipId) {
                    e.preventDefault();
                    const preset = prompt('Stem Splitter preset', 'All Stems') || 'All Stems';
                    stemSplitter(clipId, { preset, includeSubmix: true });
                }
                if (e.key.toLowerCase() === 'r' && clipId) {
                    e.preventDefault();
                    const threshold = parseFloat(prompt('Threshold (0-1)', '0.02') || '0.02');
                    const minSilence = parseFloat(prompt('Min Silence (beats)', '0.25') || '0.25');
                    splitRegionBySilence(clipId, { threshold, minSilence, preAttack: 0.02, postRelease: 0.02, zeroCross: true });
                }
            }

            if (!isMod && !isAlt) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    deleteSelectedClips();
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const currentIndex = tracks.findIndex(t => t.id === focusedTrackId);
                    let nextIndex = currentIndex;
                    if (e.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
                    if (e.key === 'ArrowDown') nextIndex = Math.min(tracks.length - 1, currentIndex + 1);
                    if (nextIndex !== currentIndex && tracks[nextIndex]) {
                        selectTrack(tracks[nextIndex].id, false, isShift);
                    }
                }
                if (e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    if (isShift) recordRepeat(); else toggleRecording();
                }
                if (e.key.toLowerCase() === 'd' && isShift) {
                    e.preventDefault();
                    discardAndReturn();
                }
            }

            if (!isMod && isAlt && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                flashbackCapture();
            }

            if (isAlt && !isMod && selectedClipId) {
                const clip = clips.find(c => c.id === selectedClipId);
                if (clip?.isTakeFolder) {
                    if (e.key.toLowerCase() === 'f') {
                        e.preventDefault();
                        // This logic relies on a store action, assumed defined in useProjectStore
                        // updateClip call here
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        const unsubMidi = audioEngine.addMidiListener((event) => {
            const { message, inputId } = event;
            const [status, d1, d2] = message.data!;
            const baseStatus = status & 0xf0;
            const channel = status & 0x0f;
            if (!globalSettings.controlSurfaces.bypassed) {
                const assign = globalSettings.controlSurfaces.assignments.find((a) => {
                    return a.status === baseStatus && a.channel === channel && a.data1 === d1 && (a.data2 === undefined || a.data2 === d2) && (!a.deviceId || a.deviceId === inputId);
                });
                if (assign) handleActionFromCommand(assign.commandId);
            }
        });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            unsubMidi();
        };
    }, [
        tracks, focusedTrackId, selectTrack, duplicateTracks, toggleNewTrackDialog, addTrack, saveProject, toggleSearchAndSelect, 
        globalSettings, combinedKeyCommands, clips, selectedClipId, selectedClipIds, playing, playhead, locatorLeft, locatorRight, 
        cycleEnabled, stop, play, toggleRecording, discardAndReturn, recordRepeat, flashbackCapture, toggleMetronome, toggleCycle, 
        toggleAutopunch, toggleCountIn, toggleSelectionBasedProcessing, addMarker, movePlayhead, setLocators, toggleSearchAndSelect, 
        toggleColorPalette, toggleTrackHeaderConfig, updateTrackZoom, resetAllTrackZoom, toggleVirtualKeyboard, toggleStepInput, 
        copySelectedClips, cutSelectedClips, pasteClipsAtPlayhead, makeAlias, selectAliasesOfRegion, selectOriginalOfAlias, 
        reassignAlias, selectOrphanAliases, convertOrphanAliasesToCopies, deleteOrphanAliases, stemSplitter, splitRegionBySilence, 
        deleteSelectedClips
    ]);

    return null;
}
