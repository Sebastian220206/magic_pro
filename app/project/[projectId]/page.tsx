"use client"
import { useEffect, useRef, useCallback, useState } from "react"
import { audioEngine } from "@/engine/AudioEngineAdapter"
import { useAudioPlayer } from "@/engine/useAudioPlayer"
import { TransportBar } from "@/components/TransportBar"
import { Inspector } from "@/components/Inspector"
import { TrackList } from "@/components/TrackList"
import { Timeline } from "@/components/Timeline"
import { PianoRoll } from "@/components/PianoRoll"
import { Mixer } from "@/components/Mixer"
import { SmartControls } from "@/components/SmartControls"
import { useProjectStore } from "@/store/projectStore"
import { LibraryPanel } from "@/components/LibraryPanel"
import { TracksAreaMenuBar } from "@/components/TracksAreaMenuBar"
import { Toolbar } from "@/components/Toolbar"
import { LoopBrowser } from "@/components/LoopBrowser"
import { NotePad } from "@/components/NotePad"
import { Browsers } from "@/components/Browsers"
import { ListEditors } from "@/components/ListEditors"
import { GlobalTracks } from "@/components/GlobalTracks"
import { GlobalKeyHandler } from "@/components/GlobalKeyHandler"
import { LiveLoopsGrid } from "@/components/LiveLoopsGrid"
import { NewTrackDialog } from "@/components/NewTrackDialog"
import { SearchAndSelectDialog } from "@/components/SearchAndSelectDialog"
import { ColorPalette } from "@/components/ColorPalette"
import { IconBrowser } from "@/components/IconBrowser"
import { DrumReplacementDialog } from "@/components/DrumReplacementDialog"
import { TrackHeaderConfigDialog } from "@/components/TrackHeaderConfigDialog"
import { ArticulationSetEditor } from "@/components/ArticulationSetEditor"
import { BounceTrackDialog } from "@/components/BounceTrackDialog"
import { BounceRegionsDialog } from "@/components/BounceRegionsDialog"
import { BounceAllTracksDialog } from "@/components/BounceAllTracksDialog"
import { SelectionBasedProcessing } from "@/components/SelectionBasedProcessing"
import { ExportDialog } from "@/components/ExportDialog"
import { ShareDialog } from "@/components/ShareDialog"
import { VirtualKeyboard } from "@/components/VirtualKeyboard"
import { NoteRepeatDialog } from "@/components/NoteRepeatDialog"
import { SpotEraseDialog } from "@/components/SpotEraseDialog"
import { StepInputKeyboard } from "@/components/StepInputKeyboard"
import { AudioTrackEditor } from "@/components/AudioTrackEditor"
import { ViewControlBar } from "@/components/ViewControlBar"
import { PluginEditorWindow } from "@/components/PluginEditorWindow"
import { ErrorBoundary } from "@/components/ErrorBoundary"

import { AppMenuBar } from "@/components/AppMenuBar"
import { PreferencesDialog } from "@/components/PreferencesDialog"
import { OnboardingOverlay } from "@/components/OnboardingOverlay"
import { tutorialStore } from "@/store/tutorialStore"

export default function ProjectStudio({ params }: { params: { projectId: string } }) {
    const {
        loadProject,
        loadGlobalSettings,
        showLibrary,
        showInspector,
        showSmartControls,
        showMixer,
        showEditors,
        showListEditors,
        showNotePad,
        showLoopBrowser,
        showBrowsers,
        showLiveLoopsGrid,
        showTracksArea,
        bottomPanel,
        showNewTrackDialog,
        toggleNewTrackDialog,
        showSearchAndSelect,
        showColorPalette,
        showAudioTrackEditor,
        showIconBrowser,
        showDrumReplacement,
        showTrackHeaderConfig,
        showArticulationEditor,
        showSelectionBasedProcessing,
        showBounceTrackDialog,
        showBounceRegionsDialog,
        showBounceAllTracksDialog,
        showExportDialog,
        showShareDialog,
        showNoteRepeatDialog,
        showSpotEraseDialog,
        showStepInputKeyboard,
        bottomPanelHeight,
        setBottomPanelHeight
    } = useProjectStore()

    const [showTutorial, setShowTutorial] = useState(
        tutorialStore.state === 'not-started' || tutorialStore.state === 'active'
    );

    // Wire the audio engine (buffer loading, scheduler, track routing).
    // Must be called inside the component so hooks work correctly.
    useAudioPlayer();

    useEffect(() => {
        try {
            loadGlobalSettings();
        } catch (e) {
            console.error('[ProjectStudio] Failed to load global settings:', e);
        }
        if (params.projectId && params.projectId !== "new") {
            loadProject(params.projectId).catch((e: unknown) => {
                console.error('[ProjectStudio] Failed to load project:', e);
            });
        }
    }, [params.projectId, loadProject, loadGlobalSettings])

    useEffect(() => {
        try {
            audioEngine.initMidi();
        } catch (e) {
            console.error('[ProjectStudio] Failed to init MIDI:', e);
        }
    }, [])

    const bottomPanelRef = useRef<HTMLDivElement>(null);

    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = bottomPanelHeight;

        const onMove = (me: MouseEvent) => {
            const delta = startY - me.clientY;
            const newHeight = Math.max(150, Math.min(window.innerHeight - 100, startHeight + delta));
            setBottomPanelHeight(newHeight);

            const panel = bottomPanelRef.current || document.getElementById('bottom-panel');
            if (panel) panel.style.height = `${newHeight}px`;
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [bottomPanelHeight, setBottomPanelHeight]);

    const showBottomPanel = showSmartControls || showMixer || showEditors;
    const showRightSidebar = showListEditors || showNotePad || showLoopBrowser || showBrowsers;

    return (
        <div className="flex flex-col h-screen w-full bg-[#000] overflow-hidden text-sm selection:bg-sky-500/30">
            {/* macOS Menu Bar */}
            <AppMenuBar />

            {/* Top: Control Bar (Transport) */}
            <ErrorBoundary name="TransportBar">
                <TransportBar />
            </ErrorBoundary>

            {/* Area Row: Toolbar (Toggleable) */}
            <ErrorBoundary name="Toolbar">
                <Toolbar />
            </ErrorBoundary>

            {/* Main Workspace Area */}
            <div className="flex flex-1 overflow-hidden min-h-0 relative">

                {/* 1. Left Drawer: Library */}
                {showLibrary && (
                    <ErrorBoundary name="Library">
                        <LibraryPanel />
                    </ErrorBoundary>
                )}

                {/* 2. Central Workspace (Inspector + Tracks Area) */}
                <div className="flex flex-1 overflow-hidden h-full">
                    {/* Inspector Sidebar */}
                    {showInspector && (
                        <ErrorBoundary name="Inspector">
                            <Inspector />
                        </ErrorBoundary>
                    )}

                    {/* Arrangement View */}
                    <div className="flex flex-1 flex-col overflow-hidden bg-[#000]">
                        <TracksAreaMenuBar />
                        <GlobalTracks />

                        <div className="flex flex-1 overflow-hidden min-h-0">
                            {showLiveLoopsGrid && (
                                <div className={`h-full ${showTracksArea ? 'w-1/2' : 'w-full'} border-r border-white/10`}>
                                    <ErrorBoundary name="LiveLoops">
                                        <LiveLoopsGrid />
                                    </ErrorBoundary>
                                </div>
                            )}

                            {showTracksArea && (
                                <div className={`flex flex-1 flex-col overflow-hidden ${showLiveLoopsGrid ? 'w-1/2' : 'w-full'}`}>
                                    <div className="flex flex-1 overflow-hidden min-h-0">
                                        <ErrorBoundary zone="tracklist" name="TrackList">
                                            <TrackList />
                                        </ErrorBoundary>
                                        <ErrorBoundary zone="timeline" name="Timeline">
                                            <Timeline />
                                        </ErrorBoundary>
                                    </div>
                                </div>
                            )}


                            {!showLiveLoopsGrid && !showTracksArea && (
                                <div className="flex flex-1 items-center justify-center text-gray-400">
                                    No Live Loops or Tracks view active. Use the controls to show one.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            {showAudioTrackEditor && (
                <ErrorBoundary zone="panel" name="AudioTrackEditor">
                    <AudioTrackEditor />
                </ErrorBoundary>
            )}

                {/* 3. Right Sidebar: Browsers / Notes / Lists */}
                {showRightSidebar && (
                    <div className="flex h-full overflow-hidden shrink-0 border-l border-black bg-[#1a1a1a] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-40">
                        {showListEditors && (
                            <ErrorBoundary zone="panel" name="ListEditors">
                                <ListEditors />
                            </ErrorBoundary>
                        )}
                        {showNotePad && (
                            <ErrorBoundary zone="panel" name="NotePad">
                                <NotePad />
                            </ErrorBoundary>
                        )}
                        {showLoopBrowser && (
                            <ErrorBoundary zone="panel" name="LoopBrowser">
                                <LoopBrowser />
                            </ErrorBoundary>
                        )}
                        {showBrowsers && (
                            <ErrorBoundary zone="panel" name="Browsers">
                                <Browsers />
                            </ErrorBoundary>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Bottom Panel (Smart Controls / Mixer / Editors) */}
            {showBottomPanel && (
                <div 
                    id="bottom-panel"
                    ref={bottomPanelRef}
                    className="bg-[#1a1a1a] flex flex-col shrink-0 border-t border-[#000] overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-30 relative"
                    style={{ height: `${bottomPanelHeight}px` }}
                >
                    {/* Resize Handle */}
                    <div 
                        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-50 hover:bg-sky-500/50 transition-colors"
                        onMouseDown={handleResizeMouseDown}
                        onDoubleClick={() => {
                            setBottomPanelHeight(320);
                        }}
                    ></div>

                    <div className="flex-1 min-h-0 overflow-hidden">
                        {bottomPanel === 'smartcontrols' && (
                            <ErrorBoundary zone="panel" name="SmartControls">
                                <SmartControls />
                            </ErrorBoundary>
                        )}
                        {bottomPanel === 'mixer' && (
                            <ErrorBoundary zone="panel" name="Mixer">
                                <Mixer />
                            </ErrorBoundary>
                        )}
                        {bottomPanel === 'pianoroll' && (
                            <ErrorBoundary zone="panel" name="PianoRoll">
                                <PianoRoll />
                            </ErrorBoundary>
                        )}
                    </div>
                </div>
            )}

            {/* 5. View Control Bar (Bottom) */}
            <ErrorBoundary zone="transport" name="ViewControlBar">
                <ViewControlBar bottomPanel={bottomPanel} />
            </ErrorBoundary>

            <ErrorBoundary name="GlobalKeyHandler">
                <GlobalKeyHandler />
            </ErrorBoundary>
            {showNewTrackDialog && (
                <ErrorBoundary name="NewTrackDialog">
                    <NewTrackDialog onClose={() => toggleNewTrackDialog(false)} />
                </ErrorBoundary>
            )}
            {showSearchAndSelect && (
                <ErrorBoundary name="SearchDialog">
                    <SearchAndSelectDialog />
                </ErrorBoundary>
            )}
            {showColorPalette && (
                <ErrorBoundary name="ColorPalette">
                    <ColorPalette />
                </ErrorBoundary>
            )}
            {showIconBrowser && (
                <ErrorBoundary name="IconBrowser">
                    <IconBrowser />
                </ErrorBoundary>
            )}
            {showDrumReplacement && (
                <ErrorBoundary name="DrumReplacement">
                    <DrumReplacementDialog />
                </ErrorBoundary>
            )}
            {showTrackHeaderConfig && (
                <ErrorBoundary name="TrackHeaderConfig">
                    <TrackHeaderConfigDialog />
                </ErrorBoundary>
            )}
            {showArticulationEditor && (
                <ErrorBoundary name="ArticulationEditor">
                    <ArticulationSetEditor />
                </ErrorBoundary>
            )}
            {showSelectionBasedProcessing && (
                <ErrorBoundary name="SelectionBasedProcessing">
                    <SelectionBasedProcessing />
                </ErrorBoundary>
            )}
            {showExportDialog && (
                <ErrorBoundary name="ExportDialog">
                    <ExportDialog />
                </ErrorBoundary>
            )}
            {showShareDialog && (
                <ErrorBoundary name="ShareDialog">
                    <ShareDialog />
                </ErrorBoundary>
            )}
            <ErrorBoundary name="VirtualKeyboard">
                <VirtualKeyboard />
            </ErrorBoundary>
            {showNoteRepeatDialog && (
                <ErrorBoundary name="NoteRepeatDialog">
                    <NoteRepeatDialog />
                </ErrorBoundary>
            )}
            {showSpotEraseDialog && (
                <ErrorBoundary name="SpotEraseDialog">
                    <SpotEraseDialog />
                </ErrorBoundary>
            )}
            {showStepInputKeyboard && (
                <ErrorBoundary name="StepInputKeyboard">
                    <StepInputKeyboard />
                </ErrorBoundary>
            )}
            {showBounceTrackDialog && (
                <ErrorBoundary name="BounceTrack">
                    <BounceTrackDialog />
                </ErrorBoundary>
            )}
            {showBounceRegionsDialog && (
                <ErrorBoundary name="BounceRegions">
                    <BounceRegionsDialog />
                </ErrorBoundary>
            )}
            {showBounceAllTracksDialog && (
                <ErrorBoundary name="BounceAllTracks">
                    <BounceAllTracksDialog />
                </ErrorBoundary>
            )}
            {showTutorial && (
                <OnboardingOverlay
                    onComplete={() => { tutorialStore.complete(); setShowTutorial(false); }}
                    onDismiss={() => { tutorialStore.complete(); setShowTutorial(false); }}
                />
            )}
            <ErrorBoundary name="PluginEditor">
                <PluginEditorWindow />
            </ErrorBoundary>
            <ErrorBoundary name="Preferences">
                <PreferencesDialog />
            </ErrorBoundary>
        </div>
    )
}
