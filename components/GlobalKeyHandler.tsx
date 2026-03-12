"use client"

import { useEffect, useMemo } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { audioEngine } from '@/engine/audioEngine'

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
            setLocators(clip.start, clip.start + clip.duration);
            movePlayhead(clip.start);
        };

        const goToSelectionPoints = (which: 'start' | 'end') => {
            if (!selectedClipIds.length) return;
            const selectedClips = clips.filter(c => selectedClipIds.includes(c.id));
            if (!selectedClips.length) return;
            const line = which === 'start' ? Math.min(...selectedClips.map(c => c.start)) : Math.max(...selectedClips.map(c => c.start + c.duration));
            movePlayhead(line);
        };

        const goToEndOfLastRegion = () => {
            const last = clips.reduce((prev, c) => Math.max(prev, c.start + c.duration), 0);
            movePlayhead(last);
        };

        const handleActionFromCommand = (commandId: string, e?: KeyboardEvent) => {
            // allow null event when called from MIDI
            if (e) e.preventDefault();
            switch (commandId) {
                case 'play_stop':
                    e && e.preventDefault();
                    if (playing) stop(); else play();
                    break;
                case 'play':
                    e && e.preventDefault();
                    play();
                    break;
                case 'pause':
                    e && e.preventDefault();
                    if (playing) stop();
                    break;
                case 'stop':
                    e && e.preventDefault();
                    stop();
                    break;
                case 'record':
                case 'record_toggle':
                    e && e.preventDefault();
                    toggleRecording();
                    break;
                case 'discard_and_return':
                    e && e.preventDefault();
                    discardAndReturn();
                    break;
                case 'record_into_cell':
                    e && e.preventDefault();
                    recordRepeat();
                    break;
                case 'flashback_capture':
                    e && e.preventDefault();
                    flashbackCapture();
                    break;
                case 'toggle_metronome':
                    e && e.preventDefault();
                    toggleMetronome();
                    break;
                case 'toggle_cycle':
                    e && e.preventDefault();
                    toggleCycle();
                    break;
                case 'toggle_autopunch':
                    e && e.preventDefault();
                    toggleAutopunch();
                    break;
                case 'bypass_control_surfaces':
                    e && e.preventDefault();
                    useProjectStore.getState().toggleControlSurfacesBypass();
                    break;
                case 'toggle_count_in':
                    e && e.preventDefault();
                    toggleCountIn();
                    break;
                case 'toggle_selection_processing':
                case 'preview_selection_processing':
                    e && e.preventDefault();
                    toggleSelectionBasedProcessing();
                    break;
                case 'rewind':
                    e.preventDefault();
                    movePlayhead(Math.max(0, playhead - 1));
                    break;
                case 'forward':
                    e.preventDefault();
                    movePlayhead(playhead + 1);
                    break;
                case 'fast_rewind':
                    e.preventDefault();
                    movePlayhead(Math.max(0, playhead - 4));
                    break;
                case 'fast_forward':
                    e.preventDefault();
                    movePlayhead(playhead + 4);
                    break;
                case 'go_to_left_locator':
                    e.preventDefault();
                    movePlayhead(locatorLeft);
                    break;
                case 'go_to_right_locator':
                    e.preventDefault();
                    movePlayhead(locatorRight);
                    break;
                case 'go_to_beginning':
                    e.preventDefault();
                    movePlayhead(0);
                    break;
                case 'go_to_selection_start':
                    e.preventDefault();
                    goToSelectionPoints('start');
                    break;
                case 'go_to_selection_end':
                    e.preventDefault();
                    goToSelectionPoints('end');
                    break;
                case 'go_to_end_last_region':
                    e.preventDefault();
                    goToEndOfLastRegion();
                    break;
                case 'set_punch_in':
                    e.preventDefault();
                    setLocators(playhead, locatorRight);
                    break;
                case 'set_punch_out':
                    e.preventDefault();
                    setLocators(locatorLeft, playhead);
                    break;
                case 'set_locators_by_regions':
                    e.preventDefault();
                    goToSelectedClipBounds();
                    break;
                case 'set_rounded_locators':
                    e.preventDefault();
                    setLocators(Math.round(locatorLeft), Math.round(locatorRight));
                    break;
                case 'skip_cycle':
                    e.preventDefault();
                    setLocators(locatorLeft, locatorRight);
                    break;
                case 'move_locators_forward':
                    e.preventDefault();
                    setLocators(locatorLeft + 1, locatorRight + 1);
                    break;
                case 'move_locators_backward':
                    e.preventDefault();
                    setLocators(Math.max(0, locatorLeft - 1), Math.max(0, locatorRight - 1));
                    break;
                case 'double_cycle_length':
                    e.preventDefault();
                    if (cycleEnabled) setLocators(locatorLeft, locatorLeft + (locatorRight - locatorLeft) * 2);
                    break;
                case 'halve_cycle_length':
                    e.preventDefault();
                    if (cycleEnabled) setLocators(locatorLeft, locatorLeft + Math.max(1, (locatorRight - locatorLeft) / 2));
                    break;
                case 'create_marker':
                    e.preventDefault();
                    addMarker(playhead, 'Marker');
                    break;
                default:
                    break;
            }
        };

        const combinedKeyCommands = useMemo(() => {
            const projectMap = new Map(projectKeyCommands.map(k => [k.id, k]));
            return globalSettings.keyCommands.map(g => projectMap.get(g.id) || g);
        }, [globalSettings.keyCommands, projectKeyCommands]);

        const handleKeyDown = (e: KeyboardEvent) => {
            const hotkey = normalizeKeyEvent(e);
            const mapping = combinedKeyCommands.find(k => k.shortcut.toLowerCase() === hotkey.toLowerCase()) || globalSettings.keyCommands.find(k => k.shortcut.toLowerCase() === hotkey.toLowerCase());
            if (mapping) {
                handleActionFromCommand(mapping.id, e);
                return;
            }

            const isMod = e.metaKey || e.ctrlKey;
            const isAlt = e.altKey;
            const isShift = e.shiftKey;

            // Track creation shortcuts (Logic style)
            if (isMod && !isAlt && !isShift) {
                switch (e.key.toLowerCase()) {
                    case 'a': // New Audio Track (Logic: Cmd+A)
                        e.preventDefault();
                        addTrack({ name: "Audio", type: 'audio', color: '#38bdf8', icon: 'mic' });
                        break;
                    case 's': // New Software Instrument Track (Logic: Cmd+S)
                        e.preventDefault();
                        addTrack({ name: "Inst", type: 'software-instrument', color: '#63ed63', icon: 'keyboard' });
                        break;
                    case 'p': // New Session Player Track
                        e.preventDefault();
                        addTrack({ name: "Drummer", type: 'drummer', color: '#fbbf24', icon: 'drum' });
                        break;
                    case 'x': // New External MIDI Track
                        e.preventDefault();
                        addTrack({ name: "MIDI", type: 'external-midi', color: '#10b981', icon: 'midi' });
                        break;
                    case 't': // Search and Select Track (Logic: Opt+Cmd+T)
                        e.preventDefault();
                        toggleSearchAndSelect(true);
                        break;
                    case 'c': // Assign Track Color (Logic: Opt+C)
                        e.preventDefault();
                        toggleColorPalette(true);
                        break;
                    case 'h': // Configure Track Header (Custom: Opt+H)
                        e.preventDefault();
                        toggleTrackHeaderConfig(true);
                        break;
                }
            }

            // Logic Zoom Shortcuts
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

            // Power-User Duplication & Selection (Cmd + modifiers)
            if (isMod && !isAlt) {
                if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    if (isShift) {
                        // Opt+Shift+Cmd+D is Content, but we'll use Shift+Cmd+D for simplicity in web
                        duplicateTracks('content');
                    } else {
                        duplicateTracks('settings');
                    }
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    duplicateTracks('shared');
                }
                if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveProject('user-1');
                }
                if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    useProjectStore.getState().toggleVirtualKeyboard();
                }
                if (e.key.toLowerCase() === 'i') {
                    e.preventDefault();
                    useProjectStore.getState().toggleStepInput();
                }

                // Region clipboard (Logic style)
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
                if (e.key.toLowerCase() === 'a') {
                    e.preventDefault();
                    const clipId = selectedClipId || selectedClipIds[0];
                    if (clipId) {
                        const clip = clips.find(c => c.id === clipId);
                        if (clip) {
                            useProjectStore.getState().makeAlias(clip.id, clip.trackId, useProjectStore.getState().playhead);
                        }
                    }
                }
                if (e.key.toLowerCase() === 'l') {
                    e.preventDefault();
                    const sourceId = selectedClipId || selectedClipIds[0];
                    if (sourceId) useProjectStore.getState().selectAliasesOfRegion(sourceId);
                }
                if (e.key.toLowerCase() === 'o') {
                    e.preventDefault();
                    const aliasId = selectedClipId || selectedClipIds[0];
                    if (aliasId) useProjectStore.getState().selectOriginalOfAlias(aliasId);
                }
                if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    if (selectedClipIds.length === 2) {
                        const [first, second] = selectedClipIds;
                        const maybeAlias = clips.find(c => c.id === first)?.aliasOf ? first : second;
                        const maybeSource = clips.find(c => c.id === first)?.aliasOf ? second : first;
                        if (maybeAlias && maybeSource) useProjectStore.getState().reassignAlias(maybeAlias, maybeSource);
                    }
                }
                if (e.key.toLowerCase() === 'p') {
                    e.preventDefault();
                    useProjectStore.getState().selectOrphanAliases();
                }
                if (e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    useProjectStore.getState().convertOrphanAliasesToCopies();
                }
                if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    useProjectStore.getState().deleteOrphanAliases();
                }
                if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    const clipId = selectedClipId || selectedClipIds[0];
                    if (!clipId) return;
                    const preset = prompt('Stem Splitter preset (All Stems, Vocals + Music, Vocals Only, Drums + Bass)', 'All Stems') || 'All Stems';
                    useProjectStore.getState().stemSplitter(clipId, { preset, includeSubmix: true });
                }
                if (e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    const clipId = selectedClipId || selectedClipIds[0];
                    if (!clipId) return;
                    const threshold = parseFloat(prompt('Threshold (0-1)', '0.02') || '0.02');
                    const minSilence = parseFloat(prompt('Min Silence (beats)', '0.25') || '0.25');
                    useProjectStore.getState().splitRegionBySilence(clipId, { threshold, minSilence, preAttack: 0.02, postRelease: 0.02, zeroCross: true });
                }
            }

            if (!isMod && !isAlt) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    deleteSelectedClips();
                }
            }

            // Extended Duplication (Opt + Shift + Cmd + D)
            if (isMod && isAlt && isShift && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                duplicateTracks('content');
            }

            // Navigation Arrows (Logic: Up/Down to select, +Shift for multi)
            if (!isMod && !isAlt) {
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
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    const store = useProjectStore.getState();
                    const nudge = store.snap === 'bar' ? 4 : store.snap === 'half' ? 2 : store.snap === 'quarter' ? 1 : store.snap === 'eighth' ? 0.5 : 0.25;
                    if (store.selectedClipIds.length > 0) {
                        e.preventDefault();
                        const delta = e.key === 'ArrowLeft' ? -nudge : nudge;
                        store.selectedClipIds.forEach(clipId => {
                            const clip = store.clips.find(c => c.id === clipId);
                            if (clip) {
                                const next = Math.max(0, clip.start + delta);
                                updateClip(clipId, { start: next });
                            }
                        });
                    }
                }

                if (e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    if (isShift) {
                        useProjectStore.getState().recordRepeat();
                    } else {
                        useProjectStore.getState().toggleRecording();
                    }
                }

                if (e.key.toLowerCase() === 'd' && isShift) {
                    e.preventDefault();
                    useProjectStore.getState().discardAndReturn();
                }
            }

            if (!isMod && isAlt && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                useProjectStore.getState().flashbackCapture();
            }

            // Take Folder Comping Shortcuts (Option keys)
            if (isAlt && !isMod && selectedClipId) {
                const clip = clips.find(c => c.id === selectedClipId);
                if (clip?.isTakeFolder) {
                    const takeCount = clip.takes?.length || 0;

                    if (e.key.toLowerCase() === 'f') {
                        e.preventDefault();
                        if (e.shiftKey) {
                            const trackFolders = clips.filter(c => c.trackId === clip.trackId && c.isTakeFolder);
                            trackFolders.forEach(tf => updateClip(tf.id, { isTakeFolderOpen: !tf.isTakeFolderOpen }));
                        } else {
                            updateClip(clip.id, { isTakeFolderOpen: !clip.isTakeFolderOpen });
                        }
                    }

                    if (takeCount > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                        e.preventDefault();
                        const currentIndex = clip.activeTakeIndex ?? 0;
                        const nextIndex = e.key === 'ArrowLeft'
                            ? Math.max(0, currentIndex - 1)
                            : Math.min(takeCount - 1, currentIndex + 1);
                        updateClip(clip.id, { activeTakeIndex: nextIndex });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // MIDI listener for control surface assignments
        const unsubMidi = audioEngine.addMidiListener((event) => {
            const { message, inputId } = event as any;
            const [status, d1, d2] = message.data;
            const baseStatus = status & 0xf0;
            const channel = status & 0x0f;
            if (!globalSettings.controlSurfacesBypassed) {
                const assign = globalSettings.controlSurfaceAssignments.find(a => {
                    if (a.status !== baseStatus) return false;
                    if (a.channel !== channel) return false;
                    if (a.data1 !== d1) return false;
                    if (a.data2 !== undefined && a.data2 !== d2) return false;
                    if (a.deviceId && a.deviceId !== inputId) return false;
                    return true;
                });
                if (assign) {
                    handleActionFromCommand(assign.commandId);
                }
            }
        });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            unsubMidi();
        };
    }, [tracks, focusedTrackId, selectTrack, duplicateTracks, toggleNewTrackDialog, addTrack, saveProject, toggleSearchAndSelect, globalSettings.controlSurfaceAssignments, globalSettings.controlSurfaces]);

    return null;
}
