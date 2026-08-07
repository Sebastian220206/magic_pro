/**
 * catalog.ts
 * The template list, and nothing that needs the audio engine.
 *
 * Split out of `index.ts` for one reason: `createProjectFromTemplate` imports
 * `AudioEngineAdapter` and the 5,800-line project store at module scope, and
 * `/welcome` only wanted to *list* templates. Importing the catalogue therefore
 * pulled the entire DAW into the landing page bundle — 302 kB first load against
 * 109 kB for `/login`, on the page whose whole job is to paint fast.
 *
 * Everything here is plain data: the individual template modules import only
 * `./types`. Keep it that way — a single engine import in this file silently
 * undoes the split, and nothing would fail except the page getting slower.
 */

import type { ProjectTemplate } from './types';
import { lofiTemplate } from './lofi';
import { podcastTemplate } from './podcast';
import { edmTemplate } from './edm';
import { hiphopTemplate } from './hiphop';
import { pianoSketchTemplate } from './piano';

export const templateCatalog: ProjectTemplate[] = [
    lofiTemplate,
    hiphopTemplate,
    pianoSketchTemplate,
    edmTemplate,
    podcastTemplate,
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
    return templateCatalog.find(t => t.id === id);
}

/**
 * Templates offered as starting points in the UI.
 *
 * Podcast is excluded: it is a recording setup rather than something that makes
 * a sound when you press play, so it is a poor first experience. Both the
 * welcome page and the new-project dialog filtered it out inline and separately;
 * this is that rule in one place.
 */
export const starterTemplates: ProjectTemplate[] = templateCatalog.filter(
    t => t.id !== 'podcast',
);

/**
 * The template the primary call to action uses.
 *
 * Derived rather than written as a literal. The welcome page's "Start Creating"
 * button hard-coded `'lo-fi'`, but the real id is `'lofi-beat'`, so
 * `find` returned undefined and the button silently did nothing at all.
 */
export const defaultTemplate: ProjectTemplate = starterTemplates[0];
