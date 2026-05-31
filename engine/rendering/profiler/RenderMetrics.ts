export interface RenderMetrics {
  // Timing metrics (in ms)
  timelineRenderMs: number;
  pianoRollRenderMs: number;
  automationRenderMs: number;
  overlayRenderMs: number;
  viewportCommitMs: number;
  transactionFlushMs: number;
  totalFrameMs: number;

  // Frame pacing & stability
  fps: number;
  deltaTimeVariance: number;
  droppedFrames: number;
  longTasks: number;
  rafLatency: number;

  // Input & Transaction metrics
  viewportTransactionCount: number;
  snapshotId: number;
  orphanedSnapshots: number;
  transactionRollbacks: number;
  inputLatencyMs: number;

  // Rendering & Overdraw metrics
  dirtyRegionCount: number;
  overlayCount: number;
  activeRendererCount: number;
  
  // Drift detection
  audioContextDriftMs: number;
  
  // Memory (Estimate)
  estimatedMemoryMB: number;

  // Automation Specific
  automationPointsRendered: number;
  automationCurvesRendered: number;
  automationDirtyRegions: number;
  interpolationTimeMs: number;
}

export const createEmptyMetrics = (): RenderMetrics => ({
  timelineRenderMs: 0,
  pianoRollRenderMs: 0,
  automationRenderMs: 0,
  overlayRenderMs: 0,
  viewportCommitMs: 0,
  transactionFlushMs: 0,
  totalFrameMs: 0,
  fps: 0,
  deltaTimeVariance: 0,
  droppedFrames: 0,
  longTasks: 0,
  rafLatency: 0,
  viewportTransactionCount: 0,
  snapshotId: 0,
  orphanedSnapshots: 0,
  transactionRollbacks: 0,
  inputLatencyMs: 0,
  dirtyRegionCount: 0,
  overlayCount: 0,
  activeRendererCount: 0,
  audioContextDriftMs: 0,
  estimatedMemoryMB: 0,
  automationPointsRendered: 0,
  automationCurvesRendered: 0,
  automationDirtyRegions: 0,
  interpolationTimeMs: 0
});
