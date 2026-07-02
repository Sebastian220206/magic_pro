import type { Clip } from '@/models/Clip';

export interface VideoPlaybackState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
}

export interface VideoSyncOptions {
  projectStartBeat: number;
  projectBpm: number;
  videoOffsetBeats: number;
}

export class VideoEngine {
  private _video: HTMLVideoElement | null = null;
  private _clip: Clip | null = null;
  private _state: VideoPlaybackState = {
    playing: false, currentTime: 0, duration: 0,
    volume: 1, muted: false, loop: false,
  };
  private _listeners: Array<(state: VideoPlaybackState) => void> = [];
  private _rafId: number | null = null;
  private _syncOptions: VideoSyncOptions = {
    projectStartBeat: 0, projectBpm: 120, videoOffsetBeats: 0,
  };

  get state(): VideoPlaybackState {
    return { ...this._state };
  }

  get video(): HTMLVideoElement | null {
    return this._video;
  }

  subscribe(cb: (state: VideoPlaybackState) => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(l => l !== cb);
    };
  }

  private _notify() {
    const s = this.state;
    for (const cb of this._listeners) cb(s);
  }

  setSyncOptions(opts: Partial<VideoSyncOptions>) {
    this._syncOptions = { ...this._syncOptions, ...opts };
  }

  async loadClip(clip: Clip): Promise<void> {
    if (!clip.videoUrl) throw new Error('Clip has no video URL');
    this._clip = clip;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.src = clip.videoUrl;

    return new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        this._state.duration = video.duration;
        this._video = video;
        this._notify();
        resolve();
      };
      video.onerror = () => reject(new Error('Failed to load video'));
      video.load();
    });
  }

  play(): void {
    if (!this._video) return;
    this._video.play();
    this._state.playing = true;
    this._startPolling();
    this._notify();
  }

  pause(): void {
    if (!this._video) return;
    this._video.pause();
    this._state.playing = false;
    this._stopPolling();
    this._notify();
  }

  seek(timeSeconds: number): void {
    if (!this._video) return;
    this._video.currentTime = timeSeconds;
    this._state.currentTime = timeSeconds;
    this._notify();
  }

  seekToBeat(beat: number): void {
    const { projectBpm, videoOffsetBeats } = this._syncOptions;
    const secondsPerBeat = 60 / projectBpm;
    const videoTime = (beat - videoOffsetBeats) * secondsPerBeat;
    this.seek(Math.max(0, videoTime));
  }

  setVolume(v: number): void {
    if (!this._video) return;
    this._video.volume = v;
    this._state.volume = v;
    this._notify();
  }

  setMuted(m: boolean): void {
    if (!this._video) return;
    this._video.muted = m;
    this._state.muted = m;
    this._notify();
  }

  setLoop(l: boolean): void {
    if (!this._video) return;
    this._video.loop = l;
    this._state.loop = l;
    this._notify();
  }

  getCurrentBeat(): number {
    const { projectBpm, videoOffsetBeats } = this._syncOptions;
    const secondsPerBeat = 60 / projectBpm;
    return videoOffsetBeats + this._state.currentTime / secondsPerBeat;
  }

  dispose(): void {
    this._stopPolling();
    if (this._video) {
      this._video.pause();
      this._video.removeAttribute('src');
      this._video.load();
    }
    this._video = null;
    this._clip = null;
    this._listeners = [];
  }

  private _startPolling() {
    this._stopPolling();
    const poll = () => {
      if (this._video) {
        this._state.currentTime = this._video.currentTime;
        this._notify();
      }
      this._rafId = requestAnimationFrame(poll);
    };
    this._rafId = requestAnimationFrame(poll);
  }

  private _stopPolling() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}
