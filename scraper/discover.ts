// Listar alla serier där klubben har lag den här säsongen (swehockey byter serie-id varje säsong).
//   npm run discover
// Kopiera de serier du vill visa till config/club.json -> teams.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { fetchText } from './http';
import { parseClubSeries } from './parse';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'config', 'club.json'), 'utf8'));
const { base, district, clubSlug } = config.swehockey;

const html = await fetchText(`${base}/District/${district}`);
const $d = cheerio.load(html);
const link = $d(`option[value*="/${clubSlug}/"]`).attr('value');
if (!link) throw new Error(`Hittade inte ${clubSlug} under distrikt ${district}`);
const series = parseClubSeries(cheerio.load(await fetchText(`${base}${link}`)), clubSlug);
const youngest = config.youthPolicy.hideAtOrBelowAge as number;
console.log(`Serier för ${config.name}:`);
for (const s of series) {
  const age = Number(s.name.match(/U(\d+)/)?.[1] ?? 99);
  const flag = age <= youngest ? '  (döljs enligt ungdomspolicyn)' : '';
  console.log(`  ${String(s.seriesId).padEnd(6)} ${s.name}${flag}`);
}
