// A phrase row's status names its number ("Learned · recall 97%", "Recall 82% · back tomorrow",
// U-11); for an hour after a rating it says the rating instead ("Rated Missed — back in 9 min",
// Q-03), since recall is 100% then. The status is never cut off: on a 320 px phone and at 200% text
// only the prompt before it truncates, and the status takes a line of its own when the two don't fit.
import { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/**
 * cafe-01..03 learned; cafe-04 heard on an earlier day and first rated two hours ago; cafe-05 first
 * heard and rated Missed five minutes ago.
 */
function history(native: string, now: number) {
  const log: Record<string, unknown>[] = [];
  let n = 0;
  const add = (phraseId: string, at: number, grade?: string) => {
    const key = `${native}>es-ES:${phraseId}`;
    log.push({ id: `s.x-${(n++).toString(36)}`, at, device: 's', kind: 'heard', key, phraseId, setId: 'set-cafe', targetMs: 1500, nativeMs: 1100 });
    if (grade) log.push({ id: `s.x-${(n++).toString(36)}`, at: at + 30_000, device: 's', kind: 'rated', key, phraseId, setId: 'set-cafe', grade });
  };
  for (const id of ['cafe-01', 'cafe-02', 'cafe-03']) for (const days of [200, 190, 170, 130, 60]) add(id, now - days * DAY, 'easy');
  add('cafe-04', now - 3 * DAY);
  add('cafe-04', now - 2 * HOUR, 'easy');
  add('cafe-05', now - 5 * MINUTE, 'missed');
  return log.sort((a, b) => (a.at as number) - (b.at as number));
}

const FORMS = {
  'en-GB': { learned: /^Learned · recall \d+%$/, learning: /^Recall \d+% · back /, rated: /^Rated Missed — back in \d+ min$/ },
  'bg-BG': { learned: /^Научена · памет \d+%$/, learning: /^Памет \d+% · отново /, rated: /^Оценка „Не се сетих“ — отново след \d+ мин/ },
  'ru-RU': { learned: /^Выучена · память \d+%$/, learning: /^Память \d+% · снова /, rated: /^Оценка «Не помню» — снова через \d+ мин/ },
} as const;

/** Every status matching `form` is whole: not inside a truncated line, not clipped, on screen. */
async function expectWhole(page: Page, form: RegExp, count: number) {
  const statuses = page.getByText(form);
  await expect(statuses).toHaveCount(count);
  for (const status of await statuses.all()) {
    await expect(status).toBeVisible();
    const clipped = await status.evaluate((e) => Boolean(e.closest('.truncate')) || e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > window.innerWidth);
    expect(clipped, `"${await status.textContent()}" is cut off`).toBe(false);
  }
}

for (const [native, form] of Object.entries(FORMS)) {
  test.describe(`${native} phrase statuses`, () => {
    test.use({ seed: { nativeLang: native, log: history(native, Date.now()) } });

    for (const [label, width, height, scale] of [['a 320 px phone', 320, 568, 100], ['200% text', 390, 844, 200]] as const) {
      test(`name their number and stay whole on ${label}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const open = async (hash: string) => {
          await page.goto(hash);
          if (scale !== 100) await page.addStyleTag({ content: `html { font-size: ${scale}% }` });
        };
        await open('/#/set/set-cafe?from=home');
        // Split for layout, the line still reads as one: "The bill, please · Learned · recall 97%".
        if (native === 'en-GB') await expect(page.getByText(/^The bill, please · Learned · recall \d+%$/)).toBeVisible();
        await expectWhole(page, form.learned, 3);
        await expectWhole(page, form.learning, 1);
        await expectWhole(page, form.rated, 1);
        await open('/#/library?view=learning');
        await expectWhole(page, form.learning, 1);
        await expectWhole(page, form.rated, 1);
      });
    }
  });
}

test('a rating still in its undo window reads the same on the row as in the player (Q-03)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play 5 phrases' }).click();
  const player = page.getByRole('dialog', { name: 'Now playing' });
  await player.getByRole('button', { name: 'Pause', exact: true }).click();
  await player.getByRole('button', { name: /^Hard/ }).click();
  const line = player.getByText(/^Rated Hard — back in \d+ min/);
  await expect(line).toBeVisible();
  const said = (await line.textContent())!.replace(/ · .*$/, '');
  await page.getByRole('button', { name: 'Close player' }).click();
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('tab', { name: 'Learning' }).click();
  await expect(page.getByText(`A cortado, please · ${said}`)).toBeVisible();
  await expect(page.getByText(/Recall 100%/)).toHaveCount(0);
});
