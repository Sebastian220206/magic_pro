import { ViewportState } from './types';
import { GestureInterpreter } from './GestureInterpreter';
import { VelocityIntegrator } from './VelocityIntegrator';
import { ConstraintPass } from './ConstraintPass';
import { globalProfiler } from '../rendering/profiler/FrameProfiler';

export class NavigationLoop {
  private inputQueue: Event[] = [];
  private state: ViewportState;
  private isLoopRunning = false;
  private listeners: Array<(state: ViewportState) => void> = [];

  constructor(initialState: ViewportState) {
    this.state = initialState;
  }

  public getState(): ViewportState {
    return this.state;
  }

  // 1. INPUT COLLECTION (Asynchronous via DOM listeners)
  public setViewport(partial: Partial<ViewportState>) {
    this.state = { ...this.state, ...partial };
    this.state = ConstraintPass.apply(this.state);
    for (const fn of this.listeners) {
      fn(this.state);
    }
  }

  public queueInput(event: Event) {
    this.inputQueue.push(event);
    if (!this.isLoopRunning) this.startLoop();
  }

  private startLoop() {
    this.isLoopRunning = true;
    requestAnimationFrame(this.tick.bind(this));
  }

  // THE PIPELINE (Synchronous Frame Graph)
  private tick() {
    if (this.inputQueue.length === 0 && !VelocityIntegrator.hasMomentum()) {
      // System has reached a rest state, shut off the loop to save battery
      this.isLoopRunning = false;
      return;
    }

    // 2. GESTURE INTERPRETATION
    const vectors = GestureInterpreter.processQueue(this.inputQueue);
    this.inputQueue = [];

    // 3. VELOCITY INTEGRATION (Pan + Zoom Math)
    let nextState = VelocityIntegrator.integrate(this.state, vectors);

    // 4. CONSTRAINT PASS (Bounds Clamping)
    nextState = ConstraintPass.apply(nextState);

    // 5. IMMUTABLE SNAPSHOT
    this.state = Object.freeze(nextState);
    globalProfiler.increment('viewportTransactionCount');

    // 6. RENDERER FLUSH
    globalProfiler.beginMeasure('timelineRenderMs');
    for (const fn of this.listeners) {
      fn(this.state);
    }
    globalProfiler.endMeasure('timelineRenderMs');

    // Tick the profiler at the end of the frame
    globalProfiler.tickFrame(undefined, this.state.startBeat, this.state.pixelsPerBeat);

    // Continue loop
    requestAnimationFrame(this.tick.bind(this));
  }

  public subscribe(fn: (s: ViewportState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
}
