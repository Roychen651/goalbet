import { supabase } from './supabase';

// Note: VITE_VAPID_PUBLIC_KEY is inlined at build time, so provisioning the key
// requires a fresh production build (not just a Vercel env-var save + redeploy).
// Public VAPID key (safe to ship). Until this is set on Vercel the whole feature
// reports 'unsupported' and the UI hides itself — graceful, no dead buttons.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushStatus =
  | 'unsupported'        // no SW/Push/Notification API, or VAPID key not configured
  | 'ios-needs-install'  // iOS Safari: Web Push only works from an installed PWA
  | 'denied'             // user blocked notifications at the browser level
  | 'subscribed'         // active push subscription exists
  | 'default';           // supported + not yet subscribed

function apiSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS 16.4+ supports Web Push ONLY when the app is installed to the Home Screen
// (standalone display mode). A prompt from a normal Safari tab silently no-ops.
function isIosNonStandalone(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in document); // iPadOS reports as Mac
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY) return 'unsupported';
  // iOS Safari only exposes PushManager/Notification INSIDE an installed PWA — in a
  // normal tab they're absent, so apiSupported() is false there. Detect the
  // "needs install" case FIRST, otherwise we'd short-circuit to 'unsupported' and
  // hide the install hint entirely (iPhone users would see nothing at all).
  if (isIosNonStandalone()) return 'ios-needs-install';
  if (!apiSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? 'subscribed' : 'default';
  } catch {
    return 'default';
  }
}

// Must be called from a user gesture (rule: iOS/all require interaction).
export async function enablePush(userId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Push not configured');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('permission-denied');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });

  const json = sub.toJSON();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      },
      { onConflict: 'endpoint' },
    );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}
