"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import { templateCatalog, createProjectFromTemplate, starterTemplates } from '@/templates';
import { useProjectStore } from '@/store/projectStore';
import { audioEngine } from '@/engine/AudioEngineAdapter';

/*
 * The icon and gradient lookup tables that used to live here were keyed
 * 'lo-fi', but the template's id is 'lofi-beat', so that card always fell
 * through to the grey default. Every template already carries its own
 * `previewIcon` and `accentColor`; using those removes the chance of the two
 * drifting again.
 */

interface NewProjectScreenProps {
  onClose?: () => void;
}

export function NewProjectScreen({ onClose }: NewProjectScreenProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleSelectTemplate = async (templateId: string) => {
    setCreating(true);
    try {
      await audioEngine.waitForReady();
      const template = templateCatalog.find(t => t.id === templateId);
      if (!template) return;
      const proj = await createProjectFromTemplate(template);
      router.push(`/project/${proj.id}`);
    } catch (e) {
      console.error('[NewProjectScreen] Template creation failed:', e);
      setCreating(false);
    }
  };

  const handleBlankProject = async () => {
    setCreating(true);
    try {
      await audioEngine.waitForReady();
      useProjectStore.getState().initializeProject({
        tempo: 90,
        keySignature: 'C Major',
        timeSignature: '4/4',
      });
      const store = useProjectStore.getState();
      const drumTrackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const pianoTrackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      // Added in one update, the way the template path does it. Two separate
      // `addTrack` calls let autosave persist the project in between, and the
      // studio then restored that trackless snapshot over the real one.
      store.addTracks([
        { id: drumTrackId, name: 'Drums', type: 'drummer', color: '#f59e0b' },
        { id: pianoTrackId, name: 'Piano', type: 'software-instrument', color: '#34d399', instrument: 'piano' },
      ] as any);
      router.push(`/project/${useProjectStore.getState().id}`);
    } catch (e) {
      console.error('[NewProjectScreen] Blank project creation failed:', e);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="min-h-screen flex flex-col items-center justify-center p-8 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90 z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-2">New Project</h1>
            <p className="text-gray-400">Choose a template to get started, or create a blank project</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {creating && (
              <div className="col-span-full flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                Initializing audio engine...
              </div>
            )}

            {!creating && starterTemplates.map(tpl => (
              <button
                key={tpl.id}
                disabled={creating}
                onClick={() => handleSelectTemplate(tpl.id)}
                className="group relative bg-daw-panel border border-daw-border rounded-xl p-6 hover:border-gray-500 transition-all hover:scale-[1.02] text-left disabled:opacity-50 disabled:pointer-events-none"
              >
                <div
                  className="h-32 rounded-lg border border-daw-border mb-4 flex items-center justify-center text-4xl"
                  style={{ background: `linear-gradient(135deg, ${tpl.accentColor}33, transparent 70%)` }}
                >
                  {tpl.previewIcon}
                </div>
                <h3 className="text-lg text-white font-semibold group-hover:text-daw-primary transition-colors">{tpl.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{tpl.description}</p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs bg-daw-surface text-gray-300 px-2 py-0.5 rounded">{tpl.bpm} BPM</span>
                  <span className="text-xs bg-daw-surface text-gray-300 px-2 py-0.5 rounded">{tpl.tracks.length} Track{tpl.tracks.length !== 1 ? 's' : ''}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleBlankProject}
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-dashed border-daw-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? "Initializing..." : <Plus className="w-4 h-4" />}
              Blank Project (starts with Drums + Piano)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
