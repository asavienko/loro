// Make a set (plan 103): say what you want to talk about (a topic, keywords or a text), then decide
// one suggested phrase at a time, swiping right to add and left to skip, and save what you added
// as a set. Offline the suggestions come from the phrase bank and the course; with a writer on the
// server they are AI-written and say so (tested against a stand-in, never the real service).
import { Locator, Page } from '@playwright/test';
import { expect, test, WRITTEN_NOTES } from './fixtures';

const make = (page: Page) => page.getByRole('dialog', { name: /^(Make a set|Add to )/ });
const card = (page: Page) => make(page).getByRole('group', { name: /^Suggestion \d+ of \d+$/ });

async function open(page: Page) {
  await page.goto('/#/library?view=ownSets');
  await page.getByRole('button', { name: 'Make a set' }).click();
  await expect(make(page)).toBeVisible();
}

async function ask(page: Page, mode: 'Topic' | 'Keywords' | 'Text', input: string) {
  const dialog = make(page);
  await dialog.getByRole('button', { name: mode, exact: true }).click();
  await dialog.getByRole('textbox').fill(input);
  await dialog.getByRole('button', { name: 'Suggest phrases' }).click();
}

/**
 * A finger's drag across the top card, a frame per step (as gestures.spec.ts drags). It stays on
 * the screen: Firefox reads a mouse past the window's edge as x = 0, which a finger never is.
 */
async function swipe(page: Page, dx: number) {
  const box = (await page.locator('[data-swipe-card]').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x + (dx * i) / 20, y + i / 4);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function expectCard(page: Page, position: string | RegExp, target: string | RegExp) {
  await expect(card(page)).toHaveAccessibleName(typeof position === 'string' ? `Suggestion ${position}` : position);
  await expect(card(page).locator('p[lang="es-ES"]')).toHaveText(target);
}

const rows = (page: Page): Locator => page.getByRole('main').getByRole('listitem');


test('a topic becomes a set: swipe, the buttons and the keys add and skip, Undo takes back, a card can be corrected', async ({ page }) => {
  await open(page);
  await expect(make(page).getByText('Suggestions come from the phrases on this device.')).toBeVisible();
  await ask(page, 'Topic', 'pharmacy');

  await expectCard(page, '1 of 6', '¿Dónde hay una farmacia cerca?');
  await expect(card(page)).toContainText('Where is there a pharmacy nearby?');
  await expect(card(page)).toContainText('Loro phrase bank');
  // The deck opens on Add, so a keyboard starts on the first phrase.
  await expect(make(page).getByRole('button', { name: 'Add ¿Dónde hay una farmacia cerca?' })).toBeFocused();

  await swipe(page, 150); // right: add
  await expectCard(page, '2 of 6', '¿Tiene algo para el dolor de cabeza?');
  await expect(make(page).getByText('1 added')).toBeVisible();
  await swipe(page, -150); // left: skip
  await expectCard(page, '3 of 6', 'Me duele la garganta');
  // A short drag springs back and decides nothing.
  await swipe(page, 40);
  await expectCard(page, '3 of 6', 'Me duele la garganta');
  // (A tap straight after a drag is taken for the drag's own ghost click: wait as a finger would.)
  await page.waitForTimeout(400);

  await make(page).getByRole('button', { name: 'Skip Me duele la garganta' }).click();
  await expectCard(page, '4 of 6', 'Necesito ver a un médico');
  await make(page).getByRole('button', { name: 'Undo: Me duele la garganta' }).click();
  await expectCard(page, '3 of 6', 'Me duele la garganta');
  await page.keyboard.press('ArrowRight');
  await expectCard(page, '4 of 6', 'Necesito ver a un médico');

  // Corrected before it is added, in both languages.
  await card(page).getByRole('button', { name: 'Correct Necesito ver a un médico' }).click();
  await make(page).getByLabel('In Spanish').fill('Necesito ver a una médica');
  await make(page).getByLabel('In English').fill('I need to see a (woman) doctor');
  await make(page).getByRole('button', { name: 'Save' }).click();
  await expectCard(page, '4 of 6', 'Necesito ver a una médica');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');

  await expect(make(page).getByRole('heading', { name: 'That’s all 6 suggestions' })).toBeFocused();
  await expect(make(page).getByText('You added 3 phrases.')).toBeVisible();
  await make(page).getByRole('button', { name: 'Save 3 phrases' }).click();

  await expect(make(page).getByLabel('Name')).toHaveValue('Pharmacy');
  await expect(make(page).getByText('3 phrases to save')).toBeVisible();
  await make(page).getByRole('button', { name: 'Create' }).click();

  await expect(make(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pharmacy', level: 1 })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Created Pharmacy');
  // A phrase from the bank keeps the bank's picture and notes.
  await page.getByRole('button', { name: 'Details for Me duele la garganta' }).click();
  const bankSheet = page.getByRole('dialog').last();
  await expect(bankSheet.locator('[data-phrase-image]')).toBeVisible();
  await expect(bankSheet.getByRole('tab')).toHaveCount(3);
  await bankSheet.getByRole('button', { name: 'Close' }).click();
  // In the order they were added, the correction included.
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText('¿Dónde hay una farmacia cerca?');
  await expect(rows(page).nth(1)).toContainText('Me duele la garganta');
  await expect(rows(page).nth(2)).toContainText('Necesito ver a una médica');
  // Each says where its text came from.
  await page.getByRole('button', { name: 'Details for ¿Dónde hay una farmacia cerca?' }).click();
  await expect(page.getByRole('dialog', { name: 'Your phrase' }).getByText('From Loro’s phrase bank.')).toBeVisible();
});

test('keywords find the course’s own phrases, which join the set without a copy in Mine', async ({ page }) => {
  await open(page);
  await ask(page, 'Keywords', 'coffee, milk');
  await expectCard(page, '1 of 5', '¿Tienen leche de avena?');
  await expect(card(page)).toContainText('From Café & Mañanas');
  await page.keyboard.press('ArrowRight');
  await make(page).getByRole('button', { name: 'Done' }).click();
  await expect(make(page).getByLabel('Name')).toHaveValue('Coffee, milk');
  await make(page).getByLabel('Name').fill('Café');
  await make(page).getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Café', level: 1 })).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await page.goto('/#/library?view=mine');
  await expect(page.getByText('Add a phrase of your own and it plays like any other.')).toBeVisible();
});

test('a pasted text brings phrases about what it says', async ({ page }) => {
  await open(page);
  await ask(page, 'Text', 'Tomorrow we fly home. My flight is at ten and I have to check in two suitcases. I hope it does not rain!');
  await expectCard(page, /^Suggestion 1 of \d+$/, 'Mi vuelo sale a las diez');
});

test('nothing to suggest says so, and offers to write the phrase yourself', async ({ page }) => {
  await open(page);
  await ask(page, 'Topic', 'xyzzy');
  await expect(make(page).getByText('No phrases for “xyzzy” yet.')).toBeVisible();
  await make(page).getByRole('button', { name: 'Add your own phrase' }).click();
  await expect(page.getByRole('dialog', { name: 'Add your phrase' })).toBeVisible();
});

test('a topic chip suggests at once, and More finds more until there is no more', async ({ page }) => {
  await open(page);
  await make(page).getByRole('button', { name: 'At the hotel' }).click();
  await expectCard(page, '1 of 6', 'Tengo una reserva a nombre de García');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
  await expect(make(page).getByText('You skipped them all.')).toBeVisible();
  await expect(make(page).getByRole('button', { name: /^Save/ })).toHaveCount(0);
  await make(page).getByRole('button', { name: 'More suggestions' }).click();
  await expect(make(page).getByText('No more suggestions for this.')).toBeVisible();
  // Another topic deals into the same deck, so one set can hold several.
  await make(page).getByRole('button', { name: 'Try something else' }).click();
  await ask(page, 'Keywords', 'umbrella');
  await expectCard(page, '7 of 12', 'Llévate un paraguas');
});

test('AI suggestions say they are AI-written and unchecked, and keep saying it once added', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route('**/api/phrases/status', (route) => route.fulfill({ json: { live: true } }));
  await page.route('**/api/phrases/suggest', (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        model: 'stand-in',
        phrases: [
          { target: '¿Me puede recomendar algo para la tos?', native: 'Can you recommend something for a cough?', image: ['medication', 'sick'], notes: WRITTEN_NOTES },
          { target: 'La cuenta, por favor', native: 'The bill, please', image: ['receipt_long'], notes: WRITTEN_NOTES },
        ],
      },
    });
  });
  await open(page);
  await expect(make(page).getByText('AI writes the suggestions. No native speaker has checked them.')).toBeVisible();
  await ask(page, 'Topic', 'cough');
  await expectCard(page, '1 of 2', '¿Me puede recomendar algo para la tos?');
  await expect(card(page)).toContainText('Written by AI · not checked');
  expect(sent).toEqual([{ mode: 'topic', input: 'cough', targetLang: 'es-ES', nativeLang: 'en-GB', avoid: [] }]);
  await page.keyboard.press('ArrowRight');
  // A phrase the course has is offered as the course's, not as a new one.
  await expect(card(page)).toContainText('From Café & Mañanas');
  await page.keyboard.press('ArrowLeft');
  await make(page).getByRole('button', { name: 'Save 1 phrase' }).click();
  await make(page).getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Details for ¿Me puede recomendar algo para la tos?' }).click();
  await expect(page.getByText('Written by AI. No native speaker has checked it.')).toBeVisible();
  // It keeps the picture and notes the writer sent with it.
  const sheet = page.getByRole('dialog').last();
  await expect(sheet.locator('[data-phrase-image]')).toHaveAttribute('data-phrase-image', 'medication sick');
  await expect(sheet.getByRole('tabpanel')).toContainText('Tos, a cough');
  await expect(sheet.locator('[data-sounds]')).toContainText('meh PWEH-deh');
});

test('when the AI writer fails, the device’s phrases stand in, and the screen says so', async ({ page }) => {
  await page.route('**/api/phrases/status', (route) => route.fulfill({ json: { live: true } }));
  await page.route('**/api/phrases/suggest', (route) => route.fulfill({ status: 502, json: { error: 'unavailable' } }));
  await open(page);
  await ask(page, 'Topic', 'pharmacy');
  await expect(make(page).getByText('The phrase writer didn’t answer, so these come from this device.')).toBeVisible();
  await expectCard(page, '1 of 6', '¿Dónde hay una farmacia cerca?');
});

test('a search with no phrase in Explore offers suggestions about it', async ({ page }) => {
  await page.goto('/#/explore?q=pharmacy');
  await page.getByRole('button', { name: 'Suggest phrases about “pharmacy”' }).click();
  await expectCard(page, '1 of 6', '¿Dónde hay una farmacia cerca?');
});

test('your own set fills from suggestions, leaving out what it already holds', async ({ page }) => {
  await page.goto('/#/library?view=ownSets');
  await page.getByRole('button', { name: 'New set' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Trip');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Suggest phrases' }).click();
  await expect(make(page)).toHaveAccessibleName('Add to Trip');
  await ask(page, 'Topic', 'weather');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await make(page).getByRole('button', { name: 'Done' }).click();
  await expect(make(page).getByLabel('Name')).toHaveCount(0);
  await make(page).getByRole('button', { name: 'Add 2 phrases to Trip' }).click();
  await expect(make(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('2 phrases added to Trip');
  await expect(rows(page)).toHaveCount(2);
  // Asked again, what the set holds isn't offered again.
  await page.getByRole('button', { name: 'Suggest phrases' }).click();
  await ask(page, 'Topic', 'weather');
  await expectCard(page, '1 of 4', 'Hace mucho frío');
});

test('closed with phrases added but not saved, the flow comes back as it was', async ({ page }) => {
  await open(page);
  await ask(page, 'Topic', 'pharmacy');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await make(page).getByRole('button', { name: 'Close' }).click();
  await expect(make(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reopen' }).click();
  await expectCard(page, '3 of 6', 'Me duele la garganta');
  await expect(make(page).getByText('2 added')).toBeVisible();
  // Back closes it too.
  await page.goBack();
  await expect(make(page)).toHaveCount(0);
  await expect(page.getByText('2 added phrases weren’t saved', { exact: true })).toBeVisible();
});

test.describe('in Russian, learning Bulgarian', () => {
  test.use({ seed: { nativeLang: 'ru-RU', targetLang: 'bg-BG' } });

  test('topics, cards and meanings follow the learner’s languages', async ({ page }) => {
    await page.goto('/#/library?view=ownSets');
    await page.getByRole('button', { name: 'Собрать набор' }).click();
    await page.getByRole('button', { name: 'Здоровье и аптека' }).click();
    const top = page.getByRole('group', { name: /^Подсказка 1 из \d+$/ });
    await expect(top.locator('p[lang="bg-BG"]')).toHaveText('Къде има аптека наблизо?');
    await expect(top.locator('p[lang="ru-RU"]')).toHaveText('Где здесь поблизости аптека?');
    await expect(top).toContainText('Фразы Loro');
  });
});
