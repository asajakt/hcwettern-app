// Skickar en testnotis till alla som slagit på mål-notiser.
// Körs från GitHub: Actions → "Testnotis" → Run workflow.
import { config } from './core';
import { sendPush } from './push';

const appUrl = (process.env.APP_URL || config.appUrl || './').replace(/\/?$/, '/');
await sendPush([
  {
    kind: 'goal',
    title: `MÅL! ${config.name} 1–0 (test)`,
    body: 'Det här är en testnotis. Fungerar den, då kommer målen på söndag också fram. 🏒',
    tag: 'hcw-test',
    url: appUrl,
  },
]);
