import { useState } from 'react';
import type { PushPrefs } from '../../shared/types';
import { useInstall, usePush } from '../push';
import { Card, Icon, Sheet, useApp } from './ui';

const KINDS: [keyof PushPrefs, string, string][] = [
  ['goal', 'Mål', 'Varje mål i A-lagets matcher, med målskytt och assist'],
  ['final', 'Slutresultat', 'När matchen är slut'],
  ['start', 'Nedsläpp', 'När matchen börjar'],
];

/** Inställningar för notiser. */
export function NotifySheet({ onClose }: { onClose: () => void }) {
  const { club } = useApp();
  const push = usePush(club.api);
  const install = useInstall();
  const on = push.status === 'on';
  return (
    <Sheet onClose={onClose}>
      <div className="player-head">
        <div className="bell-big"><Icon name="bell" size={30} /></div>
        <h3>Notiser från {club.name}</h3>
        <small>Få en notis direkt när det blir mål och när matchen är slut.</small>
      </div>

      {push.status === 'needs-install' && (
        <div className="policy" style={{ marginTop: 16 }}>
          <b>På iPhone behöver appen ligga på hemskärmen först.</b>
          <ol className="steps">
            <li>Tryck på <b>Dela</b> <Icon name="share" size={14} /> i Safari</li>
            <li>Välj <b>Lägg till på hemskärmen</b></li>
            <li>Öppna appen från hemskärmen och slå på notiser här</li>
          </ol>
        </div>
      )}
      {push.status === 'unsupported' && <p className="empty">Den här webbläsaren stöder inte notiser. Prova Chrome, Edge, Firefox eller Safari (iOS 16.4+).</p>}
      {push.status === 'no-api' && <p className="empty">Notiser är inte aktiverade på servern ännu.</p>}
      {push.status === 'denied' && <p className="empty">Du har blockerat notiser för appen. Tillåt dem i webbläsarens eller telefonens inställningar.</p>}

      {(push.status === 'off' || push.status === 'on' || push.status === 'working') && (
        <>
          <div className="toggles">
            {KINDS.map(([k, label, desc]) => (
              <label key={k} className="toggle">
                <div>
                  <b>{label}</b>
                  <small>{desc}</small>
                </div>
                <input type="checkbox" checked={push.prefs[k]} onChange={(e) => push.updatePrefs({ ...push.prefs, [k]: e.target.checked })} />
                <span className="sw" />
              </label>
            ))}
          </div>
          <button className={`btn ${on ? 'ghost' : 'primary'} wide`} disabled={push.status === 'working'} onClick={() => (on ? push.disable() : push.enable())}>
            {push.status === 'working' ? 'Vänta…' : on ? 'Stäng av notiser' : 'Slå på notiser'}
          </button>
          {on && <p className="ok-note">✓ Notiser är påslagna på den här enheten</p>}
        </>
      )}
      {push.error && <p className="empty">Något gick fel: {push.error}</p>}
      {!install.installed && install.canPrompt && (
        <button className="btn ghost wide" onClick={install.prompt}>
          <Icon name="download" size={16} /> Installera appen
        </button>
      )}
    </Sheet>
  );
}

/** Kort på startsidan som uppmanar till att installera appen. */
export function InstallCard() {
  const install = useInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('hcw-install-hidden') === '1';
    } catch {
      return false;
    }
  });
  const [showIos, setShowIos] = useState(false);
  if (install.installed || hidden || (!install.canPrompt && !install.ios)) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem('hcw-install-hidden', '1');
    } catch {
      /* ignorera */
    }
  };
  return (
    <Card className="install">
      <div className="install-row">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={48} height={48} className="app-ico" />
        <div>
          <b>Ladda ner HC Wettern-appen</b>
          <small>Gratis. Ligger på hemskärmen och ger notiser vid mål.</small>
        </div>
        <button className="x" onClick={hide} aria-label="Dölj"><Icon name="close" size={14} /></button>
      </div>
      {install.canPrompt ? (
        <button className="btn primary wide" onClick={install.prompt}><Icon name="download" size={16} /> Installera</button>
      ) : !showIos ? (
        <button className="btn primary wide" onClick={() => setShowIos(true)}><Icon name="download" size={16} /> Så installerar du på iPhone</button>
      ) : (
        <ol className="steps">
          <li>Tryck på <b>Dela</b> <Icon name="share" size={14} /> längst ner i Safari</li>
          <li>Välj <b>Lägg till på hemskärmen</b></li>
          <li>Klart! Öppna appen från hemskärmen</li>
        </ol>
      )}
    </Card>
  );
}

