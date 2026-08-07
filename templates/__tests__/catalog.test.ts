/**
 * The template catalogue.
 *
 * Two of these tests exist because of a bug that shipped: the welcome page's
 * primary button called `handleSelectTemplate('lo-fi')`, but no template has
 * that id — it is `'lofi-beat'`. `find` returned undefined, the handler
 * returned early, and "Start Creating" did nothing at all. The icon and
 * gradient lookup tables were keyed the same wrong way, which is why the lo-fi
 * card rendered grey while the other three were coloured.
 *
 * Nothing failed. No error, no warning. The button was simply inert.
 */

import {
    templateCatalog,
    starterTemplates,
    defaultTemplate,
    getTemplateById,
} from '../catalog';

describe('the catalogue', () => {
    it('is not empty', () => {
        expect(templateCatalog.length).toBeGreaterThan(0);
    });

    it('has unique ids', () => {
        const ids = templateCatalog.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('resolves every one of its own ids', () => {
        // The failure mode was an id that resolved to undefined, so assert the
        // whole set round-trips rather than spot-checking one.
        for (const template of templateCatalog) {
            expect(getTemplateById(template.id)).toBe(template);
        }
    });

    it('returns undefined for an id that does not exist', () => {
        expect(getTemplateById('lo-fi')).toBeUndefined();
        expect(getTemplateById('')).toBeUndefined();
    });
});

describe('starter templates', () => {
    it('excludes podcast', () => {
        // A recording setup makes no sound when you press play, so it is a poor
        // first experience. Both call sites used to filter it out separately.
        expect(starterTemplates.some(t => t.id === 'podcast')).toBe(false);
        expect(templateCatalog.some(t => t.id === 'podcast')).toBe(true);
    });

    it('is otherwise the full catalogue', () => {
        expect(starterTemplates.length).toBe(templateCatalog.length - 1);
    });
});

describe('the default template', () => {
    it('exists in the catalogue', () => {
        // Derived from the list rather than written as a literal, so it cannot
        // name something that is not there.
        expect(templateCatalog).toContain(defaultTemplate);
    });

    it('is resolvable by its own id', () => {
        expect(getTemplateById(defaultTemplate.id)).toBe(defaultTemplate);
    });

    it('is not the podcast template', () => {
        expect(defaultTemplate.id).not.toBe('podcast');
    });
});

describe('card data every template must carry', () => {
    /*
     * The pages render these directly now instead of keeping their own lookup
     * tables. A template missing one would render a blank or unstyled card.
     */
    it.each(templateCatalog.map(t => [t.id, t] as const))(
        '%s has the fields the cards render',
        (_id, template) => {
            expect(template.name).toBeTruthy();
            expect(template.description).toBeTruthy();
            expect(template.genre).toBeTruthy();
            expect(template.difficulty).toBeTruthy();
            expect(template.previewIcon).toBeTruthy();
            expect(template.bpm).toBeGreaterThan(0);
        },
    );

    it.each(templateCatalog.map(t => [t.id, t.accentColor] as const))(
        '%s has a valid hex accent colour',
        (_id, accentColor) => {
            // Interpolated straight into a CSS gradient with `33` appended for
            // alpha, so a malformed value silently produces no background.
            expect(accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
        },
    );
});
