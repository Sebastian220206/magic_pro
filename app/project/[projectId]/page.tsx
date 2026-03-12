"use client"
import { useEffect } from "react"
import { audioEngine } from "@/engine/audioEngine"
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
        showStepInputKeyboard
    } = useProjectStore()

    useEffect(() => {
        // Load user global preferences before project settings.
        loadGlobalSettings();
        if (params.projectId && params.projectId !== "new") {
            loadProject(params.projectId)
        }
    }, [params.projectId, loadProject, loadGlobalSettings])

    useEffect(() => {
        audioEngine.initMidi()
    }, [])

    const showBottomPanel = showSmartControls || showMixer || showEditors;
    const showRightSidebar = showListEditors || showNotePad || showLoopBrowser || showBrowsers;

    return (
        <div className="flex flex-col h-screen w-full bg-[#000] overflow-hidden text-sm selection:bg-sky-500/30">
            {/* Top: Control Bar (Transport) */}
            <TransportBar />

            {/* Area Row: Toolbar (Toggleable) */}
            <Toolbar />

            {/* Main Workspace Area */}
            <div className="flex flex-1 overflow-hidden min-h-0 relative">

                {/* 1. Left Drawer: Library */}
                {showLibrary && <LibraryPanel />}

                {/* 2. Central Workspace (Inspector + Tracks Area) */}
                <div className="flex flex-1 overflow-hidden h-full">
                    {/* Inspector Sidebar */}
                    {showInspector && <Inspector />}

                    {/* Arrangement View */}
                    <div className="flex flex-1 flex-col overflow-hidden bg-[#000]">
                        <TracksAreaMenuBar />
                        <GlobalTracks />

                        <div className="flex flex-1 overflow-hidden min-h-0">
                            {showLiveLoopsGrid && (
                                <div className={`h-full ${showTracksArea ? 'w-1/2' : 'w-full'} border-r border-white/10`}>
                                    <LiveLoopsGrid />
                                </div>
                            )}

                            {showTracksArea && (
                                <div className={`flex flex-1 overflow-hidden ${showLiveLoopsGrid ? 'w-1/2' : 'w-full'}`}>
                                    <TrackList />
                                    <Timeline />
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

            {showAudioTrackEditor && <AudioTrackEditor />}

                {/* 3. Right Sidebar: Browsers / Notes / Lists */}
                {showRightSidebar && (
                    <div className="flex h-full overflow-hidden shrink-0 border-l border-black bg-[#1a1a1a] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-40">
                        {showListEditors && <ListEditors />}
                        {showNotePad && <NotePad />}
                        {showLoopBrowser && <LoopBrowser />}
                        {showBrowsers && <Browsers />}
                    </div>
                )}
            </div>

            {/* 4. Bottom Panel (Smart Controls / Mixer / Editors) */}
            {showBottomPanel && (
                <div className="h-[320px] bg-[#1a1a1a] flex flex-col shrink-0 border-t border-[#000] overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-30">
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {bottomPanel === 'smartcontrols' && <SmartControls />}
                        {bottomPanel === 'mixer' && <Mixer />}
                        {bottomPanel === 'pianoroll' && <PianoRoll />}
                    </div>
                </div>
            )}

            <GlobalKeyHandler />
            {showNewTrackDialog && <NewTrackDialog onClose={() => toggleNewTrackDialog(false)} />}
            {showSearchAndSelect && <SearchAndSelectDialog />}
            {showColorPalette && <ColorPalette />}
            {showIconBrowser && <IconBrowser />}
            {showDrumReplacement && <DrumReplacementDialog />}
            {showTrackHeaderConfig && <TrackHeaderConfigDialog />}
            {showArticulationEditor && <ArticulationSetEditor />}
            {showSelectionBasedProcessing && <SelectionBasedProcessing />}
            {showExportDialog && <ExportDialog />}
            {showShareDialog && <ShareDialog />}
            <VirtualKeyboard />
            {showNoteRepeatDialog && <NoteRepeatDialog />}
            {showSpotEraseDialog && <SpotEraseDialog />}
            {showStepInputKeyboard && <StepInputKeyboard />}
            {showBounceTrackDialog && <BounceTrackDialog />}
            {showBounceRegionsDialog && <BounceRegionsDialog />}
            {showBounceAllTracksDialog && <BounceAllTracksDialog />}
        </div>
    )
}
