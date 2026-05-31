const STORAGE_KEY = 'magicPro_onboarding';

function load(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function save(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {}
}

export const onboardingStore = {
  get completed(): boolean {
    return load();
  },
  complete() {
    save(true);
  },
  reset() {
    save(false);
  },
};
