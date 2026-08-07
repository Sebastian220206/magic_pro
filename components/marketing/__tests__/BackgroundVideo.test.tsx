/**
 * BackgroundVideo.
 *
 * Almost everything worth testing here fails *silently* in a browser, which is
 * why it is tested at all:
 *
 * - Drop `crossOrigin` and COEP blocks the request. Nothing throws, `onError`
 *   never fires, there is only a console warning. The page just has no video.
 * - Drop `muted` or `playsInline` and autoplay is refused. Again no exception —
 *   a rejected promise nobody was watching.
 * - Get the reduced-motion check wrong and a visitor who asked for stillness
 *   gets a looping video, with no error anywhere.
 */

import { render, screen, act } from '@testing-library/react';
import BackgroundVideo from '../BackgroundVideo';

/** Point `matchMedia` at a given reduced-motion preference. */
function setReducedMotion(reduce: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: reduce && query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia;
}

const SRC = 'https://example.supabase.co/storage/v1/object/public/media/hero-loop.mp4';

/** The rendered <video>, or null when the fallback is showing instead. */
function video(container: HTMLElement): HTMLVideoElement | null {
    return container.querySelector('video');
}

beforeEach(() => {
    jest.clearAllMocks();
    setReducedMotion(false);
    HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});

describe('COEP compatibility', () => {
    it('sets crossOrigin="anonymous"', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);

        // Without this the request is no-cors, and require-corp blocks it.
        // Supabase sends Access-Control-Allow-Origin but no CORP header, so
        // CORS mode is the only thing that gets the bytes through.
        expect(video(container)).toHaveAttribute('crossorigin', 'anonymous');
    });
});

describe('autoplay preconditions', () => {
    it('is muted, looping and inline', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);
        const el = video(container)!;

        // muted is what makes autoplay legal at all; playsInline stops iOS
        // taking the video fullscreen instead of playing it in place.
        expect(el).toHaveAttribute('loop');
        expect(el).toHaveAttribute('playsinline');
        expect(el.muted).toBe(true);
        expect(el.autoplay).toBe(true);
    });

    it('does not preload the whole file', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);

        expect(video(container)).toHaveAttribute('preload', 'metadata');
    });

    it('is hidden from assistive technology', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);
        const el = video(container)!;

        // Purely decorative: it carries no information and must not be a
        // focus stop.
        expect(el).toHaveAttribute('aria-hidden', 'true');
        expect(el).toHaveAttribute('tabindex', '-1');
    });
});

describe('when the video cannot play', () => {
    it('renders no video element without a src', () => {
        const { container } = render(<BackgroundVideo />);

        expect(video(container)).toBeNull();
    });

    it('falls back when the source errors', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);
        expect(video(container)).not.toBeNull();

        act(() => {
            video(container)!.dispatchEvent(new Event('error'));
        });

        expect(video(container)).toBeNull();
    });

    it('falls back when the browser refuses autoplay', async () => {
        // Data-saver and low-battery modes refuse even a muted autoplay. The
        // rejected promise is the only signal; ignoring it leaves a dead frame.
        HTMLMediaElement.prototype.play = jest.fn(() =>
            Promise.reject(new DOMException('NotAllowedError')));

        const { container } = render(<BackgroundVideo src={SRC} />);
        await act(async () => { await Promise.resolve(); });

        expect(video(container)).toBeNull();
    });

    it('retries when the src changes after a failure', () => {
        const { container, rerender } = render(<BackgroundVideo src={SRC} />);
        act(() => { video(container)!.dispatchEvent(new Event('error')); });
        expect(video(container)).toBeNull();

        rerender(<BackgroundVideo src={`${SRC}?v=2`} />);

        expect(video(container)).not.toBeNull();
    });

    it('always renders the fallback underneath, so there is never a gap', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);

        // The fallback is not swapped out on success — it sits below while the
        // video buffers, otherwise the first paint is an empty box.
        expect(container.querySelector('svg')).not.toBeNull();
    });
});

describe('reduced motion', () => {
    it('renders no video at all', () => {
        setReducedMotion(true);
        const { container } = render(<BackgroundVideo src={SRC} />);

        expect(video(container)).toBeNull();
    });

    it('never calls play()', () => {
        setReducedMotion(true);
        render(<BackgroundVideo src={SRC} />);

        // Not merely paused — never started.
        expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    });

    it('still renders its children', () => {
        setReducedMotion(true);
        render(<BackgroundVideo src={SRC}><h1>Make your first beat</h1></BackgroundVideo>);

        expect(screen.getByText('Make your first beat')).toBeInTheDocument();
    });
});

describe('overlay', () => {
    it('darkens heavily by default, for text laid over footage', () => {
        const { container } = render(<BackgroundVideo src={SRC} />);

        expect(container.querySelector('[class*="bg-daw-bg/70"]')).not.toBeNull();
    });

    it('can be omitted entirely', () => {
        const { container } = render(<BackgroundVideo src={SRC} overlay="none" />);

        expect(container.querySelector('[class*="bg-daw-bg/70"]')).toBeNull();
    });
});

describe('content', () => {
    it('renders children above the video', () => {
        render(
            <BackgroundVideo src={SRC}>
                <button>Start Creating</button>
            </BackgroundVideo>,
        );

        expect(screen.getByRole('button', { name: 'Start Creating' })).toBeInTheDocument();
    });
});
