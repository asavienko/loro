// Every phrase has a picture, its sounds, a memory hint and a grammar rule (plan 105), and they show
// where the learner meets the phrase: its details and the player's cover.
import fs from 'node:fs';
import { Page } from '@playwright/test';
import { expect, test, WRITTEN_NOTES } from './fixtures';

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

async function typePhrase(page: Page, target: string, native: string, language = 'Spanish') {
  await page.goto('/#/library?view=mine');
  await page.getByRole('button', { name: 'Add your phrase' }).click();
  await page.getByLabel(`In ${language}`).fill(target);
  await page.getByLabel('In English').fill(native);
  await page.getByRole('button', { name: 'Add phrase' }).click();
  await page.getByRole('button', { name: `Details for ${target}` }).click();
  return page.getByRole('dialog').last();
}

test.describe('a phrase the learner types', () => {
  test('takes the bank’s notes when the bank has it', async ({ page }) => {
    const sheet = await typePhrase(page, '¿a qué hora es el desayuno?', 'Breakfast when?');
    await expect(sheet.locator('[data-phrase-image]')).toBeVisible();
    await expect(sheet.locator('[data-sounds]')).toBeVisible();
    await expect(sheet.getByRole('tab')).toHaveCount(3);
  });

  test('without a writer, gets notes the device works out, and says so', async ({ page }) => {
    const sheet = await typePhrase(page, 'Mi perro se llama Rufo', 'My dog is called Rufo');
    await expect(sheet.locator('[data-phrase-image]')).toBeVisible();
    await expect(sheet.locator('[data-sounds]')).toContainText('[mi ˈpe.ro se ˈʝa.ma ˈru.fo]');
    await expect(sheet.locator('[data-sounds]')).toContainText('mee PEH-rroh seh YAH-mah RROO-foh');
    await expect(sheet.getByText('Loro worked these notes out on this device from Spanish spelling and grammar. No native speaker has checked them.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Ask the writer for its notes' })).toHaveCount(0);
    // All three notes: the grammar is the construction it shows.
    await expect(sheet.getByRole('tab')).toHaveCount(3);
    for (const tab of ['Memory tip', 'Grammar', 'Sounds']) {
      await sheet.getByRole('tab', { name: tab }).click();
      await expect(sheet.getByRole('tabpanel')).not.toBeEmpty();
    }
    await sheet.getByRole('tab', { name: 'Grammar' }).click();
    await expect(sheet.getByRole('tabpanel')).toContainText('«se llama»: names');
  });

  test('needs something to say aloud: a text of only marks can’t be added', async ({ page }) => {
    await page.goto('/#/library?view=mine');
    await page.getByRole('button', { name: 'Add your phrase' }).click();
    await page.getByLabel('In Spanish').fill('¿?');
    await page.getByLabel('In English').fill('A question');
    await expect(page.getByRole('button', { name: 'Add phrase' })).toBeDisabled();
    await page.getByLabel('In Spanish').fill('¿2?');
    await expect(page.getByRole('button', { name: 'Add phrase' })).toBeEnabled();
  });

  test('with a writer, gets AI notes, marked as such; asked again if the first try fails', async ({ page }) => {
    let calls = 0;
    const asked: unknown[] = [];
    await page.route('**/api/phrases/status', (route) => route.fulfill({ json: { live: true } }));
    await page.route('**/api/phrases/notes', (route) => {
      asked.push(route.request().postDataJSON());
      // The first try (just after adding) fails; the button asks again.
      if (calls++ === 0) return route.fulfill({ status: 502, json: { error: 'unavailable' } });
      return route.fulfill({ json: { image: ['group'], notes: WRITTEN_NOTES, model: 'stand-in' } });
    });
    const sheet = await typePhrase(page, 'Mi perro se llama Toby', 'My dog is called Toby');
    // Until the writer answers, the device's notes stand.
    await expect(sheet.getByText(/worked these notes out on this device/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Ask the writer for its notes' }).click();
    await expect(sheet.getByText('Its notes are written by AI. No native speaker has checked them.')).toBeVisible();
    await expect(sheet.getByRole('tab')).toHaveCount(3);
    await expect(sheet.locator('[data-phrase-image]')).toHaveAttribute('data-phrase-image', 'group');
    await expect(sheet.getByText(/worked these notes out on this device/)).toHaveCount(0);
    expect(asked[0]).toEqual({ target: 'Mi perro se llama Toby', native: 'My dog is called Toby', targetLang: 'es-ES', nativeLang: 'en-GB' });
  });
});

test.describe('a phrase the learner types in the Bulgarian course', () => {
  test.use({ seed: { nativeLang: 'en-GB', targetLang: 'bg-BG' } });

  test('gets its picture, sounds and notes, and names a stress Loro doesn’t know', async ({ page }) => {
    const sheet = await typePhrase(page, 'Искам да купя хляб', 'I want to buy bread', 'Bulgarian');
    await expect(sheet.locator('[data-phrase-image]')).toHaveAttribute('data-phrase-image', /^bakery_dining/);
    await expect(sheet.locator('[data-sounds]')).toContainText('[ˈiskɐm dɐ kupʲa ˈxʎap]');
    await sheet.getByRole('tab', { name: 'Grammar' }).click();
    await expect(sheet.getByRole('tabpanel')).toContainText('да, not an infinitive');
    await sheet.getByRole('tab', { name: 'Sounds' }).click();
    await expect(sheet.getByRole('tabpanel')).toContainText('Loro doesn’t know where the stress falls in «купя» yet');
  });
});
