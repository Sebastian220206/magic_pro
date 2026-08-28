/**
 * Find a device again after its id has changed.
 *
 * `MediaDeviceInfo.deviceId` is not a stable name for a piece of hardware. It
 * is an opaque handle salted per origin, and the salt is rotated — clearing
 * site data does it, so does replugging a USB interface, and so does a browser
 * restart in some configurations. Store one and it stops resolving:
 *
 *   `setSinkId` answers "the device … is not found" and the mix silently stays
 *   on the system default.
 *
 *   `getUserMedia` with `deviceId: { exact }` throws OverconstrainedError,
 *   which is what made arming a track fail and record nothing.
 *
 * The label — "Headphones (USB Audio CODEC)" — survives all of that. Saving it
 * beside the id lets the device be found again, and the fresh id written back,
 * instead of the choice quietly evaporating.
 */

export interface StoredDevice {
    /** What was saved. May no longer resolve. */
    deviceId?: string | null;
    /** What it was called. Survives id rotation. */
    label?: string | null;
}

export interface ResolvedDevice {
    deviceId: string;
    /** True when the id changed and was recovered from the label. */
    recovered: boolean;
    label: string;
}

/**
 * The id to actually use for a stored choice, or null when the device is gone.
 *
 * Prefers the stored id when it still enumerates; otherwise matches on label.
 */
export function resolveDevice(
    devices: Pick<MediaDeviceInfo, 'kind' | 'deviceId' | 'label'>[],
    kind: MediaDeviceKind,
    stored: StoredDevice,
): ResolvedDevice | null {
    const candidates = devices.filter(d => d.kind === kind);
    if (candidates.length === 0) return null;

    const wantedId = stored.deviceId;
    if (wantedId && wantedId !== 'default' && wantedId !== 'None') {
        const byId = candidates.find(d => d.deviceId === wantedId);
        if (byId) return { deviceId: byId.deviceId, recovered: false, label: byId.label };
    }

    const wantedLabel = stored.label?.trim();
    if (wantedLabel) {
        const byLabel = candidates.find(d => d.label.trim() === wantedLabel);
        if (byLabel) return { deviceId: byLabel.deviceId, recovered: true, label: byLabel.label };
    }

    return null;
}
