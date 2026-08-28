/**
 * Which audio settings belong to the machine rather than to the project.
 *
 * `inputDevice` and `outputDevice` hold `MediaDeviceInfo.deviceId` values:
 * opaque handles scoped to one origin on one machine, which rotate when site
 * data is cleared and mean nothing anywhere else. They are a property of the
 * desk you are sitting at, not of the music.
 *
 * They were being restored from the project. Loading a project ran
 *
 *     set({ globalSettings: { ...get().globalSettings, ...restored.globalSettings } })
 *
 * — a shallow merge, so the project's whole `audio` object replaced the one
 * `loadGlobalSettings` had just read out of localStorage. Two consequences,
 * both reported:
 *
 *   The output chosen in Settings was silently discarded on every project
 *   load, sending the mix back to the system default.
 *
 *   A project saved on another machine (or before site data was cleared)
 *   installed *its* input deviceId, which does not resolve here — and
 *   `deviceId: { exact }` on a device that does not resolve is what threw
 *   OverconstrainedError out of arming and made takes record nothing.
 */

/** Settings that describe this machine's hardware and must not travel. */
export const MACHINE_LOCAL_AUDIO_KEYS = [
    'inputDevice', 'outputDevice',
    // The labels travel with the ids: keeping one without the other would let
    // a project's label be used to "recover" a device this machine never chose.
    'inputDeviceLabel', 'outputDeviceLabel',
] as const;

type WithAudio = { audio?: Record<string, unknown> };

/**
 * Merge a project's global settings over the local ones, keeping this
 * machine's device choices.
 *
 * Everything else in the project wins, as before — only the handles that
 * cannot be meaningful on another machine are held back.
 */
export function mergeProjectGlobalSettings<T extends WithAudio>(
    local: T,
    fromProject: Partial<T> | undefined,
): T {
    if (!fromProject) return local;

    const merged = { ...local, ...fromProject } as T;

    const localAudio = local?.audio as Record<string, unknown> | undefined;
    const projectAudio = fromProject?.audio as Record<string, unknown> | undefined;

    if (localAudio || projectAudio) {
        const audio: Record<string, unknown> = { ...(localAudio ?? {}), ...(projectAudio ?? {}) };
        for (const key of MACHINE_LOCAL_AUDIO_KEYS) {
            // Keep what this machine chose. `undefined` locally means "never
            // chosen here", and then the project's value is no worse than none.
            if (localAudio && localAudio[key] !== undefined) {
                audio[key] = localAudio[key];
            }
        }
        (merged as WithAudio).audio = audio;
    }

    return merged;
}
