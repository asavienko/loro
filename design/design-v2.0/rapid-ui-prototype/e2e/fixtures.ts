// Test helpers: fake speech with a voice per language (speaking takes ~20 ms
// per character), a seeded learner past onboarding, and audits for touch
// targets and text size.
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { expect, Page, test as base } from '@playwright/test';

export const STORAGE_KEY = 'loro.prototype.state';

declare global {
  interface Window {
    __spoken: { text: string; lang: string }[];
    /** Simulates a stalled speech service: every utterance ends at once, unspoken. */
    __speechSilent?: boolean;
    /** Languages this device has no voice for (set with addInitScript, before load). */
    __noVoices?: string[];
  }
}

/** Installed before any app code: deterministic voices and utterance timing. */
function fakeSpeech() {
  const voices = [
    { name: 'Test English', lang: 'en-GB' },
    { name: 'Test Español', lang: 'es-ES' },
    // A second Spanish voice (another region): the automatic choice stays Test Español.
    { name: 'Test Mexicano', lang: 'es-MX' },
    { name: 'Test Български', lang: 'bg-BG' },
    { name: 'Test Русский', lang: 'ru-RU' },
  ].map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false }));
  window.__spoken = [];
  let current: SpeechSynthesisUtterance | null = null;
  let timers: number[] = [];
  const synth = {
    getVoices: () => voices.filter((v) => !(window.__noVoices ?? []).includes(v.lang)),
    addEventListener: () => {},
    removeEventListener: () => {},
    speak(u: SpeechSynthesisUtterance) {
      current = u;
      window.__spoken.push({ text: u.text, lang: u.lang });
      if (window.__speechSilent) {
        timers.push(window.setTimeout(() => current === u && u.onend?.(new Event('end') as SpeechSynthesisEvent), 1));
        return;
      }
      const ms = Math.max(150, u.text.length * 20) / (u.rate || 1);
      timers.push(window.setTimeout(() => u.onstart?.(new Event('start') as SpeechSynthesisEvent), 10));
      timers.push(window.setTimeout(() => current === u && u.onend?.(new Event('end') as SpeechSynthesisEvent), 10 + ms));
    },
    resume() {},
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
  /** Review-log entries (see sampleHistory). */
  log?: unknown[];
  name?: string;
  nativeLang?: string;
  targetLang?: string;
  onboarded?: boolean;
  /** Playback speed (default 1.25). */
  speed?: number;
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
      log: seed.log ?? [],
      likes: {},
      ownPhrases: {},
      ownSets: {},
    },
    pending: [],
    prefs: { playMode: 'repeat', repeats: 'auto', speed: seed.speed ?? 1.25, announceEveryStep: false, sortBySet: {} },
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
          try {
            if (!sessionStorage.getItem('seeded')) {
              localStorage.setItem(key as string, JSON.stringify(state));
              sessionStorage.setItem('seeded', '1');
            }
          } catch {
            // about:blank (Back past the app) has no storage.
          }
        },
        [STORAGE_KEY, seededState(seed)] as const,
      );
    }
    // Any uncaught error or React error in the console fails the test.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/Failed to load resource|WebSocket/.test(message.text())) errors.push(`console: ${message.text().slice(0, 300)}`);
    });
    await use(page);
    expect(errors, 'errors in the page').toEqual([]);
  },
});

export { expect };

/** No violations from axe at WCAG 2.1 AA. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
}

/** Every visible control is at least 44×44 px (inline text links excepted), all text is at least 11 px and fields are at least 16 px. */
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
    // iOS zooms the page when a field under 16 px takes focus.
    for (const el of document.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea')) {
      if (!visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 16) out.push(`field under 16px (${size}px) zooms iOS: ${el.getAttribute('aria-label') ?? el.id}`);
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

const DAY = 86_400_000;

/**
 * A few weeks of real-looking history for the Spanish course, relative to
 * `now`: phrases heard and rated at different times, some missed.
 */
export function sampleHistory(now: number) {
  const log: Record<string, unknown>[] = [];
  let n = 0;
  const add = (phraseId: string, setId: string, daysAgo: number, grade?: string) => {
    const at = now - daysAgo * DAY;
    const key = `en-GB>es-ES:${phraseId}`;
    for (let r = 0; r < 3; r++) log.push({ id: `seed.x-${(n++).toString(36)}`, at: at + r * 9000, device: "seed", kind: "heard", key, phraseId, setId, targetMs: 1500 + r * 20, nativeMs: 1100 });
    if (grade) log.push({ id: `seed.x-${(n++).toString(36)}`, at: at + 30000, device: "seed", kind: "rated", key, phraseId, setId, grade });
  };
  const cafe = ["cafe-01", "cafe-02", "cafe-03", "cafe-04", "cafe-05"];
  cafe.forEach((id) => add(id, "set-cafe", 30, "easy"));
  cafe.forEach((id) => add(id, "set-cafe", 26, "easy"));
  cafe.slice(0, 3).forEach((id) => add(id, "set-cafe", 18, "easy"));
  add("cafe-04", "set-cafe", 18, "missed");
  ["tapas-01", "tapas-02", "tapas-03"].forEach((id) => add(id, "set-tapas", 3, "hard"));
  ["transit-01", "transit-02"].forEach((id) => add(id, "set-transit", 1, "missed"));
  add("taxi-01", "set-taxi", 0.02);
  return log.sort((a, b) => (a.at as number) - (b.at as number));
}

/** Every Spanish phrase rated Easy five times over 200 days: all learned, none due yet. */
// Read directly: Playwright's loader can't import the app's JSON modules.
const readJson = <T,>(name: string): T => JSON.parse(fs.readFileSync(new URL(`../src/content/${name}`, import.meta.url), 'utf8')) as T;
const SETS = readJson<{ id: string; targetLang: string; phraseIds: string[] }[]>('sets.json');

export function masteredCourse(now: number) {
  const log: Record<string, unknown>[] = [];
  let n = 0;
  for (const { id: setId, phraseIds } of SETS.filter((s) => s.targetLang === "es-ES")) for (const phraseId of phraseIds) {
    const key = `en-GB>es-ES:${phraseId}`;
    for (const days of [200, 190, 170, 130, 60]) {
      const at = now - days * DAY;
      log.push({ id: `m.x-${(n++).toString(36)}`, at, device: "m", kind: "heard", key, phraseId, setId, targetMs: 1500, nativeMs: 1100 });
      log.push({ id: `m.x-${(n++).toString(36)}`, at: at + 30000, device: "m", kind: "rated", key, phraseId, setId, grade: "easy" });
    }
  }
  return log.sort((a, b) => (a.at as number) - (b.at as number));
}

/** A year of daily listening and ratings over ten phrases (~12k log entries), for load tests. */
export function yearOfHistory(now: number) {
  const ids = ["cafe-01","cafe-02","cafe-03","cafe-04","cafe-05","tapas-01","tapas-02","tapas-03","tapas-04","tapas-05"];
  const log: Record<string, unknown>[] = [];
  let n = 0;
  for (let d = 365; d > 0; d--) ids.forEach((phraseId, k) => {
    const at = now - d * DAY + k * 60000;
    const key = `en-GB>es-ES:${phraseId}`;
    const setId = phraseId.startsWith("cafe") ? "set-cafe" : "set-tapas";
    for (let r = 0; r < 3; r++) log.push({ id: `y.x-${(n++).toString(36)}`, at: at + r * 9000, device: "y", kind: "heard", key, phraseId, setId, targetMs: 1500, nativeMs: 1100 });
    if (d % 3 === 0) log.push({ id: `y.x-${(n++).toString(36)}`, at: at + 40000, device: "y", kind: "rated", key, phraseId, setId, grade: d % 9 ? "easy" : "hard" });
  });
  return log;
}
