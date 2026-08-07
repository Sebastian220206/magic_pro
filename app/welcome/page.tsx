"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Music, Sparkles, ArrowRight, SkipForward } from "lucide-react";
import { templateCatalog, createProjectFromTemplate } from "@/templates";
import { onboardingStore } from "@/store/onboardingStore";
import { useProjectStore } from "@/store/projectStore";

const gradientMap: Record<string, string> = {
  'lo-fi': 'from-purple-600/30 via-indigo-600/20 to-purple-900/40',
  'edm': 'from-cyan-600/30 via-blue-600/20 to-cyan-900/40',
  'hip-hop': 'from-amber-600/30 via-orange-600/20 to-amber-900/40',
  'piano-sketch': 'from-emerald-600/30 via-teal-600/20 to-emerald-900/40',
};

const iconColors: Record<string, string> = {
  'lo-fi': 'text-purple-300',
  'edm': 'text-cyan-300',
  'hip-hop': 'text-amber-300',
  'piano-sketch': 'text-emerald-300',
};

export default function WelcomePage() {
  const router = useRouter();

  const handleSelectTemplate = async (templateId: string) => {
    const template = templateCatalog.find(t => t.id === templateId);
    if (!template) return;
    onboardingStore.complete();
    const proj = await createProjectFromTemplate(template);
    router.push(`/project/${proj.id}`);
  };

  const handleBlankProject = () => {
    onboardingStore.complete();
    useProjectStore.getState().initializeProject({
      tempo: 90,
      keySignature: 'C Major',
      timeSignature: '4/4',
    });
    const store = useProjectStore.getState();
    const drumTrackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pianoTrackId = `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    store.addTrack({ id: drumTrackId, name: 'Drums', type: 'drummer', color: '#f59e0b' } as any);
    store.addTrack({ id: pianoTrackId, name: 'Piano', type: 'software-instrument', color: '#34d399', instrument: 'piano' } as any);
    router.push(`/project/${useProjectStore.getState().id}`);
  };

  const handleSkip = () => {
    onboardingStore.complete();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-daw-bg flex flex-col">
      <main className="flex-1 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="max-w-4xl w-full text-center">
          <div className="inline-flex items-center gap-2 bg-daw-primary/10 text-fuchsia-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            Make music in 30 seconds
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-4 tracking-tight">
            Make your first beat
            <br />
            <span className="bg-gradient-to-r from-daw-primary to-blue-400 bg-clip-text text-transparent">
              in 30 seconds
            </span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10">
            Pick a starter template, press play, and hear music instantly.
            No setup. No manual routing. Just sound.
          </p>

          {/* Template grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {templateCatalog.filter(t => t.id !== 'podcast').map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl.id)}
                className="group relative bg-daw-panel border border-daw-border rounded-xl p-5 hover:border-gray-500 transition-all hover:scale-[1.03] hover:shadow-xl text-left"
              >
                <div className={`h-24 rounded-lg bg-gradient-to-br ${gradientMap[tpl.id] || 'from-gray-800 to-gray-900'} border border-daw-border mb-3 flex items-center justify-center`}>
                  <Music className={`w-7 h-7 ${iconColors[tpl.id] || 'text-gray-400'}`} />
                </div>
                <h2 className="text-sm font-semibold text-white group-hover:text-daw-primary transition-colors">{tpl.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{tpl.bpm} BPM</p>
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => handleSelectTemplate('lo-fi')}
              className="bg-daw-primary text-white px-8 py-3.5 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-daw-primary/20 flex items-center gap-2"
            >
              Start Creating
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-white transition flex items-center gap-2 px-6 py-3.5 rounded-xl border border-daw-border hover:border-gray-500"
            >
              <SkipForward className="w-4 h-4" />
              Skip to Studio
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-xs text-gray-400">
          No account needed. Everything runs in your browser.
        </p>
      </div>
      </main>
    </div>
  );
}
