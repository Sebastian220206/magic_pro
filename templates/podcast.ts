import { ProjectTemplate } from './types';

export const podcastTemplate: ProjectTemplate = {
  id: 'podcast',
  name: 'Podcast',
  description: 'Clean voice recording workspace with compressor and monitoring',
  category: 'Recording',
  genre: 'Spoken Word',
  difficulty: 'Beginner',
  bpm: 120,
  timeSignature: '4/4',
  keySignature: 'C Major',
  accentColor: '#F59E0B',
  previewIcon: '🎙️',
  tracks: [
    {
      name: 'Voice',
      type: 'audio',
      color: '#F59E0B',
      volume: 0.85,
      pan: 0,
      muted: false,
      soloed: false,
      icon: 'mic',
      recordEnabled: true,
      inputMonitoring: true,
      outputBusId: 'stereo-out',
      plugins: [
        {
          pluginId: 'comp',
          name: 'Compressor',
          params: { threshold: 0.5, ratio: 4, attack: 0.002, release: 0.1 },
        },
      ],
    },
  ],
  clips: [],
};
