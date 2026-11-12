import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'hcw-theme';

const readChoice = (): ThemeChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

/** Ljust, mörkt eller "följ telefonen". Valet sparas på enheten. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = choice === 'dark' || (choice === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1028' : '#1a3165');
    };
    apply();
    mq.addEventListener('change', apply);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      /* privat läge – valet sparas inte */
    }
    return () => mq.removeEventListener('change', apply);
  }, [choice]);
  const cycle = () => setChoice((c) => (c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system'));
  return { choice, setChoice, cycle };
}
