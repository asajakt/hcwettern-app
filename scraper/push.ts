// Skickar Web Push-notiser till alla som prenumererar, via API:t (Cloudflare Worker) som lagrar prenumerationerna.
// Kräver miljövariablerna:
//   HCW_API_URL        – workerns adress
//   HCW_ADMIN_TOKEN    – hemlig nyckel som delas med workern
//   VAPID_PUBLIC_KEY   – publik nyckel (samma som i workern)
//   VAPID_PRIVATE_KEY  – privat nyckel (bara här, aldrig i appen)
//   VAPID_SUBJECT      – kontaktadress, t.ex. https://hcwettern.se
import webpush from 'web-push';
import type { GameDetail, PushMessage, PushPrefs } from '../shared/types';
import { log } from './core';

interface Sub {
  id: string;
  subscription: webpush.PushSubscription;
  prefs: PushPrefs;
}

const env = (k: string) => process.env[k] ?? '';
export const pushConfigured = () => !!(env('HCW_API_URL') && env('HCW_ADMIN_TOKEN') && env('VAPID_PRIVATE_KEY') && env('VAPID_PUBLIC_KEY'));

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${env('HCW_API_URL').replace(/\/$/, '')}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${env('HCW_ADMIN_TOKEN')}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

async function listSubscribers(): Promise<Sub[]> {
  const res = await api('/api/admin/subscribers');
  if (!res.ok) throw new Error(`Kunde inte hämta prenumeranter: HTTP ${res.status}`);
  return ((await res.json()) as { subscribers: Sub[] }).subscribers;
}

export async function sendPush(messages: PushMessage[]) {
  if (!messages.length) return;
  if (!pushConfigured()) {
    for (const m of messages) log(`(push ej konfigurerad) ${m.title} – ${m.body}`);
    return;
  }
  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'https://www.svenskalag.se/hcwettern', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const subs = await listSubscribers();
  const gone: string[] = [];
  for (const m of messages) {
    const targets = subs.filter((s) => s.prefs?.[m.kind] !== false && !gone.includes(s.id));
    let ok = 0;
    // Skicka i omgångar om 50 parallellt
    for (let i = 0; i < targets.length; i += 50) {
      await Promise.all(
        targets.slice(i, i + 50).map((s) =>
          webpush
            .sendNotification(s.subscription, JSON.stringify(m), { TTL: m.kind === 'goal' ? 600 : 3600, urgency: 'high', topic: m.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') })
            .then(() => void ok++)
            .catch((e: { statusCode?: number }) => {
              if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.id);
            }),
        ),
      );
    }
    log(`Push "${m.title}" → ${ok}/${targets.length} mottagare`);
  }
  if (gone.length) {
    await api('/api/admin/remove', { method: 'POST', body: JSON.stringify({ ids: gone }) });
    log(`Tog bort ${gone.length} inaktuella prenumerationer`);
  }
}

/** Lägger ut liveställningen i API:t så att appen uppdateras inom sekunder. */
export async function publishLive(game: GameDetail | null) {
  if (!env('HCW_API_URL') || !env('HCW_ADMIN_TOKEN')) return;
  try {
    await api('/api/admin/live', { method: 'PUT', body: JSON.stringify({ game, updatedAt: new Date().toISOString() }) });
  } catch (e) {
    log('Kunde inte publicera live:', (e as Error).message);
  }
}
