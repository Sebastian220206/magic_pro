import { mediaConfig } from "@/lib/mediaConfig";
import { defaultTemplate } from "@/templates/catalog";
import WelcomeHero from "./WelcomeHero";

/**
 * Server component wrapper.
 *
 * Reads the media URLs server-side, and takes only the id of the template the
 * primary button opens. It used to pass the whole starter list for a card grid;
 * with the page reduced to the hero alone, one id is all that crosses into the
 * client bundle.
 *
 * Imported from `@/templates/catalog` rather than `@/templates` — the latter
 * reaches the audio engine and the project store at module scope, which is why
 * this page once shipped 302 kB of DAW. `createProjectFromTemplate` is loaded
 * on click instead.
 */
export default function WelcomePage() {
    return (
        <WelcomeHero
            defaultTemplateId={defaultTemplate.id}
            loopUrl={mediaConfig.heroLoopUrl}
            posterUrl={mediaConfig.heroPosterUrl}
        />
    );
}
