// Push-notiser i appen: prenumerera/avsluta via service workern och API:t (Cloudflare Worker).
import { useCallback, useEffect, useState } from 'react';
import type { PushPrefs } from '../shared/types';

const PREFS_KEY = 'hcw-push-prefs';
export const defaultPrefs: PushPrefs = { start: true, goal: true, final: true };

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function b64ToUint8(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const loadPrefs = (): PushPrefs => {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return defaultPrefs;
  }
};

export type PushStatus = 'unsupported' | 'needs-install' | 'no-api' | 'denied' | 'off' | 'on' | 'working';

export function usePush(api?: string) {
  const [status, setStatus] = useState<PushStatus>('working');
  const [prefs, setPrefs] = useState<PushPrefs>(loadPrefs);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pushSupported()) return setStatus(isIos() && !isStandalone() ? 'needs-install' : 'unsupported');
    if (!api) return setStatus('no-api');
    if (Notification.permission === 'denied') return setStatus('denied');
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub ? 'on' : 'off');
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (sub: PushSubscription, p: PushPrefs) => {
    const res = await fetch(`${api}/api/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), prefs: p }),
    });
    if (!res.ok) throw new Error('Servern svarade inte');
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* ignorera */
    }
  };

  const enable = async (p: PushPrefs = prefs) => {
    setError(null);
    setStatus('working');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setStatus(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
      await navigator.serviceWorker.ready;
      const { key } = await (await fetch(`${api}/api/vapid`)).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
      await save(sub, p);
      setStatus('on');
    } catch (e) {
      setError((e as Error).message);
      refresh();
    }
  };

  const disable = async () => {
    setStatus('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(`${api}/api/unsubscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      refresh();
    }
  };

  const updatePrefs = async (p: PushPrefs) => {
    setPrefs(p);
    if (status !== 'on') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await save(sub, p).catch((e) => setError(e.message));
  };

  return { status, prefs, error, enable, disable, updatePrefs };
}

/* ---------- Installera appen ---------- */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
});
addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l());
});

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIos(),
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
    },
  };
}
