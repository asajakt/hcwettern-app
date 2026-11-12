// Snäll HTTP-klient: identifierar sig, väntar mellan anrop och försöker igen vid fel.
const UA = 'HCWetternKlubbapp/0.1 (+https://www.svenskalag.se/hcwettern)';
const GAP_MS = 1200; // minst så här lång paus mellan anrop till samma server
let last = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string, tries = 3): Promise<string> {
  for (let i = 1; ; i++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'sv-SE,sv;q=0.9' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i >= tries) throw new Error(`Kunde inte hämta ${url}: ${(e as Error).message}`);
      await sleep(2000 * i);
    }
  }
}
