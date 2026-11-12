// Motståndarnas klubbmärken.
// swehockey har inga loggor, så de hämtas en gång från lagens sidor på Elite Prospects
// och sparas i public/logos/. Appen läser sedan bara våra egna filer.
//   npm run logos            – hämtar de loggor som saknas
//   npm run logos -- --force – hämtar om alla
// Nytt lag i serien? Lägg till "Lagnamn som på swehockey": "/team/<id>/<namn>" under teamLogos i config/club.json.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TeamData } from '../shared/types';
import { config, log, read, ROOT, sleep } from './core';

const DIR = join(ROOT, 'public', 'logos');
const EP = 'https://www.eliteprospects.com';
// Elite Prospects visar en Cloudflare-kontroll för okända klienter, därför en vanlig webbläsar-UA
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const logoSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const mapping = (): Record<string, string> => config.teamLogos ?? {};

/** Lagnamn → relativ sökväg till loggan, för de lag vi har en loggfil för. */
export function logoIndex(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(mapping())) {
    const file = `${logoSlug(name)}.png`;
    if (existsSync(join(DIR, file))) out[name] = `logos/${file}`;
  }
  return out;
}

// curl i stället för Node:s fetch: Cloudflare stoppar Node:s TLS-avtryck men släpper igenom curl
const curl = (url: string) =>
  execFileSync('curl', ['-sfL', '--max-time', '30', '-A', UA, '-H', 'Accept-Language: sv,en', url], { maxBuffer: 20 * 1024 * 1024 });

function fetchLogo(path: string): Buffer {
  const html = curl(`${EP}${path}`).toString('utf8');
  const og = html.match(/og:image" content="([^"]+)"/)?.[1];
  if (!og || !og.includes('/logos/')) throw new Error('hittade ingen logga (Cloudflare-kontroll eller ändrad sida)');
  const png = curl(og.replace('_large.', '_medium.'));
  if (png.subarray(1, 4).toString() !== 'PNG') throw new Error('svaret var ingen PNG-bild');
  return png;
}

async function main() {
  const force = process.argv.includes('--force');
  mkdirSync(DIR, { recursive: true });
  for (const [name, path] of Object.entries(mapping())) {
    if (name === config.name) continue; // vår egen logga ligger i public/icons
    const file = join(DIR, `${logoSlug(name)}.png`);
    if (existsSync(file) && !force) continue;
    // Cloudflare spärrar ibland tillfälligt, så försök några gånger
    for (let i = 1; i <= 3; i++) {
      try {
        writeFileSync(file, fetchLogo(path));
        log(`✓ ${name}`);
        break;
      } catch (e) {
        if (i === 3) log(`✗ ${name}: ${(e as Error).message.split('\n')[0].slice(0, 120)}`);
        else await sleep(10_000 * i);
      }
    }
    await sleep(2500);
  }

  // Påminn om lag i tabellerna som saknar logga
  const known = new Set(Object.keys(mapping()));
  for (const t of config.teams) {
    const data = read<TeamData>(`teams/${t.key}.json`);
    for (const row of data?.standings ?? []) {
      if (!known.has(row.team)) log(`Saknar logga för "${row.team}" – lägg till den under teamLogos i config/club.json`);
    }
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scraper/logos.ts')) await main();
