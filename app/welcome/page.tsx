import { mediaConfig } from "@/lib/mediaConfig";
import { starterTemplates } from "@/templates/catalog";
import WelcomeHero from "./WelcomeHero";

/**
 * Server component wrapper.
 *
 * Two jobs. It reads the media URLs server-side, and — more importantly — it
 * imports the template list from `@/templates/catalog` rather than
 * `@/templates`. The latter reaches the audio engine and the project store at
 * module scope, which is why this page used to ship 302 kB of DAW to render a
 * grid of four cards. `createProjectFromTemplate` is loaded on click instead.
 */
export default function WelcomePage() {
    return (
        <WelcomeHero
            templates={starterTemplates.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                bpm: t.bpm,
                genre: t.genre,
                difficulty: t.difficulty,
                accentColor: t.accentColor,
                previewIcon: t.previewIcon,
            }))}
            loopUrl={mediaConfig.heroLoopUrl}
            posterUrl={mediaConfig.heroPosterUrl}
        />
    );
}
