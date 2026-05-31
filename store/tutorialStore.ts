const TUTORIAL_KEY = 'magicPro_tutorial';

export type TutorialState = 'not-started' | 'active' | 'completed';

function load(): TutorialState {
  if (typeof window === 'undefined') return 'completed';
  try {
    const v = localStorage.getItem(TUTORIAL_KEY);
    if (v === 'completed') return 'completed';
    if (v === 'active') return 'active';
    return 'not-started';
  } catch {
    return 'completed';
  }
}

function save(state: TutorialState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TUTORIAL_KEY, state);
  } catch {}
}

export const tutorialStore = {
  get state(): TutorialState {
    return load();
  },
  start() {
    save('active');
  },
  complete() {
    save('completed');
  },
  reset() {
    save('not-started');
  },
};
