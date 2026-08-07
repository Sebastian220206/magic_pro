/**
 * Setup for the jsdom ("ui") jest project.
 *
 * jsdom implements very little of the Web Audio, Canvas and media APIs the DAW
 * touches during render, so components would throw before their markup could be
 * asserted on. These stubs make rendering possible; anything that needs real
 * audio behaviour belongs in the "node" project against the engine directly.
 */

import '@testing-library/jest-dom';

// --- Canvas -----------------------------------------------------------------
// Timeline, waveform and piano-roll components all grab a 2D context on mount.
const canvasContextStub = {
  canvas: {} as HTMLCanvasElement,
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  setTransform: jest.fn(),
  clip: jest.fn(),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  putImageData: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
  drawImage: jest.fn(),
};

HTMLCanvasElement.prototype.getContext = jest.fn(
  () => canvasContextStub,
) as unknown as HTMLCanvasElement['getContext'];

// --- Web Audio --------------------------------------------------------------
class AudioContextStub {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = {} as AudioDestinationNode;

  createGain = jest.fn(() => ({
    gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));
  createOscillator = jest.fn(() => ({
    type: 'sine',
    frequency: { value: 440 },
    connect: jest.fn(),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  }));
  createAnalyser = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    getByteFrequencyData: jest.fn(),
    getFloatTimeDomainData: jest.fn(),
  }));
  createBufferSource = jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() }));
  createStereoPanner = jest.fn(() => ({ pan: { value: 0 }, connect: jest.fn(), disconnect: jest.fn() }));
  resume = jest.fn().mockResolvedValue(undefined);
  suspend = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
}

(globalThis as any).AudioContext = AudioContextStub;
(globalThis as any).OfflineAudioContext = AudioContextStub;

// --- Media elements ---------------------------------------------------------
// jsdom parses <video>/<audio> but implements none of their playback methods —
// calling play() raises "Not implemented" on stderr and returns undefined, so a
// component awaiting the promise would throw. Return a resolved promise so the
// autoplay path can be exercised; individual tests override it to simulate a
// browser refusing autoplay.
HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = jest.fn();
HTMLMediaElement.prototype.load = jest.fn();

// --- Layout / observers -----------------------------------------------------
(globalThis as any).ResizeObserver = class {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

(globalThis as any).IntersectionObserver = class {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

if (!window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}
