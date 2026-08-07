/**
 * useViewport.
 *
 * The studio reads this to decide whether to drop its desktop chrome and
 * whether to ask for a rotation. Both decisions are invisible when wrong in the
 * safe direction — a desktop user would simply never notice — so the cases that
 * matter are the boundaries and the server-render default.
 */

import { renderHook, act } from '@testing-library/react';
import { useViewport, INITIAL_VIEWPORT } from '../useViewport';

type Listener = (event: MediaQueryListEvent) => void;

/** Media query stubs whose matches can be flipped mid-test. */
function mockMedia(state: {
    compact?: boolean; portrait?: boolean; short?: boolean; touch?: boolean;
}) {
    const listeners: Listener[] = [];

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        /*
         * A getter, not a fixed value. The hook calls matchMedia once and keeps
         * the MediaQueryList objects, re-reading `.matches` whenever a change
         * fires — which is how the real API behaves. Freezing it at creation
         * time made a rotation look like it changed nothing.
         */
        get matches() {
            return query.includes('max-width') ? !!state.compact :
                query.includes('orientation: portrait') ? !!state.portrait :
                    query.includes('max-height') ? !!state.short :
                        query.includes('pointer: coarse') ? !!state.touch : false;
        },
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn((_: string, fn: Listener) => listeners.push(fn)),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;

    return {
        /** Change the answers, then fire a change as a rotation would. */
        update(next: typeof state) {
            Object.assign(state, next);
            act(() => {
                for (const fn of listeners) fn({} as MediaQueryListEvent);
            });
        },
    };
}

describe('useViewport', () => {
    it('reports a landscape phone as compact and short', () => {
        mockMedia({ compact: true, portrait: false, short: true, touch: true });

        const { result } = renderHook(() => useViewport());

        expect(result.current).toMatchObject({
            compact: true, portrait: false, short: true, touch: true, ready: true,
        });
    });

    it('reports a desktop as none of those', () => {
        mockMedia({});

        const { result } = renderHook(() => useViewport());

        expect(result.current).toMatchObject({
            compact: false, portrait: false, short: false, touch: false,
        });
    });

    it('separates touch from compact', () => {
        // A touchscreen laptop is not compact; a narrow desktop window is
        // compact without being touch. Conflating them gets both wrong.
        mockMedia({ compact: false, touch: true });
        expect(renderHook(() => useViewport()).result.current).toMatchObject({
            compact: false, touch: true,
        });

        mockMedia({ compact: true, touch: false });
        expect(renderHook(() => useViewport()).result.current).toMatchObject({
            compact: true, touch: false,
        });
    });

    it('follows a rotation without a remount', () => {
        const media = mockMedia({ compact: true, portrait: true, short: false });
        const { result } = renderHook(() => useViewport());

        expect(result.current.portrait).toBe(true);

        media.update({ portrait: false, short: true });

        // Turning the phone must take the rotate gate away, not require a
        // reload.
        expect(result.current.portrait).toBe(false);
        expect(result.current.short).toBe(true);
    });

    it('starts as a not-ready desktop, so server and client first paint agree', () => {
        // matchMedia does not exist during server rendering, so the initial
        // value has to describe a desktop. `ready: false` is what lets the
        // rotate overlay wait instead of flashing on a desktop for one frame.
        expect(INITIAL_VIEWPORT).toEqual({
            compact: false, portrait: false, short: false, touch: false, ready: false,
        });
    });

    it('stops listening when unmounted', () => {
        const removed: string[] = [];
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: jest.fn(), removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(() => removed.push(query)),
            dispatchEvent: jest.fn(),
        })) as unknown as typeof window.matchMedia;

        renderHook(() => useViewport()).unmount();

        // Four queries in, four listeners out — the studio mounts and unmounts
        // this on every project navigation.
        expect(removed).toHaveLength(4);
    });
});
