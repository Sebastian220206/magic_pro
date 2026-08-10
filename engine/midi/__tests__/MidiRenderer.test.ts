import {
    resolveNoteAppearance,
    GHOST_NOTE_COLOR,
    MUTED_NOTE_COLOR,
    SELECTED_NOTE_COLOR,
} from '../MidiRenderer';

const base = { velocity: 100, baseColor: null as string | null, isGhost: false, isSelected: false, isMuted: false };

describe('resolveNoteAppearance', () => {
    describe('when the clip has no colour of its own', () => {
        it('colours by velocity band', () => {
            const bands = [20, 50, 80, 120].map(velocity =>
                resolveNoteAppearance({ ...base, velocity }).color
            );
            // Four distinct bands, in order, and none of them is the selection red.
            expect(new Set(bands).size).toBe(4);
            expect(bands).not.toContain(SELECTED_NOTE_COLOR);
        });

        it('uses the steeper velocity bevel', () => {
            expect(resolveNoteAppearance(base).velocityGradient).toBe(true);
        });
    });

    describe('when the clip has a colour', () => {
        it('uses it regardless of velocity', () => {
            const soft = resolveNoteAppearance({ ...base, velocity: 10, baseColor: '#ec4899' });
            const hard = resolveNoteAppearance({ ...base, velocity: 127, baseColor: '#ec4899' });
            expect(soft.color).toBe('#ec4899');
            expect(hard.color).toBe('#ec4899');
            expect(soft.velocityGradient).toBe(false);
        });

        /**
         * Regression: `#3B82F6` was a sentinel meaning "no custom colour", so a
         * clip the user had deliberately coloured blue fell through to velocity
         * colouring. Colour is now signalled by presence, not by value.
         */
        it('honours a clip explicitly coloured the old sentinel blue', () => {
            const explicitlyBlue = resolveNoteAppearance({ ...base, velocity: 10, baseColor: '#3B82F6' });
            const uncoloured = resolveNoteAppearance({ ...base, velocity: 10, baseColor: null });
            expect(explicitlyBlue.color).toBe('#3B82F6');
            expect(explicitlyBlue.color).not.toBe(uncoloured.color);
        });

        it('still velocity-colours a clip with no colour', () => {
            expect(resolveNoteAppearance({ ...base, baseColor: null }).color).not.toBe('#3B82F6');
        });
    });

    describe('state overrides', () => {
        it('draws selection red over any base colour', () => {
            expect(resolveNoteAppearance({ ...base, baseColor: '#22d3ee', isSelected: true }).color)
                .toBe(SELECTED_NOTE_COLOR);
        });

        it('drains a muted note of colour', () => {
            expect(resolveNoteAppearance({ ...base, baseColor: '#22d3ee', isMuted: true }).color)
                .toBe(MUTED_NOTE_COLOR);
        });

        it('greys ghost notes and skips the velocity bevel', () => {
            const ghost = resolveNoteAppearance({ ...base, isGhost: true });
            expect(ghost.color).toBe(GHOST_NOTE_COLOR);
            expect(ghost.velocityGradient).toBe(false);
        });

        it('prefers selection over mute', () => {
            expect(resolveNoteAppearance({ ...base, isSelected: true, isMuted: true }).color)
                .toBe(SELECTED_NOTE_COLOR);
        });
    });
});
