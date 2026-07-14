// Gyroscope tilt permission (Sprint 16 Commit 3). iOS 13+ gates
// DeviceOrientationEvent behind an explicit user-gesture permission prompt
// (Apple's fingerprinting mitigation) — there is no silent path to
// orientation data. Android has no such gate: DeviceOrientationEvent just
// works. This mirrors lib/push.ts's exact shape (a status getter + an
// action function), the established pattern in this codebase for any
// permission-gated browser capability.

export type TiltPermissionStatus = 'unsupported' | 'not-needed' | 'granted' | 'denied';

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

function needsPermissionRequest(): boolean {
  if (!isSupported()) return false;
  const ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;
  return typeof ctor.requestPermission === 'function';
}

/**
 * Requests gyroscope permission. Must be called from within a user gesture
 * handler (a tap) on iOS — calling it any other way silently rejects on
 * Safari. On Android (or anywhere requestPermission doesn't exist),
 * resolves 'not-needed' immediately — there's nothing to ask for.
 */
export async function requestTiltPermission(): Promise<TiltPermissionStatus> {
  if (!isSupported()) return 'unsupported';
  if (!needsPermissionRequest()) return 'not-needed';
  try {
    const ctor = window.DeviceOrientationEvent as unknown as Required<DeviceOrientationEventWithPermission>;
    const result = await ctor.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function isTiltSupported(): boolean {
  return isSupported();
}
