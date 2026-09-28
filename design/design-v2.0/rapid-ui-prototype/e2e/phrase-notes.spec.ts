// Every phrase has a picture, its sounds, a memory hint and a grammar rule (plan 105), and they show
// where the learner meets the phrase: its details and the player's cover.
import fs from 'node:fs';
import { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const PHRASES = JSON.parse(fs.readFileSync(new URL('../src/content/phrases.json', import.meta.url), 'utf8')) as {
  id: string;
  target: string;
  image: string[];
  notes: Record<'mnemonic' | 'grammar' | 'pronunciation', { title: string; ipa?: string; respelling?: string }>;
}[];
const byId = new Map(PHRASES.map((p) => [p.id, p]));

async function details(page: Page, setId: string, target: string, label = (t: string) => `Details for ${t}`) {
  await page.goto(`/#/set/${setId}?from=explore`);
  await page.getByRole('button', { name: label(target) }).click();
  return page.getByRole('dialog').last();
}

test('a phrase’s details show its picture, its sounds and all three notes', async ({ page }) => {
  const phrase = byId.get('cafe-01')!;
  const sheet = await details(page, 'set-cafe', phrase.target);
  await expect(sheet.locator('[data-phrase-image]')).toHaveAttribute('data-phrase-image', phrase.image.join(' '));
  await expect(sheet.locator('[data-sounds]')).toContainText(phrase.notes.pronunciation.ipa!);
  await expect(sheet.locator('[data-sounds]')).toContainText(phrase.notes.pronunciation.respelling!);
  const tabs = sheet.getByRole('tab');
  await expect(tabs).toHaveText([/Memory tip$/, /Grammar$/, /Sounds$/]);
  for (const [tab, kind] of [['Memory tip', 'mnemonic'], ['Grammar', 'grammar'], ['Sounds', 'pronunciation']] as const) {
    await sheet.getByRole('tab', { name: tab }).click();
    await expect(sheet.getByRole('tabpanel')).toContainText(phrase.notes[kind].title);
  }
});

test('every course phrase has all four in its details', async ({ page }) => {
  test.setTimeout(90_000);
  for (const [setId, ids] of [
    ['set-cafe', ['cafe-01', 'cafe-02', 'cafe-03', 'cafe-04', 'cafe-05']],
    ['set-taxi', ['taxi-01', 'taxi-02', 'taxi-03', 'taxi-04']],
  ] as const) {
    for (const id of ids) {
      const phrase = byId.get(id)!;
      const sheet = await details(page, setId, phrase.target);
      await expect(sheet.locator('[data-phrase-image]')).toBeVisible();
      await expect(sheet.locator('[data-sounds]')).toBeVisible();
      await expect(sheet.getByRole('tab')).toHaveCount(3);
      await sheet.getByRole('button', { name: 'Close' }).click();
    }
  }
});

test('the player’s cover is the phrase’s picture', async ({ page }) => {
  await page.goto('/#/set/set-cafe?from=explore');
  await page.getByRole('button', { name: 'Play Café & Mañanas' }).click();
  await page.getByRole('button', { name: /^Now playing:/ }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await expect(player.locator('[data-phrase-image]').first()).toHaveAttribute('data-phrase-image', byId.get('cafe-01')!.image.join(' '));
});

test.describe('in Bulgarian', () => {
  test.use({ seed: { nativeLang: 'bg-BG', targetLang: 'es-ES' } });

  test('the notes are in Bulgarian, with nothing left in English', async ({ page }) => {
    const sheet = await details(page, 'set-market', byId.get('market-02')!.target, (t) => `Подробности: ${t}`);
    await expect(sheet.getByRole('tab')).toHaveCount(3);
    await sheet.getByRole('tab').first().click();
    await expect(sheet.getByRole('tabpanel')).toContainText('Póngame: сложете ми');
    await expect(sheet.getByText('Засега бележките са на английски.')).toHaveCount(0);
  });
});
