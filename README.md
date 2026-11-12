# HC Wettern – klubbapp

En installerbar webbapp (PWA) för HC Wettern som fungerar på mobil, surfplatta och storbildsskärm.
Den visar matcher, livematch, tabell, poängliga, truppen och föreningens nyheter, och har ljust och mörkt tema.

## Så hänger det ihop

```
stats.swehockey.se ─┐
svenskalag.se (RSS) ┼─► scraper/  (Node, körs på schema)  ─►  public/data/*.json  ─►  appen (React)
```

- **Appen läser bara våra egna JSON-filer**, aldrig swehockey direkt. Det blir snabbt, och swehockey belastas inte av varje besökare.
- **Insamlaren** (`scraper/`) läser swehockeys HTML-tabeller utifrån kolumnrubrikerna. Den väntar 1,2 s mellan anropen och identifierar sig med ett eget namn.
- **Ungdomspolicy:** lag i U14 och yngre visas inte (inga namn, resultat eller tabeller). Fliken "Ungdom" visar bara information om verksamheten, nyheter och @hcw_ungdom.

## Kom igång

```bash
npm install
npm run scrape     # hämtar färsk data till public/data
npm run dev        # öppna http://localhost:5173
```

| Kommando | Vad det gör |
|---|---|
| `npm run scrape` | En full hämtning: tabell, schema, trupp, statistik, matchrapporter, nyheter |
| `npm run scrape -- --quick` | Kollar bara om en match pågår och hämtar livehändelser |
| `npm run watch` | Bevakar pågående match och skickar push-notiser |
| `npm run api:dev` / `api:deploy` | Kör API:t lokalt eller publicerar det på Cloudflare |
| `npm run vapid` | Skapar nycklar för push-notiser |
| `npm run discover` | Listar klubbens serier den här säsongen (för `config/club.json`) |
| `npm test` | Testar parsern mot sparade swehockey-sidor i `scraper/fixtures/` |
| `npm run build` | Bygger appen till `dist/` |

**Demo av livematch:** öppna appen med `?demo=live` i adressen. Då spelas den senaste matchrapporten upp som om matchen pågick, med en notis vid varje mål.

## Push-notiser

Fansen får notis vid **nedsläpp, mål (med målskytt och assist) och slutresultat** och väljer själva vilka.

- `scraper/watch.ts` bevakar matchen var 30:e sekund (körs av `.github/workflows/live.yml`) och skickar notiserna med `web-push`.
- `worker/` är ett litet API på Cloudflare (gratis) som sparar prenumerationerna och delar ut liveställningen.
- Länken `<appens adress>?notiser` öppnar notisinställningarna direkt och passar bra att dela på Facebook.
- `npm run watch -- --game 1118646` spelar upp en färdig match och skriver ut notiserna utan att skicka något.

Steg för steg med kostnader för domän och appbutiker: **[docs/PUBLICERING.md](docs/PUBLICERING.md)**.

## Ny säsong eller fler lag

swehockey byter serie-id varje säsong. Kör `npm run discover`, välj serierna och uppdatera `teams` i `config/club.json`:

```json
{ "key": "A", "name": "A-lag", "seriesId": 21407, "league": "HockeyTrean Herr Syd D" }
```

Varje lag blir en knapp i lagväljaren. A-lagets Facebooksida läggs in i `social.facebook`.

## Om swehockey ändrar sina sidor

Parsern testas mot sparade kopior av sidorna. Om hämtningen slutar fungera: spara den nya sidan i `scraper/fixtures/`, kör `npm test` och justera `scraper/parse.ts`.

## Publicering

`.github/workflows/update.yml` hämtar data varje timme och publicerar appen på GitHub Pages. `live.yml` bevakar matcherna. Se [docs/PUBLICERING.md](docs/PUBLICERING.md).
