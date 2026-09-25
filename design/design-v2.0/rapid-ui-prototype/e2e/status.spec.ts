// A phrase row's status names its number ("Learned · recall 97%", "Recall 100% · back tomorrow",
// U-11), and the status is never cut off: on a 320 px phone and at 200% text only the prompt
// before it truncates, and the status takes a line of its own when the two don't fit.
import { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** cafe-01..03 learned; cafe-04 heard on an earlier day and first rated today; cafe-05 first heard today. */
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
  add('cafe-04', now - HOUR, 'easy');
  add('cafe-05', now - HOUR, 'easy');
  return log.sort((a, b) => (a.at as number) - (b.at as number));
}

const FORMS = {
  'en-GB': { learned: /^Learned · recall \d+%$/, learning: /^Recall \d+% · back / },
  'bg-BG': { learned: /^Научена · памет \d+%$/, learning: /^Памет \d+% · отново / },
  'ru-RU': { learned: /^Выучена · память \d+%$/, learning: /^Память \d+% · снова / },
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
        await expectWhole(page, form.learning, 2);
        await open('/#/library?view=learning');
        await expectWhole(page, form.learning, 2);
      });
    }
  });
}
