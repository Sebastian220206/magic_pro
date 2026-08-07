"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, SkipForward, Loader2, FilePlus2 } from "lucide-react";
import BackgroundVideo from "@/components/marketing/BackgroundVideo";
import { onboardingStore } from "@/store/onboardingStore";

interface WelcomeHeroProps {
    /** Template the primary button opens. */
    defaultTemplateId: string;
    loopUrl?: string;
    posterUrl?: string;
}

export default function WelcomeHero({
    defaultTemplateId,
    loopUrl,
    posterUrl,
}: WelcomeHeroProps) {
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
        setBusy("template");
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

    return (
        /*
         * The hero is the whole page — `h-screen`, not `min-h-screen`, so the
         * video fills the viewport exactly and nothing hangs below it. The
         * template grid that used to sit underneath is gone; templates are still
         * reachable from the dashboard's New Project dialog.
         */
        <BackgroundVideo
            src={loopUrl}
            poster={posterUrl}
            overlay="none"
            className="h-screen flex items-center select-text"
        >
            <div className="mx-auto w-full max-w-7xl px-6 text-center">
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/50 px-5 py-2 text-sm font-medium text-amber-200 backdrop-blur-md">
                    <Sparkles className="h-4 w-4" />
                    Make music in 30 seconds
                </div>

                {/*
                  * `text-balance` and the explicit <br /> together: the line
                  * should break exactly once, after "beat". At 9xl on a 1440px
                  * viewport it wrapped on its own and left "beat" orphaned on a
                  * line of its own, so the top size steps up only at xl where
                  * there is room for it.
                  */}
                <h1 className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:120ms] fill-mode-backwards mt-8 font-display text-5xl font-bold leading-[0.95] tracking-tight text-balance text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.8)] sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl">
                    Make your first beat
                    <br />
                    {/*
                      * A solid tint, not a clipped gradient. Over undimmed
                      * footage an amber gradient vanished into the gold, a
                      * sweeping one faded out once per cycle, and adding
                      * `drop-shadow` to rescue it rendered the line grey — a
                      * `filter` on an element using `background-clip: text` with
                      * a transparent colour breaks the clip in Chromium.
                      */}
                    <span className="text-fuchsia-200 [text-shadow:0_2px_24px_rgba(0,0,0,0.9),0_1px_4px_rgba(0,0,0,0.8)]">
                        in 30 seconds
                    </span>
                </h1>

                <p className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:240ms] fill-mode-backwards mx-auto mt-8 max-w-2xl text-xl text-gray-200 [text-shadow:0_1px_12px_rgba(0,0,0,0.95)] md:text-2xl">
                    Pick a starter template, press play, and hear music instantly.
                    No setup. No manual routing. Just sound.
                </p>

                <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 [animation-delay:360ms] fill-mode-backwards mt-12 flex flex-wrap items-center justify-center gap-4">
                    <button
                        onClick={() => openTemplate(defaultTemplateId)}
                        disabled={!!busy}
                        className="group flex items-center gap-3 rounded-2xl bg-white px-10 py-5 text-xl font-semibold text-black shadow-2xl shadow-black/40 transition hover:bg-gray-100 disabled:opacity-60"
                    >
                        {busy === "template" && <Loader2 className="h-6 w-6 animate-spin" />}
                        {busy === "template" ? "Opening…" : "Start Creating"}
                        {busy !== "template" && (
                            <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                        )}
                    </button>

                    <button
                        onClick={startBlank}
                        disabled={!!busy}
                        className="flex items-center gap-3 rounded-2xl border border-white/25 bg-black/50 px-8 py-5 text-lg text-gray-100 backdrop-blur-md transition hover:border-white/50 hover:bg-black/70 disabled:opacity-60"
                    >
                        {busy === "blank"
                            ? <Loader2 className="h-5 w-5 animate-spin" />
                            : <FilePlus2 className="h-5 w-5" />}
                        Start blank
                    </button>

                    <button
                        onClick={skip}
                        disabled={!!busy}
                        className="flex items-center gap-3 rounded-2xl bg-black/50 px-8 py-5 text-lg text-gray-200 backdrop-blur-md transition hover:bg-black/70 hover:text-white disabled:opacity-60"
                    >
                        <SkipForward className="h-5 w-5" />
                        Skip to Studio
                    </button>
                </div>

                {error && (
                    <p
                        role="alert"
                        className="animate-in fade-in mx-auto mt-8 max-w-md rounded-lg border border-red-800 bg-red-950/80 px-4 py-3 text-sm text-red-200 backdrop-blur-md"
                    >
                        {error}
                    </p>
                )}
            </div>
        </BackgroundVideo>
    );
}
