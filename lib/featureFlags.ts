/**
 * featureFlags.ts
 *
 * ⚠️ STATUS: ADVISORY ONLY — NOT ENFORCED.
 *
 * `isFeatureEnabled` is currently imported by nothing except this module's own
 * test. Every flag below is therefore documentation, not a gate: setting one to
 * `false` hides nothing, and setting one to `true` enables nothing. Several
 * entries are also stale — `exportMp3` is `false` here while MP3 encoding is
 * implemented in `engine/audioEngine/bounceEngine.ts` and offered by
 * `components/BounceDialog.tsx`.
 *
 * Before trusting this file, decide one of:
 *   1. Wire `isFeatureEnabled` into the components that render each surface and
 *      re-audit every value against the implementation, or
 *   2. Delete it, and track shipped surface in docs/ instead.
 *
 * Until then treat it as an unverified inventory. See ASSESSMENT.md §"Feature
 * flags are decorative".
 */
export const features = {
  // Core v1 — fully functional
  createProject: true,
  editMidi: true,
  playAudio: true,
  audioEngine: true,
  mixer: true,
  exportWav: true,
  saveProject: true,
  openProject: true,
  shareProject: true,
  dashboard: true,
  auth: true,
  templateOnboarding: true,

  // Export formats — only WAV works
  exportAiff: false,
  exportCaf: false,
  exportMp3: false,
  exportOgg: false,
  exportFlac: false,

  // Phase 6 — Cloud & Infrastructure
  pwa: true,
  cloudSave: true,
  s3Storage: false,
  printToPdf: true,
  stripeSubscriptions: false,

  // Disabled — non-functional or stubbed
  collaboration: false,
  atmosMixing: false,
  surroundMixing: false,
  advancedAutomation: false,
  pluginMarketplace: false,
  controlSurfaces: false,
  articulationEditor: false,
  gpuDiagnostics: false,
  crdtCollaboration: false,
  advancedRoutingMatrix: false,
  pluginDevTools: false,
  modulationDebugger: false,
  videoTrack: false,
  scoreEditor: false,
  movieSupport: false,
  externalMidiSync: false,
  externalSampleEditor: false,
  multiOutputInstruments: false,
  virtualMemory: false,
  audioDeviceSelection: false,
  surroundRouting: false,
  midiPreferences: false,

  // TransportBar — disabled non-functional buttons
  smartControls: false,
  editorsTab: false,
  catchPlayhead: false,
  globalSolo: false,
  syncButton: false,
  listsButton: false,
  rewindForward: false,
  skipBack: false,
  masterVolumeSlider: false,

  // TracksArea toolbar
  scrubTool: false,
  marqueeTool: false,
  flexView: false,
  pencilTool: false,

  // Menus — only Logic (Apple) menu works
  fileMenu: false,
  editMenu: false,
  trackMenu: false,
  navigateMenu: false,
  recordMenu: false,
  mixMenu: false,
  viewMenu: false,
  windowMenu: false,
  helpMenu: false,

  // Preferences sections
  preferencesGeneral: true,
  preferencesAudio: true,
  preferencesDisplay: true,
  preferencesScore: false,
  preferencesMovie: false,
  preferencesControlSurfaces: false,
  preferencesAutomation: false,
  preferencesAdvanced: false,

  // Project settings
  projectSettingsMidi: false,
  projectSettingsKeyCommands: true,
} as const;

export type Feature = keyof typeof features;

export function isFeatureEnabled(feature: Feature): boolean {
  return features[feature];
}
