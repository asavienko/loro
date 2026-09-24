import { atInstant, jumpTo, returnToForeground, runFor } from './clock'
import { expect, onboard, test } from './fixtures'
import { START_WAVE, bankedRow, railCount, repsTodayRow, streakChip } from './helpers'

test(
  'LB-01..LB-08: Today exposes the finite set, the day, and every built destination',
  {
    tag: '@smoke',
  },
  async ({ page }) => {
    await onboard(page)

    // The chrome, top to bottom: the spine names the place and opens the switcher, the root
    // header carries the date and the streak, and the rail sits on a hairline under it.
    await expect(page.getByRole('button', { name: /Today, open the menu/ })).toBeVisible()
    await expect(streakChip(page)).toHaveText('—')
    const header = page.getByTestId('today-header')
    expect(Math.round((await header.boundingBox())?.height ?? 0)).toBe(64)
    await expect(header).toHaveCSS('padding-left', '16px')
    await expect(page.getByTestId('today-rail')).toHaveCSS('padding-left', '20px')
    await expect(page.getByTestId('today-wordmark').getByText('Loro')).toHaveCSS(
      'letter-spacing',
      '-0.5px',
    )
    await expect(page.getByTestId('today-profile')).toHaveCSS('margin-left', '2px')
    const streakChipBox = page.getByTestId('today-streak')
    await expect(streakChipBox).toHaveCSS('padding-left', '10px')
    await expect(streakChipBox).toHaveCSS('padding-top', '4px')
    await expect(streakChipBox).toHaveCSS('gap', '4px')
    await expect(streakChipBox).toHaveCSS('border-radius', '999px')
    await expect(
      streakChipBox.locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    const greeting = page.getByTestId('today-greeting').locator('[style*="font-size"]').first()
    await expect(greeting).toHaveCSS('font-size', '30px')
    await expect(greeting).toHaveCSS('line-height', '36px')
    await expect(greeting).toHaveCSS('letter-spacing', '-0.45px')
    await expect(page.getByTestId('today-cycle')).toHaveCSS('margin-bottom', '4px')
    await expect(page.getByTestId('today-cycle')).toHaveCSS('gap', '6px')
    await expect(
      page.getByTestId('today-cycle-label').locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('letter-spacing', '0.55px')
    await expect(
      page.getByTestId('today-cycle-label').locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    const pulse = await page.getByTestId('today-cycle-pulse').boundingBox()
    expect(Math.round(pulse?.width ?? 0)).toBe(8)
    expect(Math.round(pulse?.height ?? 0)).toBe(8)
    await expect(page.getByTestId('today-due')).toHaveCSS('margin-top', '2px')
    const dueFace = page.getByTestId('today-due').locator('[style*="font-size"]').first()
    await expect(dueFace).toHaveCSS('font-size', '14px')
    await expect(dueFace).toHaveCSS('line-height', '22px')
    await expect(
      page.getByTestId('today-due-count').locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '600')
    await expect(page.getByText('Clara')).toHaveCount(0)

    // The day, in order: three waves at the scheduler's own 24-hour times, exactly one of them
    // next, and the reps so far.
    const waveHeading = page
      .getByTestId('today-wave-heading')
      .getByText('Circadian Spaced Waves', { exact: true })
    await expect(waveHeading).toBeVisible()
    await expect(waveHeading).toHaveCSS('font-size', '20px')
    await expect(waveHeading).toHaveCSS('line-height', '28px')
    await expect(waveHeading).toHaveCSS('font-weight', '600')
    await expect(waveHeading).toHaveCSS('text-transform', 'none')
    await expect(page.getByText('Cadence Run', { exact: true })).toBeVisible()
    await expect(page.getByText('All Shelves', { exact: true })).toBeVisible()
    const jumpHeading = page
      .getByTestId('today-jump-heading')
      .getByText('Jump Back In', { exact: true })
    await expect(jumpHeading).toBeVisible()
    await expect(jumpHeading).toHaveCSS('font-size', '20px')
    await expect(jumpHeading).toHaveCSS('line-height', '28px')
    await expect(jumpHeading).toHaveCSS('font-weight', '600')
    await expect(
      page.getByTestId('today-jump-browse').locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('letter-spacing', '0.55px')
    await expect(
      page.getByTestId('today-jump-browse').locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('text-transform', 'uppercase')
    await expect(
      page.getByTestId('today-jump-browse').locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    const day = [
      { wave: 'Morning wave', time: '8:00 AM ·' },
      { wave: 'Midday wave', time: '1:00 PM ·' },
      { wave: 'Evening wave', time: '7:00 PM ·' },
    ]
    for (const { wave, time } of day) {
      await expect(page.getByText(wave, { exact: true })).toBeVisible()
      await expect(page.getByText(time, { exact: true })).toBeVisible()
    }
    const waveTrackPad = await page.getByTestId('today-wave-track').evaluate((node) => {
      const content = node.firstElementChild
      return getComputedStyle(content ?? node).paddingBottom
    })
    expect(waveTrackPad).toBe('8px')
    const waveCard = page.getByTestId('today-wave-card').first()
    const waveCardBox = await waveCard.boundingBox()
    expect(Math.round(waveCardBox?.width ?? 0)).toBe(328)
    await expect(waveCard).toHaveCSS('border-radius', '16px')
    const waveFace = waveCard.locator(':scope > *').first()
    await expect(waveFace).toHaveCSS('padding-top', '16px')
    await expect(waveFace).toHaveCSS('padding-left', '16px')
    await expect(waveFace).toHaveCSS('gap', '0px')
    for (const head of await page.getByTestId('today-wave-head').all()) {
      await expect(head).toHaveCSS('gap', '4px')
    }
    await expect(
      page.getByTestId('today-wave-badge').first().locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('letter-spacing', '0.55px')
    await expect(
      page.getByTestId('today-wave-badge').first().locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    await expect(
      page.getByTestId('today-wave-mixes').locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('letter-spacing', '0.55px')
    await expect(
      page.getByTestId('today-wave-mixes').locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('text-transform', 'uppercase')
    await expect(
      page.getByTestId('today-wave-mixes').locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    await expect(
      page.getByTestId('today-wave-phrases').first().locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    for (const title of await page.getByTestId('today-wave-title').all()) {
      await expect(title).toHaveCSS('margin-top', '4px')
      const face = title.locator('[style*="font-size"]').first()
      await expect(face).toHaveCSS('font-size', '20px')
      await expect(face).toHaveCSS('line-height', '28px')
      await expect(face).toHaveCSS('font-weight', '600')
    }
    for (const line of await page.getByTestId('today-wave-title-line').all()) {
      await expect(line).toHaveCSS('gap', '0px')
    }
    for (const manner of await page.getByTestId('today-wave-manner').all()) {
      const face = manner.locator('[style*="font-size"]').first()
      await expect(face).toHaveCSS('font-size', '12px')
      await expect(face).toHaveCSS('line-height', '18px')
      await expect(face).toHaveCSS('font-weight', '400')
    }
    for (const footer of await page.getByTestId('today-wave-footer').all()) {
      await expect(footer).toHaveCSS('padding-top', '4px')
    }
    const waveforms = page.getByTestId('today-waveform')
    for (const waveform of await waveforms.all()) {
      await expect(waveform).toHaveCSS('padding-top', '10px')
      await expect(waveform).toHaveCSS('padding-left', '10px')
      await expect(waveform).toHaveCSS('gap', '4px')
      expect(Math.round((await waveform.boundingBox())?.height ?? 0)).toBe(48)
    }
    await expect(waveforms.first()).toHaveCSS('background-color', 'rgb(246, 243, 238)')
    await expect(waveforms.nth(1)).toHaveCSS('background-color', 'rgb(240, 237, 232)')
    const laterFace = page.getByTestId('today-wave-card').nth(1).locator(':scope > *').first()
    await expect(laterFace).toHaveCSS('opacity', '0.6')
    await expect(laterFace).toHaveCSS('background-color', 'rgb(246, 243, 238)')
    const nextWave = page.getByTestId('today-wave-start').locator('xpath=ancestor::*[@data-testid="today-wave-card"]')
    const nextWaveShadow = await nextWave.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(nextWaveShadow).toContain('35, 30, 24')
    expect(nextWaveShadow).toContain('0.1')
    const laterWave = page
      .getByTestId('today-wave-card')
      .filter({ hasNot: page.getByTestId('today-wave-start') })
      .first()
    const laterWaveShadow = await laterWave.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(laterWaveShadow).toContain('35, 30, 24')
    expect(laterWaveShadow).toContain('0.05')
    expect(laterWaveShadow).not.toContain('0.1')
    await expect(page.getByRole('button', { name: /wave\./ })).toHaveCount(1)
    await expect(repsTodayRow(page, 0)).toBeVisible()
    // A wave is finished by listening, so the day states what that takes. Without this the
    // rule is invisible: nothing else on the screen says a wave can be earned at all.
    await expect(page.getByText('0 of 10 phrases heard three times')).toBeVisible()

    // Today's set: five rows, each openable, with the lock-in window on it.
    await expect(page.getByRole('button', { name: /0 percent automatic/ })).toHaveCount(5)
    await expect(page.getByText('0 of 5 locked in')).toBeVisible()
    await expect(page.getByText('day 1/4').first()).toBeVisible()
    const jumpTiles = page.getByTestId('today-jump-tile')
    await expect(jumpTiles).toHaveCount(4)
    for (const tile of await jumpTiles.all()) {
      const box = await tile.boundingBox()
      expect(Math.round(box?.height ?? 0)).toBe(56)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(844)
      await expect(tile).toHaveCSS('border-radius', '12px')
      const jumpShadow = await tile.evaluate((node) => getComputedStyle(node).boxShadow)
      expect(jumpShadow).toContain('35, 30, 24')
      expect(jumpShadow).toContain('0.05')
    }
    await expect(page.getByTestId('today-jump-reserved')).toHaveCount(1)
    for (const copy of await page.getByTestId('today-jump-copy').all()) {
      await expect(copy).toHaveCSS('gap', '0px')
      await expect(copy).toHaveCSS('padding-left', '10px')
      await expect(copy).toHaveCSS('padding-top', '6px')
    }
    const jumpTitle = page.getByTestId('today-jump-title').first().locator('[style*="font-size"]').first()
    await expect(jumpTitle).toHaveCSS('font-size', '12px')
    await expect(jumpTitle).toHaveCSS('line-height', '16px')
    await expect(jumpTitle).toHaveCSS('letter-spacing', '0.3px')
    await expect(jumpTitle).toHaveCSS('font-weight', '600')
    await expect(jumpTitle).toHaveCSS('text-transform', 'none')
    await expect(page.getByText('Café Culture')).toHaveCount(0)
    await expect(page.getByText('16 phrases · 100%')).toHaveCount(0)

    const insight = page.getByTestId('today-insight')
    await expect(insight).toHaveCSS('border-radius', '16px')
    await expect(insight).toHaveCSS('padding-top', '16px')
    await expect(insight).toHaveCSS('padding-left', '16px')
    await expect(insight).toHaveCSS('padding-bottom', '16px')
    await expect(page.getByTestId('today-insight-section')).toHaveCSS('padding-bottom', '24px')
    const insightCardShadow = await insight.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(insightCardShadow === 'none' || insightCardShadow === '').toBeTruthy()
    const insightIcon = page.getByTestId('today-insight-icon')
    const insightIconBox = await insightIcon.boundingBox()
    expect(Math.round(insightIconBox?.width ?? 0)).toBe(48)
    expect(Math.round(insightIconBox?.height ?? 0)).toBe(48)
    await expect(insightIcon).toHaveCSS('border-radius', '12px')
    const insightIconShadow = await insightIcon.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(insightIconShadow).toContain('35, 30, 24')
    expect(insightIconShadow).toContain('0.05')
    const stats = page.getByTestId('today-stats')
    await expect(stats).toHaveCSS('border-radius', '12px')
    await expect(stats).toHaveCSS('padding-top', '8px')
    await expect(stats).toHaveCSS('gap', '0px')
    const statsShadow = await stats.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(statsShadow).toContain('35, 30, 24')
    expect(statsShadow).toContain('0.05')
    const insightTitle = page
      .getByTestId('today-insight-title')
      .getByText('Archival Notebook Insight')
    await expect(insightTitle).toHaveCSS('font-size', '14px')
    await expect(insightTitle).toHaveCSS('line-height', '22px')
    await expect(insightTitle).toHaveCSS('font-weight', '600')
    const insightCount = page.getByTestId('today-insight-count').getByText('0', { exact: true })
    await expect(insightCount).toHaveCSS('font-size', '24px')
    await expect(insightCount).toHaveCSS('line-height', '32px')
    const startPill = page.getByTestId('today-wave-start')
    await expect(startPill).toHaveCSS('padding-left', '16px')
    await expect(startPill).toHaveCSS('padding-top', '8px')
    await expect(startPill).toHaveCSS('gap', '6px')
    const startTri = page.getByTestId('today-wave-start-tri')
    await expect(startTri).toHaveCSS('border-left-width', '18px')
    await expect(startTri).toHaveCSS('border-top-width', '9px')
    await expect(startTri).not.toHaveAttribute('role', 'button')
    await expect(startPill).not.toHaveAttribute('role', 'button')
    const startFace = startPill.locator('[style*="font-size"]').first()
    await expect(startFace).toHaveCSS('font-size', '12px')
    await expect(startFace).toHaveCSS('line-height', '16px')
    await expect(startFace).toHaveCSS('letter-spacing', '0.3px')
    await expect(startFace).toHaveCSS('font-weight', '600')
    await expect(startFace).toHaveCSS('text-transform', 'none')
    const startPillShadow = await startPill.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(startPillShadow).toContain('35, 30, 24')
    expect(startPillShadow).toContain('0.05')
    const statCells = page.getByTestId('today-stats-cell')
    await expect(statCells).toHaveCount(3)
    for (const cell of await statCells.all()) {
      await expect(cell).toHaveCSS('gap', '4px')
    }
    await expect(
      page.getByTestId('today-stats-label').first().locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('letter-spacing', '0.55px')
    await expect(
      page.getByTestId('today-stats-label').first().locator('[style*="letter-spacing"]').first(),
    ).toHaveCSS('text-transform', 'uppercase')
    await expect(
      page.getByTestId('today-stats-label').first().locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    await expect(
      page.getByTestId('today-jump-day').first().locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
    await expect(statCells.nth(0)).toHaveCSS('padding-right', '0px')
    await expect(statCells.nth(1)).toHaveCSS('padding-right', '0px')
    await expect(statCells.nth(2)).toHaveCSS('padding-right', '4px')
    const statValue = page.getByTestId('today-stats-value').first().locator('[style*="font-size"]').first()
    await expect(statValue).toHaveCSS('font-size', '12px')
    await expect(statValue).toHaveCSS('line-height', '16px')
    await expect(statValue).toHaveCSS('letter-spacing', '0.3px')
    await expect(statValue).toHaveCSS('font-weight', '700')
    await expect(statValue).toHaveCSS('text-transform', 'none')
    await expect(page.getByText('38')).toHaveCount(0)
    await expect(page.getByText('94%')).toHaveCount(0)
    const statIcons = page.getByTestId('today-stats-icon')
    await expect(statIcons).toHaveCount(3)
    const statMarks = page.getByTestId('today-stats-mark')
    await expect(statMarks).toHaveCount(3)
    await expect(statMarks.nth(0)).toHaveText('↻')
    await expect(statMarks.nth(1)).toHaveText('✓')
    await expect(statMarks.nth(2)).toHaveText('→')
    for (const icon of await statIcons.all()) {
      const box = await icon.boundingBox()
      expect(Math.round(box?.width ?? 0)).toBe(32)
      expect(Math.round(box?.height ?? 0)).toBe(32)
    }
    for (const mark of await statMarks.all()) {
      const face = await mark.evaluate((node) => {
        const el = node.querySelector('[style]') ?? node.firstElementChild ?? node
        return getComputedStyle(el).fontSize
      })
      expect(face).toBe('18px')
    }

    // The tail of the rolling window, and the one filled control.
    await expect(bankedRow(page, 0)).toBeVisible()
    await expect(page.getByRole('button', { name: START_WAVE })).toBeEnabled()

    await railCount(page, 'Stream', 10).click()
    await expect(page).toHaveURL(/\/practice\/stream$/)
    await expect(page.getByText('Listening Queue')).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Progress' }).click()
    await expect(page).toHaveURL(/\/progress$/)
    await expect(page.getByText('Phrase mastery')).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page).toHaveURL(/\/add$/)
    await expect(page.getByRole('textbox', { name: 'Search phrases' })).toBeVisible()
    await page.getByRole('link', { name: /back/i }).click()

    await page.getByRole('button', { name: START_WAVE }).click()
    await expect(page).toHaveURL((url) => url.pathname === '/practice/refrain')
    await expect(page.getByRole('button', { name: 'Say it' })).toBeVisible()
  },
)

test('NAV-16: the spine reaches every built screen without going Back', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /Today, open the menu/ }).click()

  // The place you are on is named, not offered — a switcher row that goes nowhere is a lie.
  await expect(page.getByText('Where to?')).toBeVisible()
  await expect(page.getByLabel("Today, you're here")).toBeVisible()

  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('button', { name: 'Stream' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Add' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Progress' }).click()
  await expect(page).toHaveURL(/\/progress$/)
})

test('NAV-16: the next wave is the one the clock is on', async ({ page }) => {
  // Fixed at an evening instant, so the day list and the CTA must both name the EVENING wave.
  // The readiness this replaced keyed off a position in an array, so the morning wave was the
  // ready one at every hour of the day.
  await atInstant(page, '2026-04-06T20:30')
  await onboard(page)

  await expect(
    page.getByRole('button', { name: 'Evening wave. Cold + perform · 5 phrases' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the evening wave' })).toBeEnabled()

  // A wave whose hour has gone by recedes, and says nothing about whether it was practised:
  // this learner has no recorded wave completions, so none may be claimed.
  await expect(page.getByText('Morning wave', { exact: true })).toBeVisible()
  await expect(page.getByText('done', { exact: true })).toHaveCount(0)
})

test('LB-01: Today updates the current wave while open and when returning to foreground', async ({
  page,
}) => {
  await atInstant(page, '2026-04-06T12:59:50')
  await onboard(page)
  await expect(page.getByRole('button', { name: 'Start the morning wave' })).toBeEnabled()
  await runFor(page, 10_000)
  await expect(page.getByRole('button', { name: 'Start the midday wave' })).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Midday wave. Re-rep, from memory · 5 phrases' }),
  ).toBeVisible()
  await jumpTo(page, '2026-04-06T20:30')
  await returnToForeground(page)
  await expect(page.getByRole('button', { name: 'Start the evening wave' })).toBeEnabled()
})

test('LB-01: Today rolls an open day at midnight without a foreground event', async ({ page }) => {
  await atInstant(page, '2026-04-06T23:59:50')
  await onboard(page)
  await runFor(page, 10_000)
  await expect(page.getByText('Tuesday, April 7')).toBeVisible()
  await expect(repsTodayRow(page, 0)).toBeVisible()
  // A fresh daily set exists at midnight. Waves record that the learner showed up;
  // they never lock the first slot, including before 08:00.
  await expect(page.getByRole('button', { name: 'Start the morning wave' })).toBeEnabled()
})

test('LB-03: direct Refrain entry stays open before the first scheduled hour', async ({ page }) => {
  await atInstant(page, '2026-04-06T07:59')
  await onboard(page)
  await page.goto('/practice/refrain?wave=morning')
  await expect(page.getByRole('button', { name: 'Say it', exact: true })).toBeVisible()
})
