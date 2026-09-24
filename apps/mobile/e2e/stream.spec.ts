import type { Page } from '@playwright/test'
import { expect, onboard, test } from './fixtures'
import { runFor } from './clock'
import { dragListenReorder, openNowPlaying, openSimpleQueue } from './helpers'
import { mockTtsStatus } from './learnerApiFlow'

/** HTML editorial/simple header `px-4` — not Navigation chrome 20. */
async function landingHeaderGutter(page: Page): Promise<string | null> {
  return page.getByTestId('stream-done').evaluate((node) => {
    let el: HTMLElement | null = node.parentElement
    while (el) {
      const pad = getComputedStyle(el).paddingRight
      if (pad === '16px' || pad === '20px') return pad
      el = el.parentElement
    }
    return null
  })
}

test('adaptive stream rerates, reorders, transports, loves, and learns phrases', async ({
  page,
}) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()
  await expect(page.getByTestId('stream-editorial-cover')).toBeVisible()
  await expect(page.getByTestId('stream-landing')).toHaveCSS('gap', '16px')
  await expect(page.getByTestId('stream-landing')).toHaveCSS('padding-top', '14px')
  await expect(page.getByTestId('stream-landing')).toHaveCSS('padding-bottom', '14px')
  await expect(page.getByTestId('stream-focused')).toHaveCount(0)
  const cover = await page.getByTestId('stream-editorial-cover').boundingBox()
  expect(Math.round(cover?.width ?? 0)).toBe(64)
  expect(Math.round(cover?.height ?? 0)).toBe(64)
  await expect(page.getByTestId('stream-editorial-cover')).toHaveCSS('border-radius', '16px')
  const hero = page.getByTestId('stream-editorial-hero')
  await expect(hero).toHaveCSS('border-radius', '24px')
  const heroFace = hero.locator(':scope > *').first()
  await expect(heroFace).toHaveCSS('padding-top', '14px')
  await expect(heroFace).toHaveCSS('padding-left', '14px')
  await expect(heroFace).toHaveCSS('border-top-width', '2px')
  const editorialRule = page.getByTestId('stream-hero-rule')
  await expect(editorialRule).toHaveCSS('margin-top', '14px')
  await expect(editorialRule).toHaveCSS('padding-top', '12px')
  const heroShadow = await hero.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(heroShadow).toContain('35, 30, 24')
  expect(heroShadow).toContain('0.05')
  expect(heroShadow).not.toContain('0.1')
  await expect(page.getByTestId('stream-simple-hero')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-theme')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-trail')).toHaveCount(0)
  const coverShadow = await page
    .getByTestId('stream-editorial-cover')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(coverShadow).toContain('35, 30, 24')
  expect(coverShadow).toContain('0.05')
  const editorialTitle = await page.getByTestId('stream-editorial-title').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialTitle).toBe('18px')
  await expect(page.getByTestId('stream-editorial-copy')).toHaveCSS('padding-right', '2px')
  const editorialMeaning = await page.getByTestId('stream-editorial-meaning').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, weight: style.fontWeight, italic: style.fontStyle }
  })
  expect(editorialMeaning.size).toBe('12px')
  expect(editorialMeaning.weight).toBe('500')
  expect(editorialMeaning.italic).toBe('normal')
  await expect(page.getByTestId('stream-editorial-meaning')).toHaveCSS('margin-top', '2px')
  const editorialResp = page.getByTestId('stream-editorial-resp')
  await expect(editorialResp).toBeVisible()
  await expect(editorialResp).toHaveCSS('margin-top', '4px')
  await expect(page.getByText('[meh POH-neh oon kor-TAH-doh]')).toHaveCount(0)
  const queuePhrase = await page.getByTestId('stream-queue-phrase').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(queuePhrase).toBe('13.5px')
  const queueTrack = await page.getByTestId('stream-queue-track').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, weight: style.fontWeight, transform: style.textTransform }
  })
  expect(queueTrack.size).toBe('12px')
  expect(queueTrack.weight).toBe('700')
  expect(queueTrack.transform).toBe('none')
  const editorialPhraseRow = page.getByTestId('stream-queue-phrase-row').first()
  await expect(editorialPhraseRow.getByTestId('stream-queue-difficulty')).toBeVisible()
  const editorialChip = page.getByTestId('stream-queue-difficulty').first()
  await expect(editorialChip).toBeVisible()
  await expect(editorialChip).toHaveCSS('padding-left', '8px')
  await expect(editorialChip).toHaveCSS('padding-top', '2px')
  await expect(editorialChip).toHaveCSS('border-radius', '999px')
  const editorialChipFace = await editorialChip.evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, weight: style.fontWeight, transform: style.textTransform }
  })
  expect(editorialChipFace.size).toBe('9px')
  expect(editorialChipFace.weight).toBe('700')
  expect(editorialChipFace.transform).toBe('none')
  await expect(page.getByTestId('stream-queue-meaning').first()).toHaveCSS('margin-top', '2px')
  const editorialQueueMeaning = await page.getByTestId('stream-queue-meaning').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialQueueMeaning).toBe('11px')
  await expect(page.getByText('· 1:12')).toHaveCount(0)
  await expect(page.getByText('1:12')).toHaveCount(0)
  const queueRow = page.getByTestId('stream-queue-row').first()
  const queueShadow = await queueRow.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(queueShadow).toContain('35, 30, 24')
  expect(queueShadow).toContain('0.05')
  await expect(queueRow).toHaveCSS('padding-top', '10px')
  await expect(queueRow).toHaveCSS('padding-left', '12px')
  await expect(queueRow).toHaveCSS('border-radius', '16px')
  const play = await page.getByTestId('stream-editorial-play').boundingBox()
  expect(Math.round(play?.width ?? 0)).toBe(36)
  expect(Math.round(play?.height ?? 0)).toBe(36)
  const editorialRateRow = page.getByTestId('stream-editorial-rate-row')
  await expect(editorialRateRow).toHaveCSS('margin-top', '0px')
  const editorialRates = await editorialRateRow.boundingBox()
  expect(editorialRates, 'editorial rate row has a box').not.toBeNull()
  expect((editorialRates?.y ?? 0) - ((play?.y ?? 0) + (play?.height ?? 0))).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: 'Playback speed 0.92' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Playback speed 0.8' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Playback speed 1/ })).toBeVisible()
  await expect(page.getByText('1.25×')).toHaveCount(0)
  const editorialPlayShadow = await page
    .getByTestId('stream-editorial-play')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(editorialPlayShadow).toContain('35, 30, 24')
  expect(editorialPlayShadow).toContain('0.1')
  const transport = await page.getByTestId('stream-editorial-transport').first().boundingBox()
  expect(Math.round(transport?.width ?? 0)).toBe(32)
  expect(Math.round(transport?.height ?? 0)).toBe(32)
  const editorialLoop = page.getByRole('button', { name: 'Loop this phrase 1 time' })
  await expect(editorialLoop).toBeVisible()
  await expect(page.getByTestId('stream-editorial-loop-mark')).toHaveText('↻')
  const editorialLoopMark = await page.getByTestId('stream-editorial-loop-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialLoopMark).toBe('12px')
  await expect(page.getByTestId('stream-editorial-loop-row')).toHaveCSS('gap', '4px')
  const editorialLoopFace = await page.getByTestId('stream-editorial-loop-face').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialLoopFace).toBe('10px')
  const editorialSkip = await page.getByTestId('stream-compact-skip-face').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialSkip).toBe('20px')
  await expect(page.getByTestId('stream-hero-transport')).toHaveCSS('gap', '16px')
  await expect(page.getByTestId('stream-hero-transport')).toHaveCSS('margin-top', '8px')
  await expect(page.getByTestId('stream-stage')).toHaveCount(0)
  await expect(page.getByText('Listening Queue')).toBeVisible()
  const queueTitle = page
    .getByTestId('stream-queue-chrome')
    .getByText('Listening Queue')
  await expect(queueTitle).toHaveCSS('font-size', '16px')
  await expect(queueTitle).toHaveCSS('font-weight', '600')
  await expect(queueTitle).toHaveCSS('line-height', '20px')
  await expect(queueTitle).toHaveCSS('letter-spacing', '-0.4px')
  await expect(page.getByTestId('stream-queue-chrome')).toBeVisible()
  await expect(page.getByTestId('stream-landing').getByTestId('stream-queue-chrome')).toHaveCount(0)
  await expect(page.getByText('Spanish · 10 phrases', { exact: true })).toBeVisible()
  await expect(page.getByTestId('stream-queue-chrome').locator('..')).toHaveCSS(
    'padding-bottom',
    '10px',
  )
  const done = page.getByTestId('stream-done')
  await expect(done).toBeVisible()
  expect(await landingHeaderGutter(page)).toBe('16px')
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible()
  const doneShadow = await done.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(doneShadow).toContain('35, 30, 24')
  expect(doneShadow).toContain('0.05')
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCSS(
    'padding-top',
    '6px',
  )
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCSS(
    'padding-left',
    '16px',
  )
  const doneWeight = await page.getByRole('button', { name: 'Done', exact: true }).evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontWeight
  })
  expect(doneWeight).toBe('600')
  await expect(page.getByText('Up Next (9 phrases)', { exact: true })).toBeVisible()
  await expect(page.getByText('Drag to reorder')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-reorder')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-actions')).toHaveCount(0)
  const editorialOptions = page.getByTestId('stream-options').first()
  await expect(editorialOptions).toBeVisible()
  expect(Math.round((await editorialOptions.boundingBox())?.width ?? 0)).toBe(28)
  expect(Math.round((await editorialOptions.boundingBox())?.height ?? 0)).toBe(28)
  const editorialOptionsFace = await editorialOptions
    .getByTestId('stream-options-mark')
    .evaluate((node) => {
      const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
      return getComputedStyle(face).fontSize
    })
  expect(editorialOptionsFace).toBe('16px')
  await expect(editorialOptions.getByTestId('stream-options-mark')).toHaveText('⋯')
  await expect(page.getByRole('button', { name: 'Options', exact: true }).first()).toBeVisible()
  await expect(page.getByText('♥ 0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Difficult 0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Learned 0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Now Playing · Track 01', { exact: true })).toBeVisible()
  await expect(page.getByTestId('stream-now-kicker')).toHaveCSS('padding-left', '2px')
  await expect(page.getByTestId('stream-now-kicker')).toHaveCSS('padding-right', '2px')
  const nowPulse = await page.getByTestId('stream-now-pulse').boundingBox()
  expect(Math.round(nowPulse?.width ?? 0)).toBe(8)
  expect(Math.round(nowPulse?.height ?? 0)).toBe(8)
  await expect(page.getByTestId('stream-now-pulse-row')).toHaveCSS('gap', '6px')
  const nowTarget = await page.getByTestId('stream-now-target').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, weight: style.fontWeight, transform: style.textTransform }
  })
  expect(nowTarget.size).toBe('10px')
  expect(nowTarget.weight).toBe('500')
  expect(nowTarget.transform).toBe('none')
  await expect(page.getByText('Mastered', { exact: true })).toHaveCount(0)
  await expect(page.getByText('BPM')).toHaveCount(0)
  await expect(
    page.getByTestId('stream-now-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('letter-spacing', '0.55px')
  await expect(
    page.getByTestId('stream-now-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('text-transform', 'uppercase')
  await expect(page.getByTestId('stream-upnext-kicker')).toHaveCSS('padding-left', '2px')
  await expect(page.getByTestId('stream-upnext-kicker')).toHaveCSS('padding-right', '2px')
  await expect(
    page.getByTestId('stream-upnext-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('letter-spacing', '0.55px')
  await expect(
    page.getByTestId('stream-upnext-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('text-transform', 'uppercase')
  await expect(page.getByTestId('stream-upnext-stack')).toHaveCSS('gap', '8px')
  await expect(page.getByText('Drag to reorder')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-footer')).toHaveCount(0)
  await expect(page.getByTestId('stream-simple-footer')).toHaveCount(0)
  await expect(page.getByText('Vol. 03')).toHaveCount(0)
  await openNowPlaying(page)
  await expect(page.getByTestId('stream-done')).toHaveCount(0)
  await expect(page.getByText('Playing from Playlist', { exact: true })).toBeVisible()
  await expect(page.getByText('Listening Queue')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-chrome')).toHaveCount(0)
  await expect(page.getByText('Spanish · 10 phrases', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Vol. 03')).toHaveCount(0)
  await expect(page.getByTestId('stream-stage')).toBeVisible()
  await expect(page.getByTestId('stream-stage-wrap')).toHaveCSS('padding-top', '2px')
  await expect(page.getByTestId('stream-stage-wrap')).toHaveCSS('padding-bottom', '2px')
  const stageToTitle = await page.getByTestId('stream-stage-wrap').boundingBox()
  const titleAfterStage = await page.getByTestId('stream-title-row').boundingBox()
  expect(stageToTitle, 'stage wrap has a box').not.toBeNull()
  expect(titleAfterStage, 'title row has a box').not.toBeNull()
  expect(
    (titleAfterStage?.y ?? 0) - ((stageToTitle?.y ?? 0) + (stageToTitle?.height ?? 0)),
  ).toBeLessThanOrEqual(1)
  const counterAfterTitle = await page.getByTestId('stream-counter').boundingBox()
  expect(counterAfterTitle, 'counter has a box').not.toBeNull()
  const counterFace = page.getByTestId('stream-counter').locator('[style*="font-weight"]').first()
  await expect(counterFace).toHaveCSS('font-weight', '600')
  await expect(page.getByText('0:14')).toHaveCount(0)
  await expect(page.getByText('0:38')).toHaveCount(0)
  expect(
    (counterAfterTitle?.y ?? 0) - ((titleAfterStage?.y ?? 0) + (titleAfterStage?.height ?? 0)),
  ).toBeLessThanOrEqual(1)
  const noteAfterCounter = await page.getByTestId('stream-audio-note').boundingBox()
  expect(noteAfterCounter, 'audio note has a box').not.toBeNull()
  expect(
    (noteAfterCounter?.y ?? 0) - ((counterAfterTitle?.y ?? 0) + (counterAfterTitle?.height ?? 0)),
  ).toBeLessThanOrEqual(1)
  const cadenceAfterNote = await page.getByTestId('stream-cadence-bar').boundingBox()
  expect(cadenceAfterNote, 'cadence bar has a box').not.toBeNull()
  expect(
    (cadenceAfterNote?.y ?? 0) - ((noteAfterCounter?.y ?? 0) + (noteAfterCounter?.height ?? 0)),
  ).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('stream-focused')).toHaveCSS('padding-left', '20px')
  await expect(page.getByTestId('stream-focused')).toHaveCSS('gap', '0px')
  const focusedHeaderBox = await page.getByTestId('stream-focused-header').boundingBox()
  const stageWrapBox = await page.getByTestId('stream-stage-wrap').boundingBox()
  expect(focusedHeaderBox, 'focused header has a box').not.toBeNull()
  expect(stageWrapBox, 'stage wrap has a box').not.toBeNull()
  expect(
    (stageWrapBox?.y ?? 0) - ((focusedHeaderBox?.y ?? 0) + (focusedHeaderBox?.height ?? 0)),
  ).toBeLessThanOrEqual(1)
  const focusedHeader = page.getByTestId('stream-focused-header')
  await expect(focusedHeader).toHaveCSS('padding-top', '4px')
  await expect(focusedHeader).toHaveCSS('padding-bottom', '4px')
  await expect(page.getByTestId('stream-playlist-kicker')).toHaveCSS('padding-left', '8px')
  await expect(page.getByTestId('stream-playlist-kicker')).toHaveCSS('padding-right', '8px')
  await expect(page.getByTestId('stream-drill-drawer')).toHaveCSS('padding-top', '4px')
  await expect(
    page.getByTestId('stream-drill-title').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('letter-spacing', '0.55px')
  await expect(
    page.getByTestId('stream-drill-title').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('text-transform', 'uppercase')
  await expect(page.getByText('IPA:')).toHaveCount(0)
  await expect(page.getByText('0.75x')).toHaveCount(0)
  const stage = await page.getByTestId('stream-stage').boundingBox()
  expect(Math.round(stage?.width ?? 0)).toBe(280)
  expect(Math.round(stage?.height ?? 0)).toBe(280)
  await expect(page.getByTestId('stream-stage')).toHaveCSS('border-radius', '24px')
  const stageShadow = await page
    .getByTestId('stream-stage')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(stageShadow).toContain('35, 30, 24')
  expect(stageShadow).toContain('0.1')
  const titleSize = await page.getByTestId('stream-phrase-title').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(titleSize).toBe('23.2px')
  const stageMeaning = await page.getByTestId('stream-stage-meaning').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, line: style.lineHeight }
  })
  expect(stageMeaning.size).toBe('12px')
  expect(stageMeaning.line).toBe('16px')
  expect(Math.round((await page.getByTestId('stream-dismiss').boundingBox())?.width ?? 0)).toBe(36)
  expect(Math.round((await page.getByTestId('stream-dismiss').boundingBox())?.height ?? 0)).toBe(36)
  const dismissFace = await page.getByTestId('stream-dismiss-face').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(dismissFace).toBe('24px')
  expect(Math.round((await page.getByTestId('stream-track-options').boundingBox())?.width ?? 0)).toBe(
    36,
  )
  expect(Math.round((await page.getByTestId('stream-track-options').boundingBox())?.height ?? 0)).toBe(
    36,
  )
  const trackOptionsFace = await page.getByTestId('stream-options-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(trackOptionsFace).toBe('20px')
  await expect(page.getByTestId('stream-options-mark')).toHaveText('⋮')
  await expect(page.getByTestId('stream-dismiss')).toHaveCSS('margin-left', '-8px')
  await expect(page.getByTestId('stream-track-options')).toHaveCSS('margin-right', '-8px')
  await expect(page.getByRole('button', { name: 'Track options' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shuffle drills' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show grammar note' })).toBeVisible()
  await expect(page.getByTestId('stream-stage-mark-mnemonic')).toHaveText('💡')
  await expect(page.getByTestId('stream-stage-mark-grammar')).toHaveText('📖')
  await expect(page.getByTestId('stream-stage-mark-phonetics')).toHaveText('🗣️')
  const idleMnemonic = page
    .getByTestId('stream-stage-mark-mnemonic')
    .locator('[style*="letter-spacing"]')
    .first()
  const idleGrammar = page
    .getByTestId('stream-stage-mark-grammar')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(idleMnemonic).toHaveCSS('font-weight', '600')
  await expect(idleGrammar).toHaveCSS('font-weight', '600')
  await expect(idleMnemonic).toHaveCSS('font-size', '11px')
  await page.getByRole('button', { name: 'Show grammar note' }).click()
  await expect(idleGrammar).toHaveCSS('font-weight', '700')
  await expect(idleMnemonic).toHaveCSS('font-weight', '600')
  await expect(page.getByTestId('stream-stage-panel')).toBeVisible()
  const selectedPillShadow = await page
    .getByTestId('stream-stage-pill')
    .nth(1)
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(selectedPillShadow).toContain('255, 219, 208')
  expect(selectedPillShadow).toContain('0.4')
  expect(selectedPillShadow).toContain('0px 0px 0px 2px')
  expect(selectedPillShadow).toContain('35, 30, 24')
  await expect(page.getByText('Castilian Pragmatics')).toHaveCount(0)
  await expect(page.getByText('96% Recall')).toHaveCount(0)
  await expect(page.getByText('1.25×')).toHaveCount(0)
  await page.getByRole('button', { name: 'Track options' }).click()
  const optionsSheet = page.getByTestId('stream-options-sheet')
  await expect(optionsSheet).toBeVisible()
  await expect(optionsSheet.getByRole('button', { name: 'Love this phrase' })).toBeVisible()
  await expect(optionsSheet.getByRole('button', { name: 'Mark learned' })).toBeVisible()
  await expect(optionsSheet.getByText("How's this phrase?")).toHaveCount(0)
  await expect(optionsSheet.getByRole('radio', { name: 'Easy' })).toBeVisible()
  await expect(optionsSheet.getByRole('radio', { name: 'Learning' })).toBeVisible()
  await expect(optionsSheet.getByRole('radio', { name: 'Difficult' })).toBeVisible()
  await expect(page.getByText('1.25×')).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss options', exact: true }).click()
  await expect(optionsSheet).toHaveCount(0)
  expect(Math.round((await page.getByTestId('stream-play').boundingBox())?.width ?? 0)).toBe(58)
  expect(Math.round((await page.getByTestId('stream-play').boundingBox())?.height ?? 0)).toBe(58)
  const playGlow = await page
    .getByTestId('stream-play')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(playGlow).toContain('191, 84, 44')
  expect(playGlow).toContain('0.35')
  const capsuleShadow = await page
    .getByTestId('stream-rating-capsule')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(capsuleShadow).toContain('35, 30, 24')
  expect(capsuleShadow).toContain('0.05')
  const rateShadow = await page
    .getByTestId('stream-rate-pill-selected')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(rateShadow).toContain('35, 30, 24')
  expect(rateShadow).toContain('0.05')
  expect(rateShadow).toContain('255, 219, 208')
  expect(rateShadow).toContain('0px 0px 0px 2px')
  await expect(page.getByText('1.25×')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Playback speed 0.92' })).toHaveCSS(
    'padding-left',
    '12px',
  )
  await expect(page.getByRole('button', { name: 'Playback speed 0.8' })).toHaveCSS(
    'padding-left',
    '10px',
  )
  await expect(page.getByTestId('stream-rate-row')).toHaveCSS('padding-top', '2px')
  await expect(page.getByTestId('stream-rate-row')).toHaveCSS('padding-bottom', '2px')
  const cadenceBar = page.getByTestId('stream-cadence-bar')
  await expect(cadenceBar).toHaveCSS('margin-top', '0px')
  await expect(cadenceBar).toHaveCSS('padding-top', '2px')
  await expect(cadenceBar).toHaveCSS('padding-bottom', '2px')
  const loopMark = await page.getByTestId('stream-loop-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(loopMark).toBe('22px')
  await expect(page.getByTestId('stream-loop-mark')).toHaveText('↻')
  const loopFace = page.getByTestId('stream-loop-face')
  const loopMetrics = await loopFace.evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, line: style.lineHeight }
  })
  expect(loopMetrics.size).toBe('8.5px')
  expect(loopMetrics.line).toBe('10.625px')
  await expect(loopFace).toHaveCSS('position', 'absolute')
  await expect(loopFace).toHaveCSS('top', '4px')
  await expect(loopFace).toHaveCSS('right', '2px')
  await expect(loopFace).toHaveCSS('padding-left', '4px')
  await expect(loopFace).toHaveCSS('padding-right', '4px')
  const ratingWrap = page.getByTestId('stream-rating-wrap')
  await expect(ratingWrap).toHaveCSS('padding-top', '4px')
  await expect(ratingWrap).toHaveCSS('padding-bottom', '2px')
  const playBox = await page.getByTestId('stream-play').boundingBox()
  const wrapBox = await ratingWrap.boundingBox()
  expect(playBox, 'play has a box').not.toBeNull()
  expect(wrapBox, 'rating wrap has a box').not.toBeNull()
  expect((wrapBox?.y ?? 0) - ((playBox?.y ?? 0) + (playBox?.height ?? 0))).toBeLessThanOrEqual(4)
  const capsuleBox = await page.getByTestId('stream-rating-capsule').boundingBox()
  const rateRowBox = await page.getByTestId('stream-rate-row').boundingBox()
  expect(capsuleBox, 'rating capsule has a box').not.toBeNull()
  expect(rateRowBox, 'rate row has a box').not.toBeNull()
  expect((rateRowBox?.y ?? 0) - ((capsuleBox?.y ?? 0) + (capsuleBox?.height ?? 0))).toBeLessThanOrEqual(
    4,
  )
  const rateFaceWeight = (name: string) =>
    page.getByRole('button', { name }).evaluate((node) => {
      const nodes = [node, ...Array.from(node.querySelectorAll('*'))]
      for (const el of nodes) {
        const weight = getComputedStyle(el).fontWeight
        if (weight === '700' || weight === '500') return weight
      }
      return getComputedStyle(node).fontWeight
    })
  expect(await rateFaceWeight('Playback speed 0.92')).toBe('700')
  expect(await rateFaceWeight('Playback speed 0.8')).toBe('500')
  expect(
    Math.round((await page.getByTestId('stream-transport').first().boundingBox())?.width ?? 0),
  ).toBe(40)
  const transportFace = await page.getByTestId('stream-transport-face').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(transportFace).toBe('30px')
  expect(Math.round((await page.getByTestId('stream-love').boundingBox())?.width ?? 0)).toBe(36)
  const loveFace = await page.getByTestId('stream-love-face').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(loveFace).toBe('20px')
  const titleRow = page.getByTestId('stream-title-row')
  await expect(titleRow).toHaveCSS('padding-top', '4px')
  await expect(titleRow).toHaveCSS('padding-bottom', '4px')
  await expect(page.getByTestId('stream-title-copy')).toHaveCSS('padding-right', '8px')
  const themeFace = page.getByTestId('stream-theme').locator('[style*="font-size"]').first()
  await expect(themeFace).toHaveCSS('font-size', '12px')
  await expect(themeFace).toHaveCSS('font-weight', '600')
  await expect(themeFace).toHaveCSS('letter-spacing', 'normal')
  await expect(page.getByText('Clara')).toHaveCount(0)
  await expect(page.getByText('Sara Martín')).toHaveCount(0)
  const titleCopyBox = await page.getByTestId('stream-title-copy').boundingBox()
  const loveBox = await page.getByTestId('stream-love').boundingBox()
  expect(titleCopyBox, 'title copy has a box').not.toBeNull()
  expect(loveBox, 'love has a box').not.toBeNull()
  expect((loveBox?.x ?? 0) - ((titleCopyBox?.x ?? 0) + (titleCopyBox?.width ?? 0))).toBeLessThanOrEqual(
    1,
  )

  await expect(page.getByTestId('stream-rating-wrap').getByText("How's this phrase?")).toHaveCount(0)
  const capsule = page.getByTestId('stream-rating-capsule')
  await expect(capsule.getByRole('radio', { name: 'Easy' })).toBeVisible()
  await expect(capsule.getByRole('radio', { name: 'Learning' })).toBeVisible()
  await expect(capsule.getByRole('radio', { name: 'Difficult' })).toBeVisible()
  const capsuleHit = await capsule.boundingBox()
  const rate = await page.getByRole('button', { name: 'Playback speed 0.92' }).boundingBox()
  expect(capsuleHit, 'rating capsule has a box').not.toBeNull()
  expect(rate, '0.92 rate pill has a box').not.toBeNull()
  expect((capsuleHit?.y ?? 0) + (capsuleHit?.height ?? 0)).toBeLessThan(844)
  expect((rate?.y ?? 0) + (rate?.height ?? 0)).toBeLessThan(844)
  await revealPhonetics(page)
  const stagePill = page.getByTestId('stream-stage-pill').first()
  if ((await stagePill.count()) > 0) {
    const stagePillShadow = await stagePill.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(stagePillShadow).toContain('35, 30, 24')
    expect(stagePillShadow).toContain('0.1')
  }
  const stagePanel = page.getByTestId('stream-stage-panel')
  await expect(stagePanel).toBeVisible()
  await expect(stagePanel).toHaveCSS('border-radius', '16px')
  const stagePanelShadow = await stagePanel.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(stagePanelShadow).toContain('35, 30, 24')
  expect(stagePanelShadow).toContain('0.25')
  await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
  await expect(page.getByText(/Audio is not available yet/)).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)

  await page.getByRole('radio', { name: 'Difficult' }).click()
  await expect(page.getByRole('alert')).toContainText('repeats more, comes back sooner')
  await page.getByRole('button', { name: 'Love this phrase' }).click()
  await expect(page.getByRole('button', { name: 'Remove from loved' })).toBeVisible()

  await expect(page.getByText('1 / 10')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Loop this phrase 1 time' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Playback speed 0.8' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Playback speed 0.92' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Playback speed 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Loop this phrase 1 time' }).click()
  await expect(page.getByRole('button', { name: 'Loop this phrase 2 times' })).toBeVisible()
  await page.getByRole('button', { name: 'Loop this phrase 2 times' }).click()
  await expect(page.getByText('3×', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Playback speed 1' }).click()
  await expect(page.getByText('1.0×', { exact: true })).toBeVisible()
  await expect(page.getByText('Phrase actions')).toBeVisible()
  await page.getByRole('button', { name: 'Hide actions' }).click()
  await expect(page.getByRole('button', { name: 'Show actions' })).toBeVisible()
  await page.getByRole('button', { name: 'Show actions' }).click()
  await expect(page.getByRole('button', { name: 'Hide actions' })).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss player', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open now playing', exact: true })).toBeVisible()
  await expect(page.getByTestId('stream-done')).toBeVisible()
  const jumpPhrase = (await page.getByTestId('stream-queue-phrase').first().innerText()).trim()
  await page.getByRole('button', { name: 'Options', exact: true }).first().click()
  await expect(page.getByTestId('stream-options-sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Love this phrase' }).click()
  await expect(page.getByRole('button', { name: 'Remove from loved' })).toBeVisible()
  await page.getByRole('button', { name: `Play ${jumpPhrase} in the queue` }).click()
  await expect(page.getByTestId('stream-editorial-title')).toHaveText(jumpPhrase)
  await expect(page.getByTestId('stream-options-sheet')).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous' }).click()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText(/Previously Played/)).toBeVisible()
  const earlierPhrase = await page.getByTestId('stream-earlier-phrase').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, line: style.lineHeight }
  })
  expect(earlierPhrase.size).toBe('13px')
  expect(earlierPhrase.line).toBe('17.875px')
  const earlierMeaning = await page.getByTestId('stream-earlier-meaning').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(earlierMeaning).toBe('11px')
  await expect(page.getByTestId('stream-earlier-meaning').first()).toHaveCSS('margin-top', '0px')
  await expect(page.getByText('Mastered')).toHaveCount(0)
  await expect(page.getByText('0:42 ago')).toHaveCount(0)
  await expect(page.getByTestId('stream-earlier-kicker')).toHaveCSS('padding-left', '2px')
  await expect(page.getByTestId('stream-earlier-kicker')).toHaveCSS('padding-right', '2px')
  await expect(
    page.getByTestId('stream-earlier-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('letter-spacing', '0.55px')
  await expect(
    page.getByTestId('stream-earlier-kicker').locator('[style*="letter-spacing"]').first(),
  ).toHaveCSS('text-transform', 'uppercase')
  const earlierRow = page.getByTestId('stream-earlier-row').first()
  await expect(earlierRow).toHaveCSS('opacity', '1')
  await expect(earlierRow).toHaveCSS('padding-top', '10px')
  await expect(earlierRow).toHaveCSS('padding-left', '12px')
  await expect(earlierRow).toHaveCSS('border-radius', '16px')
  const earlierToggle = await page.getByTestId('stream-earlier-toggle').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return {
      size: style.fontSize,
      weight: style.fontWeight,
      track: style.letterSpacing,
      transform: style.textTransform,
    }
  })
  expect(earlierToggle.size).toBe('10px')
  expect(earlierToggle.weight).toBe('600')
  expect(earlierToggle.track).toBe('0.5px')
  expect(earlierToggle.transform).toBe('none')
  await expect(page.getByTestId('stream-earlier-mark').first()).toHaveCSS('border-radius', '12px')
  await expect(page.getByTestId('stream-earlier-mark').first()).toHaveCSS('width', '32px')
  await expect(page.getByTestId('stream-earlier-mark').first()).toHaveCSS('height', '32px')
  const editorialHeard = await page.getByTestId('stream-earlier-mark').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialHeard).toBe('16px')
  await expect(page.getByTestId('stream-earlier-replay')).toHaveCount(0)
  await page.getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hide', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await openNowPlaying(page)
  await expect(page.getByText('1 / 10')).toBeVisible()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText('2 / 10')).toBeVisible()

  await page.getByRole('button', { name: 'Mark learned' }).click()
  await page.getByRole('button', { name: 'Dismiss player', exact: true }).click()
  await expect(page.getByText('Learned 1')).toHaveCount(0)
  await expect(page.getByText(/^Up Next \(/)).toBeVisible()
})

test('simple-queue dressing mounts off the editorial landing', async ({ page }) => {
  await onboard(page)
  mockTtsStatus(page, true)
  await page.getByRole('button', { name: 'Stream' }).click()
  await expect(page.getByTestId('stream-editorial-hero')).toBeVisible()
  await expect(page.getByTestId('stream-simple-play')).toHaveCount(0)
  await openSimpleQueue(page)
  await expect(page.getByTestId('stream-landing')).toHaveCSS('gap', '16px')
  await expect(page.getByTestId('stream-landing')).toHaveCSS('padding-top', '12px')
  await expect(page.getByTestId('stream-landing')).toHaveCSS('padding-bottom', '80px')
  await expect(page.getByTestId('stream-queue-chrome')).toBeVisible()
  await expect(page.getByTestId('stream-landing').getByTestId('stream-queue-chrome')).toHaveCount(0)
  await expect(page.getByText('Spanish · 10 phrases', { exact: true })).toBeVisible()
  await expect(page.getByText('Vol. 03')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-chrome').locator('..')).toHaveCSS(
    'padding-bottom',
    '8px',
  )
  await expect(page.getByTestId('stream-now-kicker')).toHaveCSS('padding-left', '2px')
  const simplePulse = await page.getByTestId('stream-now-pulse').boundingBox()
  expect(Math.round(simplePulse?.width ?? 0)).toBe(6)
  expect(Math.round(simplePulse?.height ?? 0)).toBe(6)
  await expect(page.getByTestId('stream-now-pulse-row')).toHaveCSS('gap', '4px')
  await expect(page.getByTestId('stream-upnext-kicker')).toHaveCSS('padding-left', '2px')
  await expect(page.getByTestId('stream-upnext-stack')).toHaveCSS('gap', '6px')
  const simpleDone = page.getByRole('button', { name: 'Done', exact: true })
  await expect(simpleDone).toBeVisible()
  expect(await landingHeaderGutter(page)).toBe('16px')
  await expect(simpleDone).toHaveCSS('padding-top', '4px')
  await expect(simpleDone).toHaveCSS('padding-left', '12px')
  const simpleDoneWeight = await simpleDone.evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontWeight
  })
  expect(simpleDoneWeight).toBe('700')
  const hero = page.getByTestId('stream-simple-hero')
  await expect(hero).toHaveCSS('border-radius', '16px')
  const heroFace = hero.locator(':scope > *').first()
  await expect(heroFace).toHaveCSS('padding-top', '12px')
  await expect(heroFace).toHaveCSS('padding-left', '12px')
  const simpleRule = page.getByTestId('stream-hero-rule')
  await expect(simpleRule).toHaveCSS('margin-top', '12px')
  await expect(simpleRule).toHaveCSS('padding-top', '10px')
  await expect(page.getByTestId('stream-editorial-cover')).toHaveCSS('border-radius', '12px')
  const simpleTitle = await page.getByTestId('stream-editorial-title').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(simpleTitle).toBe('17.6px')
  await expect(page.getByTestId('stream-editorial-copy')).toHaveCSS('padding-right', '4px')
  await expect(page.getByTestId('stream-editorial-meaning')).toHaveCSS('margin-top', '2px')
  await expect(page.getByTestId('stream-editorial-resp')).toHaveCSS('margin-top', '4px')
  const play = await page.getByTestId('stream-simple-play').boundingBox()
  expect(Math.round(play?.width ?? 0)).toBe(28)
  expect(Math.round(play?.height ?? 0)).toBe(28)
  const simpleTri = page.getByTestId('stream-simple-play').getByTestId('stream-play-mark')
  await expect(simpleTri).toBeVisible()
  await expect(simpleTri).toHaveCSS('border-left-width', '16px')
  await expect(simpleTri).toHaveCSS('border-top-width', '8px')
  await expect(simpleTri).not.toHaveAttribute('role', 'button')
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await page.getByTestId('stream-simple-play').getByRole('button', { name: 'Play phrase', exact: true }).click()
  const simplePause = page.getByTestId('stream-simple-play').getByTestId('stream-pause-mark')
  await expect(simplePause).toBeVisible()
  await expect(simplePause.locator('div').first()).toHaveCSS('width', '3px')
  await expect(simplePause.locator('div').first()).toHaveCSS('height', '16px')
  await page.getByTestId('stream-simple-play').getByRole('button', { name: 'Stop audio', exact: true }).click()
  await expect(simpleTri).toBeVisible()
  await expect(page.getByTestId('stream-editorial-loop-mark')).toHaveCount(0)
  await expect(page.getByTestId('stream-simple-loop-row')).toBeVisible()
  const simpleSkip = await page.getByTestId('stream-compact-skip-face').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(simpleSkip).toBe('18px')
  await expect(page.getByTestId('stream-hero-transport')).toHaveCSS('gap', '12px')
  await expect(page.getByTestId('stream-hero-transport')).toHaveCSS('margin-top', '0px')
  const playShadow = await page
    .getByTestId('stream-simple-play')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(playShadow).toContain('35, 30, 24')
  expect(playShadow).toContain('0.05')
  expect(playShadow).not.toContain('0.1')
  const heroShadow = await hero.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(heroShadow).toContain('35, 30, 24')
  expect(heroShadow).toContain('0.1')
  await expect(page.getByText('Drag to reorder')).toHaveCount(0)
  await expect(page.getByText('0:14')).toHaveCount(0)
  await expect(page.getByText('0:38')).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByTestId('stream-queue-footer')).toBeVisible()
  await expect(page.getByTestId('stream-queue-footer')).toHaveCSS('padding-left', '16px')
  await expect(page.getByTestId('stream-queue-footer')).toHaveCSS('padding-top', '8px')
  await expect(page.getByTestId('stream-queue-footer')).toHaveCSS('padding-bottom', '0px')
  const footer = page.getByTestId('stream-simple-footer')
  await expect(footer).toBeVisible()
  const heroPhrase = (await page.getByTestId('stream-editorial-title').innerText()).trim()
  await expect(footer).toContainText(heroPhrase)
  const footerPlayBtn = page.getByTestId('stream-simple-footer-play')
  await expect(footerPlayBtn).toBeVisible()
  const footerPlay = await footerPlayBtn.boundingBox()
  expect(Math.round(footerPlay?.width ?? 0)).toBe(28)
  expect(Math.round(footerPlay?.height ?? 0)).toBe(28)
  const footerTri = page.getByTestId('stream-simple-footer-play').getByTestId('stream-play-mark')
  await expect(footerTri).toHaveCSS('border-left-width', '16px')
  await expect(footerTri).toHaveCSS('border-top-width', '8px')
  const footerPlayShadow = await page
    .getByTestId('stream-simple-footer-play')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(footerPlayShadow).toContain('35, 30, 24')
  expect(footerPlayShadow).toContain('0.05')
  expect(footerPlayShadow).not.toContain('0.1')
  const trail = page.getByTestId('stream-queue-trail').first()
  await expect(trail).toBeVisible()
  const simpleQueueRow = page.getByTestId('stream-queue-row').first()
  await expect(simpleQueueRow).toHaveCSS('padding-top', '10px')
  await expect(simpleQueueRow).toHaveCSS('padding-left', '10px')
  await expect(simpleQueueRow).toHaveCSS('border-radius', '12px')
  await expect(page.getByTestId('stream-queue-phrase-row').first().getByTestId('stream-queue-theme')).toBeVisible()
  await expect(page.getByTestId('stream-queue-theme').first()).toBeVisible()
  await expect(page.getByTestId('stream-queue-difficulty').first()).toHaveCSS('padding-left', '6px')
  const chipFace = await page.getByTestId('stream-queue-difficulty').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, weight: style.fontWeight, transform: style.textTransform }
  })
  expect(chipFace.size).toBe('9px')
  expect(chipFace.weight).toBe('700')
  expect(chipFace.transform).toBe('none')
  await expect(page.getByTestId('stream-queue-meaning').first()).toHaveCSS('margin-top', '2px')
  const simpleQueueMeaning = await page.getByTestId('stream-queue-meaning').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(simpleQueueMeaning).toBe('11px')
  await expect(page.getByText('0:48')).toHaveCount(0)
  await expect(page.getByText('1:12')).toHaveCount(0)
  await expect(page.getByText('Iambic')).toHaveCount(0)
  await expect(page.getByText('Mastered')).toHaveCount(0)
  await expect(page.getByText('Due in 10m')).toHaveCount(0)
  const simpleOptions = page.getByTestId('stream-options').first()
  await expect(simpleOptions).toBeVisible()
  expect(Math.round((await simpleOptions.boundingBox())?.width ?? 0)).toBe(24)
  expect(Math.round((await simpleOptions.boundingBox())?.height ?? 0)).toBe(24)
  const simpleOptionsFace = await simpleOptions
    .getByTestId('stream-options-mark')
    .evaluate((node) => {
      const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
      return getComputedStyle(face).fontSize
    })
  expect(simpleOptionsFace).toBe('16px')
  await expect(simpleOptions.getByTestId('stream-options-mark')).toHaveText('⋯')
  await expect(page.getByTestId('stream-queue-actions').first()).toHaveCSS('gap', '4px')
  await expect(page.getByRole('button', { name: 'Options', exact: true }).first()).toBeVisible()
  const reorder = page.getByTestId('stream-queue-reorder').first()
  await expect(reorder).toBeVisible()
  const reorderBox = await reorder.boundingBox()
  expect(Math.round(reorderBox?.width ?? 0)).toBe(24)
  expect(Math.round(reorderBox?.height ?? 0)).toBe(24)
  await expect(page.getByTestId('stream-queue-reorder-mark').first()).toHaveText('≡')
  const reorderFace = await page.getByTestId('stream-queue-reorder-mark').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(reorderFace).toBe('18px')
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText(/Previously Played/)).toBeVisible()
  const simpleEarlier = page.getByTestId('stream-earlier-row').first()
  await expect(simpleEarlier).toHaveCSS('padding-top', '10px')
  await expect(simpleEarlier).toHaveCSS('padding-left', '10px')
  await expect(simpleEarlier).toHaveCSS('border-radius', '12px')
  await expect(simpleEarlier).toHaveCSS('opacity', '0.75')
  await expect(page.getByTestId('stream-earlier-mark').first()).toHaveCSS('border-radius', '8px')
  const simpleHeard = await page.getByTestId('stream-earlier-mark').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(simpleHeard).toBe('16px')
  const simpleEarlierPhrase = await page.getByTestId('stream-earlier-phrase').first().evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    const style = getComputedStyle(face)
    return { size: style.fontSize, line: style.lineHeight }
  })
  expect(simpleEarlierPhrase.size).toBe('14px')
  expect(simpleEarlierPhrase.line).toBe('20px')
  const simpleEarlierMeaning = await page
    .getByTestId('stream-earlier-meaning')
    .first()
    .evaluate((node) => {
      const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
      return getComputedStyle(face).fontSize
    })
  expect(simpleEarlierMeaning).toBe('11px')
  await expect(page.getByTestId('stream-earlier-meaning').first()).toHaveCSS('margin-top', '0px')
  const replay = page.getByTestId('stream-earlier-replay').first()
  await expect(replay).toBeVisible()
  const replayBox = await replay.boundingBox()
  expect(Math.round(replayBox?.width ?? 0)).toBe(28)
  expect(Math.round(replayBox?.height ?? 0)).toBe(28)
  await expect(page.getByTestId('stream-earlier-replay-mark')).toHaveText('↺')
  const simpleReplayFace = await page.getByTestId('stream-earlier-replay-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(simpleReplayFace).toBe('18px')
  await expect(page.getByText('0:42 ago')).toHaveCount(0)
})

test('simple-queue drag persists a local listen order', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()
  await openSimpleQueue(page)
  await runFor(page, 400)
  const first = page.getByTestId('stream-queue-phrase').first()
  const second = page.getByTestId('stream-queue-phrase').nth(1)
  const beforeFirst = (await first.innerText()).trim()
  const beforeSecond = (await second.innerText()).trim()
  expect(beforeFirst.length).toBeGreaterThan(0)
  expect(beforeSecond.length).toBeGreaterThan(0)
  expect(beforeFirst).not.toBe(beforeSecond)
  const handles = page.getByTestId('stream-queue-reorder')
  await expect(handles.nth(1)).toBeVisible()
  await dragListenReorder(page, 1, 0)
  await expect(first).toHaveText(beforeSecond)
  await expect(second).toHaveText(beforeFirst)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stream' })).toBeVisible()
  await page.getByRole('button', { name: 'Stream' }).click()
  await expect(page.getByTestId('stream-editorial-hero')).toBeVisible()
  await expect(page.getByTestId('stream-queue-reorder')).toHaveCount(0)
  await openSimpleQueue(page)
  await runFor(page, 400)
  await expect(page.getByTestId('stream-queue-phrase').first()).toHaveText(beforeSecond)
  await expect(page.getByTestId('stream-queue-phrase').nth(1)).toHaveText(beforeFirst)
})

test('stream play uses server voice when the TTS status is ready', async ({ page }) => {
  await onboard(page)
  mockTtsStatus(page, true)
  await page.getByRole('button', { name: 'Stream' }).click()
  await openNowPlaying(page)
  await runFor(page, 400)
  await expect(page.getByText('Server voice · generated for this phrase')).toBeVisible()
  const play = page.getByRole('button', { name: 'Play phrase', exact: true })
  await expect(play).toBeEnabled()
  const playBox = await play.boundingBox()
  expect(Math.round(playBox?.width ?? 0)).toBe(58)
  expect(Math.round(playBox?.height ?? 0)).toBe(58)
  const playFill = await play.evaluate((node) => getComputedStyle(node).backgroundColor)
  expect(playFill).toContain('159, 60, 22')
  const playShadow = await page
    .getByTestId('stream-play')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(playShadow).toContain('191, 84, 44')
  expect(playShadow).toContain('0.35')
  await expect(page.getByTestId('stream-play-mark')).toBeVisible()
  await expect(page.getByTestId('stream-play-mark')).toHaveCSS('border-left-width', '30px')
  await expect(page.getByTestId('stream-play-mark')).toHaveCSS('border-top-width', '15px')
  await expect(page.getByTestId('stream-play-mark')).not.toHaveAttribute('role', 'button')
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Shuffle/i })).toHaveCount(0)
  await expect(page.getByTestId('stream-pause-mark')).toHaveCount(0)
  await play.click()
  await expect(page.getByRole('button', { name: 'Stop audio', exact: true })).toBeVisible()
  await expect(page.getByTestId('stream-pause-mark')).toBeVisible()
  await expect(page.getByTestId('stream-play-mark')).toHaveCount(0)
  const pauseBar = page.getByTestId('stream-pause-mark').locator('div').first()
  await expect(pauseBar).toHaveCSS('width', '4px')
  await expect(pauseBar).toHaveCSS('height', '30px')
  await expect(page.getByTestId('stream-pause-mark')).not.toHaveAttribute('role', 'button')
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play phrase', exact: true })).toBeVisible()
  await expect(page.getByTestId('stream-play-mark')).toBeVisible()
  await expect(page.getByTestId('stream-pause-mark')).toHaveCount(0)
  await page.getByRole('button', { name: 'Dismiss player', exact: true }).click()
  const editorialTri = page.getByTestId('stream-editorial-play').getByTestId('stream-play-mark')
  await expect(editorialTri).toBeVisible()
  await expect(editorialTri).toHaveCSS('border-left-width', '20px')
  await expect(editorialTri).toHaveCSS('border-top-width', '10px')
  await expect(editorialTri).not.toHaveAttribute('role', 'button')
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await page.getByTestId('stream-editorial-play').getByRole('button', { name: 'Play phrase', exact: true }).click()
  const editorialPause = page.getByTestId('stream-editorial-play').getByTestId('stream-pause-mark')
  await expect(editorialPause).toBeVisible()
  await expect(editorialPause.locator('div').first()).toHaveCSS('width', '3px')
  await expect(editorialPause.locator('div').first()).toHaveCSS('height', '20px')
  await page.getByRole('button', { name: 'Stop audio', exact: true }).click()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByText(/Previously Played/)).toBeVisible()
  const editorialReplay = page.getByTestId('stream-earlier-replay').first()
  await expect(editorialReplay).toBeVisible()
  const editorialReplayBox = await editorialReplay.boundingBox()
  expect(Math.round(editorialReplayBox?.width ?? 0)).toBe(32)
  expect(Math.round(editorialReplayBox?.height ?? 0)).toBe(32)
  await expect(page.getByTestId('stream-earlier-replay-mark')).toHaveText('↺')
  const editorialReplayFace = await page.getByTestId('stream-earlier-replay-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(editorialReplayFace).toBe('18px')
  await expect(page.getByText('0:42 ago')).toHaveCount(0)
  await expect(page.getByText('Mastered')).toHaveCount(0)
})

test('P3-03: the stream claims no playback it cannot do', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()

  // The 35% bar over silence and the pips stuck at zero are both gone, and this is the
  // assertion that fails if either comes back before plan 62 owns real playback position.
  // The unnamed form of the bar is `aria-hidden`, so it is invisible to a role locator —
  // `render.spec.ts` catches that one by its geometry.
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  // Equalizer means sound is happening. Web stream has no playable audio, so it stays off.
  await expect(page.getByTestId('equalizer')).toHaveCount(0)

  // Nothing wears a play glyph. The centre control is the queue's forward move and says so.
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('stream-play-mark')).toHaveCount(0)
  await expect(page.getByTestId('stream-pause-mark')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Next phrase' })).toBeVisible()
  await page.getByRole('button', { name: 'Next phrase' }).click()
  await expect(page.getByTestId('stream-earlier-replay')).toHaveCount(0)

  await expect(page.getByText(/Audio is not available yet/)).toBeVisible()
})

test('adaptive stream reaches its all-learned empty state', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()
  await openNowPlaying(page)

  for (let remaining = 10; remaining > 0; remaining -= 1) {
    await page.getByRole('button', { name: 'Mark learned' }).click()
  }

  await expect(page.getByText('Your stream is empty')).toBeVisible()
  await expect(page.getByText('Add phrases to build your stream')).toBeVisible()
  await page.getByRole('button', { name: 'Add phrases', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Search phrases' })).toBeVisible()
})

test('manual phrase browsing wraps the queue without recording practice', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: 'Stream' }).click()
  for (let phrase = 0; phrase < 10; phrase += 1) {
    await page.getByRole('button', { name: 'Next phrase' }).click()
  }
  await openNowPlaying(page)
  await expect(page.getByText('1 / 10')).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss player', exact: true }).click()
  await page.getByRole('link', { name: /back/i }).click()
  await expect(page.getByTestId('today-day-list').getByText('0 reps today')).toBeVisible()
})

async function revealPhonetics(page: Parameters<typeof onboard>[0]): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    const phonetics = page.getByRole('button', { name: 'Show phonetics' })
    if ((await phonetics.count()) > 0) {
      await phonetics.click()
      await expect(phonetics).toBeVisible()
      return
    }
    await page.getByRole('button', { name: 'Next phrase' }).click()
  }
  throw new Error('expected a queue phrase with authored phonetics')
}
