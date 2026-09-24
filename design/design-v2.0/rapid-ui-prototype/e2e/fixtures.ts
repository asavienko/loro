// Test helpers: fake speech with a voice per language (speaking takes ~20 ms
// per character), a seeded learner past onboarding, and audits for touch
// targets and text size.
import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test as base } from '@playwright/test';

export const STORAGE_KEY = 'loro.prototype.state';

declare global {
  interface Window {
    __spoken: { text: string; lang: string }[];
  }
}

/** Installed before any app code: deterministic voices and utterance timing. */
function fakeSpeech() {
  const voices = [
    { name: 'Test English', lang: 'en-GB' },
    { name: 'Test Español', lang: 'es-ES' },
    { name: 'Test Български', lang: 'bg-BG' },
    { name: 'Test Русский', lang: 'ru-RU' },
  ].map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false }));
  window.__spoken = [];
  let current: SpeechSynthesisUtterance | null = null;
  let timers: number[] = [];
  const synth = {
    getVoices: () => voices,
    addEventListener: () => {},
    removeEventListener: () => {},
    speak(u: SpeechSynthesisUtterance) {
      current = u;
      window.__spoken.push({ text: u.text, lang: u.lang });
      const ms = Math.max(150, u.text.length * 20) / (u.rate || 1);
      timers.push(window.setTimeout(() => u.onstart?.(new Event('start') as SpeechSynthesisEvent), 10));
      timers.push(window.setTimeout(() => current === u && u.onend?.(new Event('end') as SpeechSynthesisEvent), 10 + ms));
    },
    cancel() {
      timers.forEach(clearTimeout);
      timers = [];
      current = null;
    },
    speaking: false,
    pending: false,
    paused: false,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  class Utterance {
    text: string;
    lang = '';
    rate = 1;
    voice: unknown = null;
    onstart: ((e: Event) => void) | null = null;
    onend: ((e: Event) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true });
}

export interface Seed {
  name?: string;
  nativeLang?: string;
  targetLang?: string;
  onboarded?: boolean;
}

/** A v3 state the app sanitises on load: a learner past onboarding, nothing played. */
export function seededState(seed: Seed = {}) {
  return {
    version: 3,
    learner: {
      profile: {
        name: seed.name ?? 'Ana',
        nativeLang: seed.nativeLang ?? 'en-GB',
        targetLang: seed.targetLang ?? 'es-ES',
        onboarded: seed.onboarded ?? true,
        updatedAt: 1,
      },
      log: [],
      likes: {},
      ownPhrases: {},
      ownSets: {},
    },
    pending: [],
    prefs: { playMode: 'repeat', repeats: 'auto', speed: 1.25, announceEveryStep: false, sortBySet: {} },
    player: {},
  };
}

export const test = base.extend<{ seed: Seed | null }>({
  seed: [{}, { option: true }],
  page: async ({ page, seed }, use) => {
    await page.addInitScript(fakeSpeech);
    if (seed) {
      await page.addInitScript(
        ([key, state]) => {
          if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem(key as string, JSON.stringify(state));
            sessionStorage.setItem('seeded', '1');
          }
        },
        [STORAGE_KEY, seededState(seed)] as const,
      );
    }
    await use(page);
  },
});

export { expect };

/** No violations from axe at WCAG 2.1 AA. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
}

/** Every visible control is at least 44×44 px (inline text links excepted) and all text is at least 11 px. */
export async function expectMobileBasics(page: Page) {
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[inert],[aria-hidden="true"]');
    };
    for (const el of document.querySelectorAll('button, a[href], input, select, [role="tab"], [role="radio"]')) {
      if (!visible(el)) continue;
      // Words inside a sentence are exempt from the target size (WCAG 2.5.8 inline exception).
      if (el.closest('h2') && getComputedStyle(el).display === 'inline') continue;
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) out.push(`small target ${Math.round(r.width)}×${Math.round(r.height)}: ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || !visible(el) || el.classList.contains('material-symbols-outlined') || el.closest('.sr-only')) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 10.9) out.push(`small text ${size}px: ${n.textContent.trim().slice(0, 30)}`);
    }
    return [...new Set(out)];
  });
  expect(problems).toEqual([]);
}
