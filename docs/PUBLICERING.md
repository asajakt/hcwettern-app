# Publicera HC Wettern-appen

Allt nedan är gratis utom en egen domän (valfri) och appbutikerna (valfria).

| Del | Tjänst | Kostnad |
|---|---|---|
| Appen (webb + installerbar PWA) | GitHub Pages | 0 kr |
| Hämtning av data, matchbevakning, notiser | GitHub Actions (publikt repo) | 0 kr |
| Prenumerationer och liveställning | Cloudflare Workers + KV (gratisnivå) | 0 kr |
| Egen domän, t.ex. `hcwettern.se` | Valfri svensk registrar (Loopia, one.com, Binero …) | ca 100–250 kr/år |
| Google Play | Google Play Console | engångsavgift 25 USD (ca 270 kr) |
| App Store (iPhone) | Apple Developer Program | 99 USD/år (ca 1 100 kr/år). Ideella föreningar kan söka avgiftsbefrielse |

> Repot behöver vara **publikt** för att GitHub Actions ska vara obegränsat gratis. Det finns inga hemligheter i koden, de ligger i GitHub Secrets.

---

## 1. GitHub: repo och Pages (ca 10 min)

1. Skapa ett konto på github.com, gärna ett för föreningen, och ett **publikt** repo, t.ex. `hcwettern-app`.
2. Pusha koden:
   ```
   git remote add origin https://github.com/<konto>/hcwettern-app.git
   git push -u origin main
   ```
3. **Settings → Pages → Source: GitHub Actions.**
4. **Actions → "Uppdatera och publicera" → Run workflow.** Efter ett par minuter ligger appen på `https://<konto>.github.io/hcwettern-app/`.

## 2. Push-notiser (ca 20 min)

### a) Skapa nycklar
```
npm run vapid
```
Du får en **Public Key** och en **Private Key**. Den privata nyckeln får aldrig hamna i koden.

### b) Cloudflare Worker (gratis)
1. Skapa ett konto på cloudflare.com (gratisplanen).
2. Kör i projektmappen:
   ```
   npx wrangler login
   npx wrangler kv namespace create KV --config worker/wrangler.toml
   ```
   Klistra in id:t du får i `worker/wrangler.toml` (`id = "…"`).
3. I `worker/wrangler.toml`: sätt `VAPID_PUBLIC_KEY` (den publika nyckeln) och `ALLOWED_ORIGINS` (appens adress, t.ex. `https://<konto>.github.io`).
4. Hitta på ett långt slumpat lösenord som admin-token och lägg in det:
   ```
   npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.toml
   npm run api:deploy
   ```
   Du får en adress som `https://hcwettern-api.<namn>.workers.dev`.

### c) GitHub: Settings → Secrets and variables → Actions
| Typ | Namn | Värde |
|---|---|---|
| Variable | `HCW_API_URL` | workerns adress |
| Variable | `APP_URL` | appens adress, t.ex. `https://<konto>.github.io/hcwettern-app/` |
| Variable | `VAPID_PUBLIC_KEY` | publika nyckeln |
| Variable | `VAPID_SUBJECT` | appens adress (eller `mailto:` till föreningen) |
| Secret | `VAPID_PRIVATE_KEY` | privata nyckeln |
| Secret | `HCW_ADMIN_TOKEN` | samma admin-token som i workern |

Kör "Uppdatera och publicera" en gång till. Därefter syns klockan i appen och notiser kan slås på.

### Så fungerar det
- Arbetsflödet **Matchbevakning** startar var 30:e minut. Om A-laget spelar inom 75 minuter bevakar det matchen var 30:e sekund och skickar notiser vid **nedsläpp, mål och slutresultat**, beroende på vad var och en valt.
- Liveställningen i appen uppdateras via workern var 15:e sekund.
- Efter matchen hämtas ny tabell och statistik, och appen publiceras om.
- **iPhone:** notiser kräver iOS 16.4 eller senare och att appen är tillagd på hemskärmen. Appen visar hur man gör.
- Testa notistexterna utan att skicka något: `npm run watch -- --game 1118646`

## 3. Egen domän (valfritt)

1. Köp t.ex. `hcwettern.se` hos en registrar (ca 100–250 kr/år). Har föreningen redan en domän räcker en underdomän som `app.hcwettern.se` (0 kr).
2. GitHub: **Settings → Pages → Custom domain** → skriv domänen.
3. Hos registraren: lägg in en CNAME-post `app` → `<konto>.github.io`. HTTPS ordnas automatiskt.
4. Uppdatera `APP_URL`, `VAPID_SUBJECT` och `ALLOWED_ORIGINS` till den nya adressen.

En egen domän behövs om appen ska ligga i Google Play (se nedan).

## 4. Appbutikerna (valfritt)

Appen kan redan **installeras gratis** direkt från webbläsaren, med ikon på hemskärmen och notiser. Det fungerar för alla utan appbutik.

**Google Play (ca 270 kr en gång):**
1. Kräver egen domän (steg 3).
2. Gå till pwabuilder.com, skriv in appens adress och välj *Android → Generate*. Du får ett färdigt Android-paket (Trusted Web Activity) och en `assetlinks.json`.
3. Lägg `assetlinks.json` i `public/.well-known/` och publicera.
4. Skapa ett konto i Google Play Console. Ett **organisationskonto** för föreningen kräver ett D-U-N-S-nummer (gratis). Nya privatkonton måste först testa appen med 12 testare i 14 dagar.
5. Ladda upp paketet. Appen uppdateras automatiskt när webbappen uppdateras.

**App Store (ca 1 100 kr/år):**
- Apple godkänner sällan appar som bara är en webbsida i ett skal. Där behövs ett tunt inbyggt lager (Capacitor) med riktiga iOS-notiser.
- Ideella organisationer kan ansöka om avgiftsbefrielse hos Apple (kräver D-U-N-S-nummer).
- Rekommendation: börja med webbappen och Google Play, och ta App Store när appen har användare.
