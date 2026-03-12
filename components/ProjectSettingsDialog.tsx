"use client"

import React, { useState } from 'react'
import { useProjectStore } from '@/store/projectStore'
import { X, Settings, Activity, Circle, Timer, Music, FileText, Share2, Headphones, Layers, FolderHeart, Keyboard, SlidersHorizontal } from 'lucide-react'
import { KeyCommandsManager } from './KeyCommandsManager'
interface ProjectSettingsDialogProps {
    onClose: () => void
}

type MainTab = 'General' | 'Audio' | 'Recording' | 'Smart Tempo' | 'MIDI' | 'Score' | 'Movie' | 'Sync' | 'Metronome' | 'Tuning' | 'Assets' | 'Control Surfaces' | 'Key Commands'
type GeneralSubTab = 'General' | 'Project'
type MidiSubTab = 'General' | 'Input Filter' | 'Chase' | 'Clip Length'

export function ProjectSettingsDialog({ onClose }: ProjectSettingsDialogProps) {
    const {
        settings, updateProjectSettings,
        projectFormat, surroundFormat, spatialAudioMode,
        globalSettings, updateGlobalSettings,
        assignKeyCommand, removeKeyCommand, resetKeyCommands, exportKeyCommands,
        addControlSurface, updateControlSurface, removeControlSurface,
        addControlSurfaceAssignment, updateControlSurfaceAssignment, removeControlSurfaceAssignment,
        toggleControlSurfacesBypass,
        tempo, setTempo,
        globalTracks, updateTempoPoint
    } = useProjectStore();
    const [activeTab, setActiveTab] = useState<MainTab>('General');
    const [generalSubTab, setGeneralSubTab] = useState<GeneralSubTab>('Project');
    const [midiSubTab, setMidiSubTab] = useState<MidiSubTab>('Chase');
    const [settingsMode, setSettingsMode] = useState<'global' | 'project'>(globalSettings.useProjectSettings ? 'project' : 'global');
    const isProjectMode = settingsMode === 'project';
    const [keyCommandImport, setKeyCommandImport] = useState('');


    const toggleChase = (key: string, subKey?: string) => {
        const chase = { ...settings.midi.chase };
        if (subKey) {
            (chase as any)[key] = { ...(chase as any)[key], [subKey]: !(chase as any)[key][subKey] };
        } else {
            (chase as any)[key] = !(chase as any)[key];
        }
        updateProjectSettings({ midi: { ...settings.midi, chase } });
    };

    const renderField = (label: string, value: any, onChange: (v: any) => void, type: 'text' | 'number' | 'select' | 'checkbox' = 'text', options?: any[], disabled = false) => (
        <div className="flex items-center justify-between py-1 group h-8 opacity-100" style={{ opacity: disabled ? 0.5 : 1 }}>
            <span className="text-[13px] font-medium text-[#1c1c1e]">{label}:</span>
            <div className="flex-1 flex justify-end">
                {type === 'text' && <input disabled={disabled} className="w-32 bg-white border border-[#d1d1d6] rounded px-2 py-0.5 text-[13px] text-right focus:ring-1 focus:ring-sky-500 outline-none" value={value} onChange={e => onChange(e.target.value)} />}
                {type === 'number' && <input disabled={disabled} type="number" className="w-20 bg-white border border-[#d1d1d6] rounded px-2 py-0.5 text-[13px] text-right focus:ring-1 focus:ring-sky-500 outline-none" value={value} onChange={e => onChange(Number(e.target.value))} />}
                {type === 'select' && (
                    <select disabled={disabled} className="w-32 bg-white border border-[#d1d1d6] rounded px-1 py-0.5 text-[13px] outline-none" value={value} onChange={e => onChange(e.target.value)}>
                        {options?.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
                    </select>
                )}
                {type === 'checkbox' && (
                    <div onClick={() => !disabled && onChange(!value)} className={`w-4 h-4 rounded border transition-all flex items-center justify-center cursor-pointer ${value ? 'bg-sky-500 border-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]' : 'bg-white border-[#d1d1d6] group-hover:border-gray-400'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {value && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
                    </div>
                )}
            </div>
        </div>
    );

    const renderChaseOption = (label: string, value: boolean, onChange: () => void, indent = false, disabled = false) => (
        <label className={`flex items-center gap-3 py-1 cursor-pointer group ${indent ? 'pl-8' : ''} ${disabled ? 'opacity-40 cursor-default' : ''}`}>
            <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${value ? 'bg-sky-500 border-sky-600 shadow-[0_0_8px_rgba(14,165,233,0.4)]' : 'bg-white border-[#d1d1d6] group-hover:border-gray-400'}`}>
                {value && <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>}
            </div>
            <span className="text-[13px] font-medium text-[#1c1c1e]">{label}</span>
            <input type="checkbox" className="hidden" checked={value} onChange={onChange} disabled={disabled} />
        </label>
    );

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#f2f2f7] w-[720px] h-[580px] rounded-xl shadow-[0_30px_90px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-[#1c1c1e] animate-in zoom-in-95 duration-200 border border-white/20">

                {/* Header with Tool Icons */}
                <div className="pt-4 pb-2 px-4 flex flex-col items-center">
                    <div className="flex w-full justify-between items-start mb-4">
                        <div className="w-10"></div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter opacity-60">Logic DAW Project</span>
                            <span className="text-[15px] font-bold">Project Settings</span>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex justify-between w-full px-4 mb-2">
                        {[
                            { name: 'General', icon: Settings },
                            { name: 'Audio', icon: Activity },
                            { name: 'Recording', icon: Circle },
                            { name: 'Smart Tempo', icon: Timer },
                            { name: 'MIDI', icon: Music },
                            { name: 'Score', icon: FileText },
                            { name: 'Movie', icon: Headphones },
                            { name: 'Sync', icon: Share2 },
                            { name: 'Metronome', icon: Layers },
                            { name: 'Tuning', icon: Timer },
                            { name: 'Assets', icon: FolderHeart },
                            { name: 'Control Surfaces', icon: SlidersHorizontal },
                            { name: 'Key Commands', icon: Keyboard },
                        ].map((t) => (
                            <button
                                key={t.name}
                                onClick={() => setActiveTab(t.name as MainTab)}
                                className={`flex flex-col items-center gap-1 group transition-all ${activeTab === t.name ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm border ${activeTab === t.name ? 'bg-sky-500 text-white border-sky-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                                    <t.icon className="w-4 h-4" />
                                </div>
                                <span className={`text-[9px] font-bold ${activeTab === t.name ? 'text-sky-600' : 'text-gray-500'}`}>{t.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-4 py-2 border-b border-[#d1d1d6] flex items-center justify-between gap-2 bg-white">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-gray-500">Settings Scope:</span>
                        <button
                            onClick={() => { setSettingsMode('global'); updateGlobalSettings({ useProjectSettings: false }); }}
                            className={`px-2 py-1 rounded-md text-[12px] ${settingsMode === 'global' ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >Global</button>
                        <button
                            onClick={() => { setSettingsMode('project'); updateGlobalSettings({ useProjectSettings: true }); }}
                            className={`px-2 py-1 rounded-md text-[12px] ${settingsMode === 'project' ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        >Project</button>
                    </div>
                    <span className="text-xs text-gray-600">{settingsMode === 'project' ? 'Project overrides active' : 'Global preferences enforced (project fields locked)'}</span>
                </div>

                {/* Sub-Tabs */}
                {activeTab === 'General' && (
                    <div className="flex justify-center border-b border-[#d1d1d6] gap-1 py-1">
                        {['General', 'Project'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setGeneralSubTab(st as GeneralSubTab)}
                                className={`px-4 py-1 text-[12px] font-bold rounded-md transition-all ${generalSubTab === st ? 'bg-white shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-black'}`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}
                {activeTab === 'MIDI' && (
                    <div className="flex justify-center border-b border-[#d1d1d6] gap-1 py-1">
                        {['General', 'Input Filter', 'Chase', 'Clip Length'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setMidiSubTab(st as MidiSubTab)}
                                className={`px-4 py-1 text-[12px] font-bold rounded-md transition-all ${midiSubTab === st ? 'bg-white shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-black'}`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto bg-white/50 p-8">
                    {activeTab === 'General' && generalSubTab === 'Project' && (
                        <div className="max-w-md space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Project Settings</h3>
                                {renderField('Tempo', tempo, (v) => setTempo(v), 'number', undefined, !isProjectMode)}
                                {renderField('Key', globalTracks.key[0].root, (v) => { }, 'select', ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], !isProjectMode)}
                                {renderField('Scale', globalTracks.key[0].mode, (v) => { }, 'select', ['major', 'minor'], !isProjectMode)}
                                {renderField('Time Signature', `${globalTracks.signature[0].numerator}/${globalTracks.signature[0].denominator}`, (v) => { }, 'select', ['4/4', '3/4', '2/4', '6/8'], !isProjectMode)}
                            </div>

                            <div className="space-y-1 pt-4">
                                <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Project Bounds</h3>
                                {renderField('Project Start', settings.projectStart, (v) => updateProjectSettings({ projectStart: v }), 'number', undefined, !isProjectMode)}
                                {renderField('Project End', settings.projectEnd, (v) => updateProjectSettings({ projectEnd: v }), 'number', undefined, !isProjectMode)}
                                {renderField('Use Auto Project End', settings.autoProjectEnd, (v) => updateProjectSettings({ autoProjectEnd: v }), 'checkbox', undefined, !isProjectMode)}
                            </div>

                            <div className="space-y-1 pt-4">
                                <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Audio</h3>
                                {renderField('Master Volume', Math.round(settings.masterVolume * 100), (v) => updateProjectSettings({ masterVolume: v / 100 }), 'number', undefined, !isProjectMode)}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Audio' && (
                        <div className="max-w-xl space-y-4">
                            <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Audio Settings</h3>

                            <div className="p-3 border border-[#d1d1d6] rounded-md bg-white">
                                <h4 className="text-[13px] font-semibold mb-2">Project Audio (override when project enabled)</h4>
                                {renderField('Project Format', projectFormat, (v) => updateProjectSettings({ projectFormat: v as any }), 'select', ['stereo', 'surround', 'dolby-atmos'], !isProjectMode)}
                                {renderField('Surround Format', surroundFormat, (v) => updateProjectSettings({ surroundFormat: v as any }), 'select', ['Quadraphonic', 'LCR (Pro Logic)', '5.1 (ITU 775)', '6.1 (ES/EX)', '7.1', '7.1 (SDDS)', '5.1.2', '5.1.4', '7.1.2', '7.1.4'], !isProjectMode)}
                                {renderField('Spatial Audio Mode', spatialAudioMode, (v) => updateProjectSettings({ spatialAudioMode: v as any }), 'select', ['Off', 'Dolby Atmos'], !isProjectMode)}
                                {renderField('Sample Rate', settings.sampleRate, (v) => updateProjectSettings({ sampleRate: v as any }), 'select', [44100, 48000, 88200, 96000], !isProjectMode)}
                                {renderField('Frame Rate', settings.frameRate, (v) => updateProjectSettings({ frameRate: v }), 'number', undefined, !isProjectMode)}
                            </div>

                            <div className="p-3 border border-[#d1d1d6] rounded-md bg-white">
                                <h4 className="text-[13px] font-semibold mb-2">Global Audio Preferences</h4>
                                {renderField('Input Device', globalSettings.audio.inputDevice, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, inputDevice: v } }), 'text')}
                                {renderField('Output Device', globalSettings.audio.outputDevice, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, outputDevice: v } }), 'text')}
                                {renderField('IO Buffer Size', globalSettings.audio.ioBufferSize, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, ioBufferSize: v } }), 'number')}
                                {renderField('Sample Accurate Automation', globalSettings.audio.sampleAccurateAutomation, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, sampleAccurateAutomation: v as any } }), 'select', ['Off', 'VolumePanSends', 'All'])}
                                {renderField('Software Monitoring', globalSettings.audio.softwareMonitoring, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, softwareMonitoring: v } }), 'checkbox')}
                                {renderField('Low Latency Monitoring', globalSettings.audio.lowLatencyMonitoring, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, lowLatencyMonitoring: v } }), 'checkbox')}
                                {renderField('Low Latency Limit (ms)', globalSettings.audio.lowLatencyLimitMs, (v) => updateGlobalSettings({ audio: { ...globalSettings.audio, lowLatencyLimitMs: v } }), 'number')}
                            </div>
                        </div>
                    )}

                    {activeTab === 'MIDI' && midiSubTab === 'Chase' && (
                        <div className="max-w-md space-y-2">
                            {renderChaseOption('Notes', settings.midi.chase.notes, () => toggleChase('notes'))}
                            {renderChaseOption('Sustained', settings.midi.chase.sustained, () => toggleChase('sustained'), true, !settings.midi.chase.notes)}
                            {renderChaseOption('In No Transpose instrument channel strips', settings.midi.chase.inNoTransposeInstruments, () => toggleChase('inNoTransposeInstruments'), true, !settings.midi.chase.notes)}

                            <div className="h-2"></div>

                            {renderChaseOption('Program Change', settings.midi.chase.programChange, () => toggleChase('programChange'))}
                            {renderChaseOption('Pitch Bend', settings.midi.chase.pitchBend, () => toggleChase('pitchBend'))}

                            <div className="py-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded border bg-sky-500 border-sky-600 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                                    </div>
                                    <span className="text-[13px] font-medium text-[#1c1c1e]">Control Changes</span>
                                </div>
                                <div className="space-y-1 mt-1">
                                    {renderChaseOption('0-15', settings.midi.chase.controlChanges.cc0_15, () => toggleChase('controlChanges', 'cc0_15'), true)}
                                    {renderChaseOption('64-71', settings.midi.chase.controlChanges.cc64_71, () => toggleChase('controlChanges', 'cc64_71'), true)}
                                    {renderChaseOption('All Other', settings.midi.chase.controlChanges.allOther, () => toggleChase('controlChanges', 'allOther'), true)}
                                </div>
                            </div>

                            {renderChaseOption('Aftertouch', settings.midi.chase.aftertouch, () => toggleChase('aftertouch'))}
                            {renderChaseOption('Polyphonic Aftertouch', settings.midi.chase.polyAftertouch, () => toggleChase('polyAftertouch'))}
                            {renderChaseOption('System Exclusive', settings.midi.chase.sysEx, () => toggleChase('sysEx'))}
                            {renderChaseOption('Text Meta Events', settings.midi.chase.textMeta, () => toggleChase('textMeta'))}

                            <div className="h-2"></div>

                            {renderChaseOption('Chase separate channels in All Channels instruments', settings.midi.chase.separateChannels, () => toggleChase('separateChannels'))}

                            <div className="py-1">
                                <div className="flex items-center gap-3">
                                    <div className="w-3.5 h-3.5 rounded border bg-sky-500 border-sky-600 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                                    </div>
                                    <span className="text-[13px] font-medium text-[#1c1c1e]">Chase on cycle jump</span>
                                </div>
                                <div className="mt-1">
                                    {renderChaseOption('Notes', settings.midi.chase.chaseOnCycleNotes, () => toggleChase('chaseOnCycleNotes'), true)}
                                </div>
                            </div>

                            {renderChaseOption('Send full MIDI reset before chasing', settings.midi.chase.sendReset, () => toggleChase('sendReset'))}
                        </div>
                    )}

                    {activeTab === 'Control Surfaces' && (
                        <div className="max-w-xl space-y-4">
                            <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Control Surfaces</h3>
                            <p className="text-[12px] text-gray-600 mb-3">Add hardware devices and map their MIDI/OSC messages to existing commands.</p>
                            <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                <input type="checkbox" checked={globalSettings.controlSurfacesBypassed} onChange={() => toggleControlSurfacesBypass()} className="w-4 h-4" />
                                <span className="text-[13px] font-medium">Bypass Control Surfaces</span>
                            </label>
                            <div className="space-y-2">
                                {globalSettings.controlSurfaces.map(device => (
                                    <div key={device.id} className="flex flex-col gap-1 py-1 text-[13px] border-b last:border-b-0">
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="flex-1 bg-white border border-[#d1d1d6] rounded px-2 py-1 text-[12px]"
                                                value={device.name}
                                                onChange={e => updateControlSurface(device.id, { name: e.target.value })}
                                            />
                                            <select
                                                className="text-[12px]"
                                                value={device.type}
                                                onChange={e => updateControlSurface(device.id, { type: e.target.value as any })}
                                            >
                                                <option value="MIDI">MIDI</option>
                                                <option value="OSC">OSC</option>
                                                <option value="Generic">Generic</option>
                                            </select>
                                            <label className="text-[12px]">
                                                <input type="checkbox" checked={device.enabled} onChange={e => updateControlSurface(device.id, { enabled: e.target.checked })} /> Enabled
                                            </label>
                                            <button
                                                className="px-2 py-1 rounded border hover:bg-gray-100 text-[12px]"
                                                onClick={() => removeControlSurface(device.id)}
                                            >Remove</button>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <input
                                                className="w-32 bg-white border border-[#d1d1d6] rounded px-2 py-1"
                                                placeholder="input id"
                                                value={device.inputId || ''}
                                                onChange={e => updateControlSurface(device.id, { inputId: e.target.value || undefined })}
                                            />
                                            <input
                                                className="w-32 bg-white border border-[#d1d1d6] rounded px-2 py-1"
                                                placeholder="output id"
                                                value={device.outputId || ''}
                                                onChange={e => updateControlSurface(device.id, { outputId: e.target.value || undefined })}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button
                                    className="mt-1 px-3 py-1.5 rounded border bg-white text-[12px]"
                                    onClick={() => {
                                        const id = `cs-${Date.now()}`;
                                        addControlSurface({ id, name: 'New Device', type: 'MIDI', enabled: true, inputId: '', outputId: '' });
                                    }}
                                >Add Device</button>
                            </div>

                            <h4 className="text-[13px] font-bold pt-4">Assignments</h4>
                            <div className="overflow-y-auto max-h-[200px] border border-[#d1d1d6] rounded-md bg-white p-2">
                                {globalSettings.controlSurfaceAssignments.map(assn => (
                                    <div key={assn.id} className="flex flex-col gap-1 py-1 border-b last:border-b-0">
                                        <div className="flex items-center gap-2">
                                            <select
                                                className="text-[12px]"
                                                value={assn.deviceId || ''}
                                                onChange={e => updateControlSurfaceAssignment(assn.id, { deviceId: e.target.value || undefined })}
                                            >
                                                <option value="">Any</option>
                                                {globalSettings.controlSurfaces.map(cs => (
                                                    <option key={cs.id} value={cs.id}>{cs.name}</option>
                                                ))}
                                            </select>
                                            <input className="w-16 text-[12px]" value={assn.status.toString(16)} onChange={e => updateControlSurfaceAssignment(assn.id, { status: parseInt(e.target.value, 16) || 0 })} placeholder="status" />
                                            <input className="w-8 text-[12px]" value={assn.channel} onChange={e => updateControlSurfaceAssignment(assn.id, { channel: Number(e.target.value) })} placeholder="ch" />
                                            <input className="w-8 text-[12px]" value={assn.data1} onChange={e => updateControlSurfaceAssignment(assn.id, { data1: Number(e.target.value) })} placeholder="d1" />
                                            <input className="w-8 text-[12px]" value={assn.data2 || ''} onChange={e => updateControlSurfaceAssignment(assn.id, { data2: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="d2" />
                                            <select className="text-[12px]" value={assn.mode} onChange={e => updateControlSurfaceAssignment(assn.id, { mode: e.target.value as any })}>
                                                <option value="direct">Direct</option>
                                                <option value="toggle">Toggle</option>
                                                <option value="relative">Relative</option>
                                            </select>
                                            <select className="text-[12px] flex-1" value={assn.commandId} onChange={e => updateControlSurfaceAssignment(assn.id, { commandId: e.target.value })}>
                                                {globalSettings.keyCommands.map(cmd => (
                                                    <option key={cmd.id} value={cmd.id}>{cmd.name}</option>
                                                ))}
                                            </select>
                                            <button className="px-2 py-1 rounded border hover:bg-gray-100 text-[12px]" onClick={() => removeControlSurfaceAssignment(assn.id)}>X</button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    className="mt-1 px-3 py-1.5 rounded border bg-white text-[12px]"
                                    onClick={() => {
                                        const id = `csa-${Date.now()}`;
                                        addControlSurfaceAssignment({ id, status: 0x90, channel: 0, data1: 0, mode: 'direct', commandId: globalSettings.keyCommands[0]?.id || '' });
                                    }}
                                >Add Assignment</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Key Commands' && (
                        <div className="px-2 py-1">
                            <KeyCommandsManager />
                        </div>
                    )}

                    {activeTab === 'Key Commands' && (
                        <div className="max-w-xl space-y-4">
                            <h3 className="text-[14px] font-bold border-b border-black/5 pb-1 mb-2">Key Commands</h3>

                            <div className="max-h-[260px] overflow-y-auto border border-[#d1d1d6] rounded-md bg-white p-2">
                                {globalSettings.keyCommands.map(cmd => (
                                    <div key={cmd.id} className="flex items-center gap-2 py-1 px-2 border-b last:border-b-0">
                                        <div className="w-36 text-xs font-semibold text-gray-700">{cmd.name}</div>
                                        <input
                                            type="text"
                                            value={cmd.shortcut}
                                            onChange={e => assignKeyCommand(cmd.id, e.target.value)}
                                            className="w-28 text-xs border border-gray-200 rounded px-2 py-1"
                                            placeholder="Shortcut"
                                        />
                                        <button className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200" onClick={() => assignKeyCommand(cmd.id, cmd.defaultShortcut)}>Default</button>
                                        <button className="px-2 py-1 text-xs bg-red-100 rounded hover:bg-red-200" onClick={() => removeKeyCommand(cmd.id)}>Clear</button>
                                        <span className="text-[11px] text-gray-500">{cmd.description}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="px-4 py-2 text-xs font-bold bg-sky-500 text-white rounded hover:bg-sky-400" onClick={() => { resetKeyCommands(); setKeyCommandImport('') }}>Reset All to Defaults</button>
                                <button className="px-4 py-2 text-xs font-bold bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={() => { const json = exportKeyCommands(); setKeyCommandImport(json); navigator.clipboard?.writeText(json); }}>Export to Clipboard</button>
                                <button className="px-4 py-2 text-xs font-bold bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={() => { try { const data = JSON.parse(keyCommandImport); importKeyCommands(data); } catch (e) { alert('Invalid key commands JSON'); } }}>Import</button>
                            </div>

                            <textarea
                                className="w-full h-24 bg-white border border-gray-200 rounded p-2 text-xs"
                                value={keyCommandImport}
                                onChange={e => setKeyCommandImport(e.target.value)}
                                placeholder='Paste key commands JSON here'
                            />
                        </div>
                    )}

                    {activeTab !== 'MIDI' && activeTab !== 'Key Commands' && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                            <Settings className="w-12 h-12 opacity-10" />
                            <span className="text-sm font-medium italic">Settings for {activeTab} coming soon...</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#e5e5ea] flex justify-end">
                    <button onClick={onClose} className="px-8 py-1.5 rounded bg-[#007aff] text-white text-[13px] font-bold shadow-sm active:bg-[#0062cc]">Done</button>
                </div>
            </div>
        </div>
    )
}
