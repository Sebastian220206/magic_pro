/**
 * Opening Settings lands on a page that renders.
 *
 * `setShowSettingsDialog(show, tab, subTab)` wrote all three fields on every
 * call, so an omitted argument wiped what was there. Two visible failures:
 *
 *   - The menu bar's "Audio..." passes a page and no sub-tab, so the sub-tab
 *     was blanked to `''`. Every panel renders on an exact match, so the Audio
 *     page came up as a row of sub-tabs above an empty body.
 *   - The sub-tab buttons pass a sub-tab and no page, so the page was reset to
 *     'General' — pressing "Devices" appeared to jump to General settings.
 */

// The store imports the audio engine at module load, and the engine reaches
// `import.meta` in its worklet loader, which jest cannot parse. Nothing here
// touches audio, so the adapter is stubbed wholesale.
jest.mock('@/engine/AudioEngineAdapter', () => {
    const engine = new Proxy({}, {
        get: (target: Record<string, unknown>, key: string) => {
            if (key === 'then') return undefined;
            if (!target[key]) target[key] = jest.fn(() => null);
            return target[key];
        },
    });
    return { audioEngine: engine, audioEngine2: engine, default: engine };
});

import { useProjectStore } from '@/store/projectStore';

const open = (...args: Parameters<ReturnType<typeof useProjectStore.getState>['setShowSettingsDialog']>) =>
    useProjectStore.getState().setShowSettingsDialog(...args);

const state = () => useProjectStore.getState();

describe('Settings dialog tab routing', () => {
    beforeEach(() => {
        useProjectStore.setState({
            showSettingsDialog: false,
            settingsActiveTab: 'General',
            settingsActiveSubTab: '',
        } as never);
    });

    it('opens a named page on its first sub-tab', () => {
        open(true, 'Audio');
        expect(state().settingsActiveTab).toBe('Audio');
        expect(state().settingsActiveSubTab).toBe('Devices');
    });

    it('choosing a sub-tab keeps the page it belongs to', () => {
        open(true, 'Audio');
        open(true, undefined, 'MP3');
        expect(state().settingsActiveTab).toBe('Audio');
        expect(state().settingsActiveSubTab).toBe('MP3');
    });

    it('walking the Audio sub-tabs never leaves the Audio page', () => {
        open(true, 'Audio');
        for (const tab of ['Devices', 'General', 'Sampler', 'Editing', 'I/O Assignments', 'File Editor', 'MP3']) {
            open(true, undefined, tab);
            expect(state().settingsActiveTab).toBe('Audio');
            expect(state().settingsActiveSubTab).toBe(tab);
        }
    });

    it('switching pages does not carry a sub-tab the new page lacks', () => {
        open(true, 'Audio', 'I/O Assignments');
        open(true, 'View');
        expect(state().settingsActiveSubTab).toBe('General');
    });

    it('opens both when both are named', () => {
        // What the New Track dialog's "no input device" link does.
        open(true, 'Audio', 'Devices');
        expect(state().settingsActiveTab).toBe('Audio');
        expect(state().settingsActiveSubTab).toBe('Devices');
    });

    it('reopening with no arguments keeps where you were', () => {
        open(true, 'Audio', 'Sampler');
        open(true);
        expect(state().settingsActiveTab).toBe('Audio');
        expect(state().settingsActiveSubTab).toBe('Sampler');
    });

    it('repairs a stored empty sub-tab rather than opening on nothing', () => {
        useProjectStore.setState({ settingsActiveTab: 'Audio', settingsActiveSubTab: '' } as never);
        open(true);
        expect(state().settingsActiveSubTab).toBe('Devices');
    });

    it('closing leaves the page alone, so reopening returns to it', () => {
        open(true, 'Audio', 'MP3');
        open(false);
        expect(state().showSettingsDialog).toBe(false);
        expect(state().settingsActiveTab).toBe('Audio');
        expect(state().settingsActiveSubTab).toBe('MP3');
    });
});
