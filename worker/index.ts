// HC Wettern API – Cloudflare Worker (gratisnivån räcker).
// Sparar push-prenumerationer och delar ut liveställningen till appen.
//
// Publika anrop (från appen):
//   GET  /api/vapid            – publik nyckel för push
//   POST /api/subscribe        – { subscription, prefs }
//   POST /api/unsubscribe      – { endpoint }
//   GET  /api/live             – pågående match (cachas 10 s)
// Admin (från matchbevakningen i GitHub Actions, kräver Authorization: Bearer ADMIN_TOKEN):
//   GET  /api/admin/subscribers
//   POST /api/admin/remove     – { ids: [] }
//   PUT  /api/admin/live       – { game, updatedAt }

export interface Env {
  KV: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  ADMIN_TOKEN: string;
  ALLOWED_ORIGINS: string; // kommaseparerad lista, eller *
}

interface Prefs {
  start: boolean;
  goal: boolean;
  final: boolean;
}

const SUB = 'sub:';

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin || '*' : allowed[0],
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

async function idFor(endpoint: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validSubscription(s: unknown): s is { endpoint: string; keys: { p256dh: string; auth: string } } {
  const x = s as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return !!x && typeof x.endpoint === 'string' && x.endpoint.startsWith('https://') && x.endpoint.length < 1000 && typeof x.keys?.p256dh === 'string' && typeof x.keys?.auth === 'string';
}

const cleanPrefs = (p: Partial<Prefs> | undefined): Prefs => ({ start: p?.start !== false, goal: p?.goal !== false, final: p?.final !== false });

function timingSafeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const path = url.pathname.replace(/\/$/, '');

    try {
      /* ---------- publika ---------- */
      if (path === '/api/vapid' && req.method === 'GET') return json({ key: env.VAPID_PUBLIC_KEY }, 200, h);

      if (path === '/api/subscribe' && req.method === 'POST') {
        const body = (await req.json()) as { subscription?: unknown; prefs?: Partial<Prefs> };
        if (!validSubscription(body.subscription)) return json({ error: 'Ogiltig prenumeration' }, 400, h);
        const sub = { endpoint: body.subscription.endpoint, keys: body.subscription.keys };
        const id = await idFor(sub.endpoint);
        const value = { s: sub, p: cleanPrefs(body.prefs), t: Date.now() };
        const raw = JSON.stringify(value);
        // Lägg allt i metadata om det får plats, så räcker ett list-anrop för att läsa alla
        await env.KV.put(SUB + id, raw, raw.length < 1000 ? { metadata: value } : undefined);
        return json({ ok: true, id }, 200, h);
      }

      if (path === '/api/unsubscribe' && req.method === 'POST') {
        const body = (await req.json()) as { endpoint?: string };
        if (typeof body.endpoint === 'string') await env.KV.delete(SUB + (await idFor(body.endpoint)));
        return json({ ok: true }, 200, h);
      }

      if (path === '/api/live' && req.method === 'GET') {
        const cache = caches.default;
        const key = new Request(`${url.origin}/api/live`);
        const hit = await cache.match(key);
        if (hit) return new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers), ...h } });
        const live = (await env.KV.get('live', 'json')) as { game: unknown; updatedAt: string } | null;
        // Visa bara liveläget i 3 timmar efter senaste uppdatering
        const fresh = live && Date.now() - new Date(live.updatedAt).getTime() < 3 * 3600_000;
        const res = json(fresh ? live : { game: null, updatedAt: new Date().toISOString() }, 200, { 'cache-control': 'public, max-age=10' });
        ctx.waitUntil(cache.put(key, res.clone()));
        return new Response(res.body, { headers: { ...Object.fromEntries(res.headers), ...h } });
      }

      /* ---------- admin ---------- */
      if (path.startsWith('/api/admin/')) {
        const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
        if (!timingSafeEqual(token, env.ADMIN_TOKEN ?? '')) return json({ error: 'Nekad' }, 401, h);

        if (path === '/api/admin/subscribers' && req.method === 'GET') {
          const subscribers: { id: string; subscription: unknown; prefs: Prefs }[] = [];
          let cursor: string | undefined;
          do {
            const page: KVNamespaceListResult<{ s: unknown; p: Prefs }> = await env.KV.list({ prefix: SUB, cursor });
            for (const k of page.keys) {
              const v = k.metadata ?? ((await env.KV.get(k.name, 'json')) as { s: unknown; p: Prefs } | null);
              if (v) subscribers.push({ id: k.name.slice(SUB.length), subscription: v.s, prefs: v.p });
            }
            cursor = page.list_complete ? undefined : page.cursor;
          } while (cursor);
          return json({ subscribers }, 200, h);
        }

        if (path === '/api/admin/remove' && req.method === 'POST') {
          const { ids } = (await req.json()) as { ids?: string[] };
          await Promise.all((ids ?? []).slice(0, 500).map((id) => env.KV.delete(SUB + id)));
          return json({ ok: true }, 200, h);
        }

        if (path === '/api/admin/live' && req.method === 'PUT') {
          const body = await req.text();
          const prev = await env.KV.get('live');
          // Skriv bara när något ändrats (KV:s gratisnivå tillåter 1 000 skrivningar per dygn)
          const strip = (s: string | null) => (s ?? '').replace(/"updatedAt":"[^"]*"/g, '');
          if (strip(prev) !== strip(body)) await env.KV.put('live', body);
          return json({ ok: true, changed: strip(prev) !== strip(body) }, 200, h);
        }
      }

      if (path === '' || path === '/api') return json({ name: 'HC Wettern API', ok: true }, 200, h);
      return json({ error: 'Finns inte' }, 404, h);
    } catch (e) {
      return json({ error: (e as Error).message }, 500, h);
    }
  },
};
