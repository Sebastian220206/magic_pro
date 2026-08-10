"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, Play, MousePointer2, Sparkles, Music } from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  highlightSelector?: string;
}

const STEPS: Step[] = [
  {
    id: "play",
    title: "Press Play",
    description: "Hit the Play button in the transport bar to hear your project.",
    icon: <Play className="w-5 h-5 text-green-400" />,
    targetSelector: "[data-testid='play-button']",
    highlightSelector: "[data-testid='transport-bar']",
  },
  {
    id: "piano-roll",
    title: "Click the Piano Roll",
    description: "Double-click a MIDI clip to open the piano roll and see the notes.",
    icon: <MousePointer2 className="w-5 h-5 text-accent-cyan" />,
    highlightSelector: "[class*='timeline']",
  },
  {
    id: "add-loop",
    title: "Add a Loop",
    description: "Open the Loop Browser and drag a loop onto a track to add more sounds.",
    icon: <Music className="w-5 h-5 text-purple-400" />,
    targetSelector: "[data-testid='loop-browser-button']",
  },
  {
    id: "congrats",
    title: "You made your first beat!",
    description: "Keep experimenting — add more tracks, change sounds, and make it yours.",
    icon: <Sparkles className="w-5 h-5 text-yellow-400" />,
  },
];

interface Props {
  onComplete: () => void;
  onDismiss: () => void;
}

export function OnboardingOverlay({ onComplete, onDismiss }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex(i => i + 1);
    }
  }, [isLast, onComplete]);

  useEffect(() => {
    if (step.highlightSelector) {
      const el = document.querySelector(step.highlightSelector);
      el?.classList.add("ring-2", "ring-daw-primary", "ring-offset-2", "ring-offset-daw-bg", "transition-all", "duration-300");
      return () => {
        el?.classList.remove("ring-2", "ring-daw-primary", "ring-offset-2", "ring-offset-daw-bg");
      };
    }
  }, [step.highlightSelector, stepIndex]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 bg-black/40" />

      {/*
        * Tight to the bottom edge on short screens. At `bottom-8` with `p-5`
        * this card covered close to half of a landscape phone, hiding the very
        * tracks area the tour is pointing at.
        */}
      <div className="absolute bottom-2 sm:bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto w-full max-w-md px-3 sm:px-4">
        <div className="bg-daw-panel/95 backdrop-blur-sm border border-daw-border rounded-xl p-3 sm:p-5 shadow-2xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-daw-surface flex items-center justify-center">
                {step.icon}
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{step.title}</h3>
                <div className="flex gap-1 mt-1">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-daw-primary' : 'bg-studio-control'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-studio-text-dim hover:text-white transition p-1 -mr-1 -mt-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-studio-text-mid text-sm mb-4">{step.description}</p>

          <button
            onClick={handleNext}
            className="w-full bg-daw-primary text-white py-2 rounded-lg hover:bg-accent-cyan transition font-medium text-sm flex items-center justify-center gap-1.5"
          >
            {isLast ? "Got it!" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
