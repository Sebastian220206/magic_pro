"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, SkipForward, Loader2, FilePlus2 } from "lucide-react";
import BackgroundVideo from "@/components/marketing/BackgroundVideo";
import { onboardingStore } from "@/store/onboardingStore";

/**
 * Just enough of a template to render a card.
 *
 * Deliberately not `ProjectTemplate`: that type carries full track and clip
 * definitions, and serialising all of it from the server component into the
 * client bundle would put every note of every template into the page payload
 * for the sake of four titles.
 */
export interface TemplateSummary {
    id: string;
    name: string;
    description: string;
    bpm: number;
    genre: string;
    difficulty: string;
    /** Authored per template; previously ignored in favour of a broken lookup. */
    accentColor: string;
    previewIcon: string;
}

interface WelcomeHeroProps {
    templates: TemplateSummary[];
    loopUrl?: string;
    posterUrl?: string;
}

export default function WelcomeHero({ templates, loopUrl, posterUrl }: WelcomeHeroProps) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /**
     * Create a project and open it.
     *
     * `createProjectFromTemplate` is imported here rather than at the top of the
     * module because it drags in the audio engine and the project store. Loading
     * it on click keeps it out of the landing page's first paint entirely.
     */
    const openTemplate = async (templateId: string) => {
        if (busy) return;
        setBusy(templateId);
        setError(null);

        try {
            const [{ createProjectFromTemplate }, { getTemplateById }] = await Promise.all([
                import("@/templates"),
                import("@/templates/catalog"),
            ]);

            const template = getTemplateById(templateId);
            if (!template) {
                // Previously this branch returned silently, which is exactly how
                // the primary button came to do nothing for a wrong id.
                throw new Error(`Template "${templateId}" not found`);
            }

            onboardingStore.complete();
            const project = await createProjectFromTemplate(template);
            router.push(`/project/${project.id}`);
        } catch (err) {
            console.error("[Welcome] Could not start from template:", err);
            setError("Could not open that template. Please try again.");
            setBusy(null);
        }
    };

    const startBlank = async () => {
        if (busy) return;
        setBusy("blank");
        setError(null);

        try {
            const { useProjectStore } = await import("@/store/projectStore");
            onboardingStore.complete();

            const store = useProjectStore.getState();
            store.initializeProject({
                tempo: 90,
                keySignature: "C Major",
                timeSignature: "4/4",
            });

            router.push(`/project/${useProjectStore.getState().id}`);
        } catch (err) {
            console.error("[Welcome] Could not start a blank project:", err);
            setError("Could not create a project. Please try again.");
            setBusy(null);
        }
    };

    const skip = () => {
        onboardingStore.complete();
        router.push("/dashboard");
    };

    const primary = templates[0];

    return (
        <div className="min-h-screen bg-daw-bg select-text">
            {/* ── Hero ─────────────────────────────────────────────────── */}
            {/*
              * No overlay and no zoom: the footage plays at full brightness,
              * unscaled. Legibility comes from `drop-shadow` on the text itself
              * rather than from dimming the video.
              */}
            <BackgroundVideo
                src={loopUrl}
                poster={posterUrl}
                overlay="none"
                className="min-h-[92vh] flex items-center"
            >
                <div className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/50 px-4 py-1.5 text-sm font-medium text-amber-200 backdrop-blur-md">
                        <Sparkles className="h-4 w-4" />
                        Make music in 30 seconds
                    </div>

                    <h1 className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:120ms] fill-mode-backwards mt-8 font-display text-5xl font-bold leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.8)] md:text-7xl">
                        Make your first beat
                        <br />
                        {/*
                          * Deliberately a plain colour, not a clipped gradient.
                          *
                          * Three attempts at a gradient here failed over the
                          * undimmed footage. Amber-on-amber vanished into it. A
                          * sweeping one (`animate-shimmer`) slid through its own
                          * dark stops and faded out once per cycle. Adding
                          * `drop-shadow` to rescue contrast made it worse: a
                          * `filter` on an element using `background-clip: text`
                          * with a transparent colour breaks the clip in
                          * Chromium, and the line rendered grey.
                          *
                          * A solid tint with a text-shadow has none of those
                          * failure modes, and stays readable whatever frame of
                          * the video happens to be behind it.
                          */}
                        <span className="text-fuchsia-200 [text-shadow:0_2px_24px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.8)]">
                            in 30 seconds
                        </span>
                    </h1>

                    <p className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:240ms] fill-mode-backwards mx-auto mt-6 max-w-xl text-lg text-gray-200 [text-shadow:0_1px_12px_rgba(0,0,0,0.95)]">
                        Pick a starter template, press play, and hear music instantly.
                        No setup. No manual routing. Just sound.
                    </p>

                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:360ms] fill-mode-backwards mt-10 flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => primary && openTemplate(primary.id)}
                            disabled={!!busy || !primary}
                            className="group relative flex items-center gap-2 rounded-xl bg-daw-primary px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-daw-primary/30 transition hover:brightness-110 disabled:opacity-60"
                        >
                            <span className="absolute -inset-1 -z-10 rounded-xl bg-daw-primary/40 blur-lg animate-pulse-glow" />
                            {busy === primary?.id
                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                : null}
                            {busy === primary?.id ? "Opening…" : "Start Creating"}
                            {!busy && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />}
                        </button>

                        <button
                            onClick={startBlank}
                            disabled={!!busy}
                            className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 px-6 py-3.5 text-gray-100 backdrop-blur-md transition hover:border-white/40 hover:bg-black/60 disabled:opacity-60"
                        >
                            <FilePlus2 className="h-4 w-4" />
                            Start blank
                        </button>

                        <button
                            onClick={skip}
                            disabled={!!busy}
                            className="flex items-center gap-2 rounded-xl bg-black/40 px-6 py-3.5 text-gray-200 backdrop-blur-md transition hover:bg-black/60 hover:text-white disabled:opacity-60"
                        >
                            <SkipForward className="h-4 w-4" />
                            Skip to Studio
                        </button>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="animate-in fade-in mx-auto mt-6 max-w-md rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300"
                        >
                            {error}
                        </p>
                    )}
                </div>
            </BackgroundVideo>

            {/* ── Templates ────────────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
                <h2 className="font-display text-2xl font-semibold text-white">
                    Or start from a sound
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                    Every template opens with tracks, instruments and a few bars already playing.
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {templates.map((template, index) => (
                        <button
                            key={template.id}
                            onClick={() => openTemplate(template.id)}
                            disabled={!!busy}
                            style={{ animationDelay: `${index * 70}ms` }}
                            className="group animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards relative overflow-hidden rounded-2xl border border-daw-border bg-daw-panel p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl disabled:opacity-60"
                        >
                            {/* Accent wash, from the template's own colour. */}
                            <div
                                className="absolute inset-x-0 top-0 h-28 opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
                                style={{ background: template.accentColor }}
                                aria-hidden="true"
                            />

                            <div className="relative">
                                <div
                                    className="flex h-24 items-center justify-center rounded-xl border border-white/5 text-4xl"
                                    style={{
                                        background: `linear-gradient(135deg, ${template.accentColor}33, transparent 70%)`,
                                    }}
                                >
                                    <span className="transition-transform duration-300 group-hover:scale-110">
                                        {template.previewIcon}
                                    </span>
                                </div>

                                <h3 className="mt-4 font-display text-base font-semibold text-white">
                                    {template.name}
                                </h3>
                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">
                                    {template.description}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                                        {template.bpm} BPM
                                    </span>
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                                        {template.genre}
                                    </span>
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-400">
                                        {template.difficulty}
                                    </span>
                                </div>
                            </div>

                            {busy === template.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-daw-panel/80 backdrop-blur-sm">
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                <p className="mt-12 text-center text-xs text-gray-500">
                    Everything runs in your browser.
                </p>
            </section>
        </div>
    );
}
