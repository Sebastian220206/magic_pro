/**
 * inputManager.ts
 * Microphone input device management
 */

import { audioContextManager } from '../audioEngine/audioContext';

export interface InputDeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export interface InputConstraints {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  deviceId?: string;
}

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';

/**
 * InputManager - Manages audio input devices and permissions
 */
export class InputManager {
  private currentStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private currentDeviceId: string | null = null;
  private permissionState: PermissionState = 'unknown';
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor() {
    this.eventListeners.set('deviceChange', new Set());
    this.eventListeners.set('permissionChange', new Set());
  }

  /**
   * Initialize and check permissions
   */
  async init(): Promise<void> {
    try {
      // Check for Permissions API support
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        this.permissionState = result.state as PermissionState;

        result.addEventListener('change', () => {
          this.permissionState = result.state as PermissionState;
          this.emit('permissionChange', this.permissionState);
        });
      }
    } catch {
      // Permissions API not supported, will check via getUserMedia
      this.permissionState = 'unknown';
    }
  }

  /**
   * Get available audio input devices
   */
  async getDevices(): Promise<InputDeviceInfo[]> {
    try {
      // Request permission first to get labeled devices
      await this.checkPermission();

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}...`,
          kind: device.kind as 'audioinput',
        }));
    } catch (error) {
      this.handleError('Failed to enumerate devices', error);
      return [];
    }
  }

  /**
   * Check microphone permission
   */
  async checkPermission(): Promise<PermissionState> {
    try {
      // Try to get a stream to trigger permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.permissionState = 'granted';
      return 'granted';
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        this.permissionState = 'denied';
        return 'denied';
      }
      return 'unknown';
    }
  }

  /**
   * Get the current permission state
   */
  getPermissionState(): PermissionState {
    return this.permissionState;
  }

  /**
   * Request microphone access and create source node
   */
  async getSourceNode(constraints?: InputConstraints): Promise<MediaStreamAudioSourceNode> {
    const ctx = audioContextManager.getContext();
    if (!ctx) {
      throw new Error('AudioContext not initialized');
    }

    // Stop any existing stream
    this.stopCurrentStream();

    try {
      const mediaConstraints: MediaStreamConstraints = {
        audio: {
          sampleRate: constraints?.sampleRate || ctx.sampleRate,
          channelCount: constraints?.channelCount || 2,
          echoCancellation: constraints?.echoCancellation ?? false,
          noiseSuppression: constraints?.noiseSuppression ?? false,
          autoGainControl: constraints?.autoGainControl ?? false,
          deviceId: constraints?.deviceId ? { exact: constraints.deviceId } : undefined,
        },
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      this.currentDeviceId = constraints?.deviceId || 'default';

      this.sourceNode = ctx.createMediaStreamSource(this.currentStream);
      this.permissionState = 'granted';

      // Monitor device changes
      this.setupDeviceChangeListener();

      return this.sourceNode;
    } catch (error) {
      this.handleError('Failed to get microphone access', error);

      if ((error as Error).name === 'NotAllowedError') {
        this.permissionState = 'denied';
        throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if ((error as Error).name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else if ((error as Error).name === 'NotReadableError') {
        throw new Error('Microphone is already in use by another application.');
      }

      throw error;
    }
  }

  /**
   * Switch to a different input device
   */
  async setDevice(deviceId: string, constraints?: Omit<InputConstraints, 'deviceId'>): Promise<MediaStreamAudioSourceNode> {
    if (this.currentDeviceId === deviceId && this.sourceNode) {
      return this.sourceNode;
    }

    return this.getSourceNode({
      ...constraints,
      deviceId,
    });
  }

  /**
   * Get the currently active device ID
   */
  getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * Get the current source node
   */
  getCurrentSourceNode(): MediaStreamAudioSourceNode | null {
    return this.sourceNode;
  }

  /**
   * Get the current media stream
   */
  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Stop the current stream and clean up
   */
  stopCurrentStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.currentStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.currentDeviceId = null;
  }

  /**
   * Get input level (for metering)
   */
  createMeterNode(): { node: AnalyserNode; cleanup: () => void } | null {
    const ctx = audioContextManager.getContext();
    if (!ctx || !this.sourceNode) return null;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    this.sourceNode.connect(analyser);

    const cleanup = () => {
      try {
        this.sourceNode?.disconnect(analyser);
      } catch {
        // Already disconnected
      }
    };

    return { node: analyser, cleanup };
  }

  /**
   * Setup device change listener
   */
  private setupDeviceChangeListener(): void {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      this.emit('deviceChange');
    });
  }

  /**
   * Add event listener
   */
  addEventListener(event: 'deviceChange' | 'permissionChange', callback: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: 'deviceChange' | 'permissionChange', callback: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (err) {
          console.error(`[InputManager] Event handler error for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: unknown): void {
    console.error(`[InputManager] ${message}:`, error);
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    this.stopCurrentStream();
    this.eventListeners.clear();
  }
}

// Singleton instance
let inputManagerInstance: InputManager | null = null;

export function getInputManager(): InputManager {
  if (!inputManagerInstance) {
    inputManagerInstance = new InputManager();
  }
  return inputManagerInstance;
}

export function createInputManager(): InputManager {
  inputManagerInstance = new InputManager();
  return inputManagerInstance;
}

export default InputManager;
