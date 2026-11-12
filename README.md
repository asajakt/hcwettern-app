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
| `npm run scrape:watch` | Körs i en loop: varannan minut under match, annars var 15:e minut |
| `npm run discover` | Listar klubbens serier den här säsongen (för `config/club.json`) |
| `npm test` | Testar parsern mot sparade swehockey-sidor i `scraper/fixtures/` |
| `npm run build` | Bygger appen till `dist/` |

**Demo av livematch:** öppna appen med `?demo=live` i adressen. Då spelas den senaste matchrapporten upp som om matchen pågick, med en notis vid varje mål.

## Ny säsong eller fler lag

swehockey byter serie-id varje säsong. Kör `npm run discover`, välj serierna och uppdatera `teams` i `config/club.json`:

```json
{ "key": "A", "name": "A-lag", "seriesId": 21407, "league": "HockeyTrean Herr Syd D" }
```

Varje lag blir en knapp i lagväljaren. A-lagets Facebooksida läggs in i `social.facebook`.

## Om swehockey ändrar sina sidor

Parsern testas mot sparade kopior av sidorna. Om hämtningen slutar fungera: spara den nya sidan i `scraper/fixtures/`, kör `npm test` och justera `scraper/parse.ts`.

## Publicering

`.github/workflows/update.yml` hämtar data varje timme. Mellan 16 och 22 kollar den var 5:e minut om en match pågår. Sedan bygger den appen och publicerar den på GitHub Pages. Inga licenser och ingen server behövs.
