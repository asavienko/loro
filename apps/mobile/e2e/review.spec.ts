import type { Page } from '@playwright/test'
import { atInstant, jumpTo } from './clock'
import { expect, onboard, test } from './fixtures'
import { signInThenGoto } from './accountFlow'
import { scheduleTwoReviewPhrases } from './helpers'
import { mockTtsStatus } from './learnerApiFlow'

/** HTML pack-detail h1 `tracking-tight` on headline-sm 20. */
async function expectPackTitle(page: Page) {
  const title = page.getByTestId('review-pack-title')
  await expect(title).toHaveText('Cadence Pack Detail')
  const face = title.locator('[style*="letter-spacing"]').first()
  await expect(face).toHaveCSS('font-size', '20px')
  await expect(face).toHaveCSS('font-weight', '600')
  await expect(face).toHaveCSS('letter-spacing', '-0.5px')
}

test('review fails closed when the course has no phrases', async ({ page }) => {
  await signInThenGoto(page, '/practice/review')
  await expect(page.getByText('No phrases in this course')).toBeVisible()
  const coldBack = await page.getByTestId('review-pack-back').boundingBox()
  expect(Math.round(coldBack?.width ?? 0)).toBe(44)
  expect(Math.round(coldBack?.height ?? 0)).toBe(44)
  expect(Math.round(coldBack?.x ?? 0)).toBe(8)
  await expect(page.getByTestId('review-pack-back')).toHaveCSS('margin-left', '-8px')
  await expect(page.getByTestId('review-pack-back-mark')).toHaveText('‹')
  const backFace = await page.getByTestId('review-pack-back-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(backFace).toBe('24px')
  const headerGutter = await page.getByTestId('review-pack-back').evaluate((node) => {
    let el: HTMLElement | null = node.parentElement
    while (el) {
      const pad = getComputedStyle(el).paddingLeft
      if (pad === '16px' || pad === '20px') return pad
      el = el.parentElement
    }
    return null
  })
  expect(headerGutter).toBe('16px')
  await expectPackTitle(page)
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add phrases', exact: true })).toBeVisible()
  await expect(page.getByText('VOL. 03')).toHaveCount(0)
  await expect(page.getByText('14,890')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Again|Hard|Good|Easy/ })).toHaveCount(0)
})

test('review does not invent a first schedule for unscheduled phrases', async ({ page }) => {
  await onboard(page)
  // More pushes Review, so the 44 pack control is a warm Back — spine dismissTo is cold Today.
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'More', exact: true }).click()
  await expect(page).toHaveURL(/\/more$/)
  await page.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(page).toHaveURL(/\/practice\/review$/)
  const warmBack = await page.getByTestId('review-pack-back').boundingBox()
  expect(Math.round(warmBack?.width ?? 0)).toBe(44)
  expect(Math.round(warmBack?.height ?? 0)).toBe(44)
  await expect(page.getByTestId('review-pack-back').getByRole('link', { name: /back/i })).toBeVisible()
  await expect(page.getByText('Nothing scheduled yet')).toBeVisible()
  await expect(
    page.getByText('this screen will not invent a first schedule'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Again|Hard|Good|Easy/ })).toHaveCount(0)
})

test('review grades a real due phrase through FSRS and omits invented dock numbers', async ({
  page,
}) => {
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  await page.goto('/practice/refrain')
  await scheduleTwoReviewPhrases(page)
  await jumpTo(page, '2027-05-04T10:00')
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Review', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible()
  await expectPackTitle(page)
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS(
    'background-color',
    'rgb(246, 243, 238)',
  )
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS('padding-left', '16px')
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS('padding-top', '16px')
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS('padding-bottom', '24px')
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS('gap', '24px')
  await expect(page.getByTestId('review-pack-inner')).toHaveCSS('gap', '16px')
  await expect(page.getByTestId('review-play-row')).toHaveCSS('padding-top', '4px')
  await expect(page.getByTestId('review-play-cluster')).toHaveCSS('gap', '8px')
  await expect(page.getByTestId('review-love-row')).toHaveCSS('padding-top', '4px')
  await expect(page.getByTestId('review-sleeve')).toHaveCSS('border-radius', '12px')
  const sleeveShadow = await page
    .getByTestId('review-sleeve')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(sleeveShadow).toContain('35, 30, 24')
  expect(sleeveShadow).toContain('0.1')
  const headerShadow = await page
    .getByTestId('stack-header-glass')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(headerShadow).toContain('28, 28, 25')
  expect(headerShadow).toContain('0.04')
  const cardShadow = await page
    .getByTestId('review-card')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(cardShadow).toContain('35, 30, 24')
  expect(cardShadow).toContain('0.1')
  const dockShadow = await page
    .getByTestId('review-dock-capsule')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(dockShadow).toContain('35, 30, 24')
  expect(dockShadow).toContain('0.3')
  const sleeve = await page.getByTestId('review-sleeve').boundingBox()
  expect(Math.round(sleeve?.width ?? 0)).toBe(112)
  expect(Math.round(sleeve?.height ?? 0)).toBe(112)
  const heroTitle = page.getByTestId('review-hero-title').locator('[style*="font-size"]').first()
  await expect(heroTitle).toHaveCSS('font-size', '30px')
  await expect(heroTitle).toHaveCSS('line-height', '36px')
  await expect(heroTitle).toHaveCSS('letter-spacing', '-0.45px')
  await expect(page.getByTestId('review-hero-sub')).toHaveCSS('margin-top', '2px')
  const heroSub = page.getByTestId('review-hero-sub').locator('[style*="font-size"]').first()
  await expect(heroSub).toHaveText('Grade this phrase. The intervals are the real next due dates.')
  await expect(heroSub).toHaveCSS('font-size', '12px')
  await expect(heroSub).toHaveCSS('line-height', '18px')
  const heroStats = page.getByTestId('review-hero-stats').locator('[style*="font-size"]').first()
  await expect(heroStats).toHaveText('2 phrases are due')
  await expect(heroStats).toHaveCSS('font-size', '12px')
  await expect(heroStats).toHaveCSS('line-height', '16px')
  await expect(heroStats).toHaveCSS('letter-spacing', '0.3px')
  await expect(page.getByText('16 Earworms')).toHaveCount(0)
  await expect(page.getByText('14,890 scholars')).toHaveCount(0)
  await expect(page.getByText('Café Culture')).toHaveCount(0)
  const love = await page.getByTestId('review-love').boundingBox()
  expect(Math.round(love?.width ?? 0)).toBe(36)
  expect(Math.round(love?.height ?? 0)).toBe(36)
  const loveFace = page.getByTestId('review-love').getByText('♥')
  await expect(loveFace).toHaveCSS('font-size', '18px')
  const loveShadow = await page
    .getByTestId('review-love')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(loveShadow).toContain('35, 30, 24')
  expect(loveShadow).toContain('0.05')
  const dueBack = await page.getByTestId('review-pack-back').boundingBox()
  expect(Math.round(dueBack?.width ?? 0)).toBe(44)
  expect(Math.round(dueBack?.height ?? 0)).toBe(44)
  expect(Math.round(dueBack?.x ?? 0)).toBe(8)
  await expect(page.getByTestId('review-pack-back')).toHaveCSS('margin-left', '-8px')
  await expect(
    page.getByTestId('review-pack-back').getByRole('button', { name: 'Today', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Recall — think, then reveal')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toBeVisible()
  await expect(page.getByTestId('review-card')).toHaveCSS('padding-top', '16px')
  await expect(page.getByTestId('review-card')).toHaveCSS('padding-left', '16px')
  await expect(page.getByTestId('review-card')).toHaveCSS('gap', '8px')
  const auto = page.getByTestId('review-auto')
  if ((await auto.count()) > 0) {
    await expect(auto).toHaveCSS('margin-top', '4px')
    await expect(auto).toHaveCSS('padding-top', '8px')
    await expect(auto).toHaveCSS('padding-left', '8px')
    await expect(auto).toHaveCSS('gap', '6px')
    await expect(
      page.getByTestId('review-auto-face').locator('[style*="font-weight"]').first(),
    ).toHaveCSS('font-weight', '700')
  }
  await expect(page.getByTestId('review-card')).toHaveCSS('border-radius', '16px')
  await expect(page.getByTestId('review-card')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  )
  const receded = page.getByTestId('review-receded-card')
  await expect(receded).toHaveCount(1)
  const recededShadow = await receded.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(recededShadow).toContain('35, 30, 24')
  expect(recededShadow).toContain('0.05')
  expect(recededShadow).not.toContain('0.1')
  await expect(receded).toHaveCSS('padding-top', '16px')
  await expect(receded).toHaveCSS('margin-top', '8px')
  await expect(receded).toHaveCSS('gap', '8px')
  await expect(receded).toHaveCSS('border-radius', '16px')
  const recededPhrase = page
    .getByTestId('review-receded-phrase')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(recededPhrase).toHaveCSS('font-size', '20px')
  await expect(recededPhrase).toHaveCSS('letter-spacing', 'normal')
  const recededIndex = page
    .getByTestId('review-receded-index')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(recededIndex).toHaveCSS('font-size', '12px')
  await expect(recededIndex).toHaveCSS('letter-spacing', '0.3px')
  await expect(page.getByTestId('review-receded-hear')).toHaveCount(0)
  await expect(page.getByTestId('review-receded-reveal')).toHaveCount(0)
  await expect
    .poll(async () => {
      await receded.evaluate((node) => {
        const dock = document.querySelector('[data-testid="review-dock"]')
        if (!(dock instanceof HTMLElement)) return
        let scroller: HTMLElement | null = node.parentElement
        while (scroller !== null) {
          if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) break
          scroller = scroller.parentElement
        }
        if (scroller === null) return
        const overflow = node.getBoundingClientRect().bottom - dock.getBoundingClientRect().top
        if (overflow > 0) scroller.scrollTop += overflow
      })
      const recededBox = await receded.boundingBox()
      const dockBox = await page.getByTestId('review-dock').boundingBox()
      if (recededBox === null || dockBox === null) return false
      return recededBox.y + recededBox.height <= dockBox.y
    })
    .toBeTruthy()
  await expect(page.getByTestId('review-copy')).toHaveCSS('gap', '0px')
  await expect(page.getByTestId('review-tags')).toHaveCSS('margin-bottom', '4px')
  const dueChip = page.getByTestId('review-due-chip').locator('[style*="font-weight"]').first()
  await expect(dueChip).toHaveText('Due now')
  await expect(dueChip).toHaveCSS('font-weight', '600')
  const packBadge = page.getByTestId('review-pack-badge').locator('[style*="font-weight"]').first()
  await expect(packBadge).toHaveCSS('font-weight', '700')
  const themeChip = page.getByTestId('review-theme-chip').locator('[style*="font-weight"]').first()
  await expect(themeChip).toHaveCSS('font-weight', '700')
  const difficultyChip = page
    .getByTestId('review-difficulty-chip')
    .locator('[style*="font-weight"]')
    .first()
  await expect(difficultyChip).toHaveCSS('font-weight', '700')
  const recededTheme = page
    .getByTestId('review-receded-theme')
    .locator('[style*="font-weight"]')
    .first()
  await expect(recededTheme).toHaveCSS('font-weight', '700')
  const meaning = page.getByTestId('review-meaning').locator('[style*="font-size"]').first()
  await expect(meaning).toHaveCSS('font-size', '12px')
  await expect(meaning).toHaveCSS('line-height', '18px')
  await expect(meaning).toHaveCSS('font-style', 'italic')
  await expect(meaning).toHaveCSS('margin-top', '2px')
  const resp = page.getByTestId('review-resp')
  if ((await resp.count()) > 0) {
    await expect(resp).toHaveCSS('margin-top', '2px')
  }
  const index = await page.getByTestId('review-index').boundingBox()
  expect(Math.round(index?.width ?? 0)).toBe(28)
  expect(Math.round(index?.height ?? 0)).toBe(28)
  const reveal = await page.getByTestId('review-reveal').boundingBox()
  expect(Math.round(reveal?.width ?? 0)).toBe(32)
  expect(Math.round(reveal?.height ?? 0)).toBe(32)
  const revealFace = await page.getByTestId('review-reveal-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(revealFace).toBe('20px')
  await expect(page.getByTestId('review-reveal-mark')).toHaveText('▾')
  await expect(page.getByText('Cadence Deck', { exact: true })).toBeVisible()
  await expect(page.getByText('Due set', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Acoustic Drills', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Sort by Meter', { exact: true })).toHaveCount(0)
  const deckTitle = page.getByTestId('review-deck-title').locator('[style*="font-size"]').first()
  const deckBadge = page.getByTestId('review-deck-badge').locator('[style*="font-weight"]').first()
  await expect(deckBadge).toHaveText('Due now')
  await expect(deckBadge).toHaveCSS('font-weight', '700')
  const syllables = page.getByTestId('review-syllables')
  if ((await syllables.count()) > 0) {
    await expect(syllables.locator('[style*="font-weight"]').first()).toHaveCSS(
      'font-weight',
      '700',
    )
  }
  await expect(deckTitle).toHaveCSS('font-size', '24px')
  await expect(deckTitle).toHaveCSS('line-height', '32px')
  await expect(page.getByTestId('review-tracklist')).toHaveCSS('padding-top', '16px')
  await expect(page.getByTestId('review-tracklist')).toHaveCSS('padding-bottom', '16px')
  await expect(page.getByTestId('review-deck-head')).toHaveCSS('padding-top', '0px')
  await expect(page.getByTestId('review-deck-head')).toHaveCSS('padding-bottom', '16px')
  await expect(page.getByTestId('review-pack-hero')).toHaveCSS('padding-bottom', '24px')
  await expect(page.getByText('Now Repeating', { exact: true })).toBeVisible()
  const miniKicker = page.getByTestId('review-mini-kicker').locator('[style*="font-weight"]').first()
  await expect(miniKicker).toHaveCSS('font-weight', '700')
  const modeFace = page.getByTestId('review-mode').locator('[style*="font-size"]').first()
  await expect(modeFace).toHaveText('Spaced Interval')
  await expect(modeFace).toHaveCSS('font-size', '12px')
  await expect(modeFace).toHaveCSS('line-height', '16px')
  await expect(modeFace).toHaveCSS('letter-spacing', '0.3px')
  await expect(modeFace).toHaveCSS('text-transform', 'none')
  await expect(page.getByText('1.25x')).toHaveCount(0)
  const phrase = page.getByTestId('review-phrase').locator('[style*="font-size"]').first()
  await expect(phrase).toHaveCSS('font-size', '20px')
  await expect(phrase).toHaveCSS('line-height', '28px')
  await expect(phrase).toHaveCSS('letter-spacing', '-0.5px')
  await expect(page.getByRole('button', { name: 'Play cadence deck', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Again/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Hard/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Easy/ })).toBeVisible()
  const good = await page.getByRole('button', { name: /^Good/ }).boundingBox()
  expect(Math.round(good?.height ?? 0)).toBeGreaterThanOrEqual(44)
  const dockBox = await page.getByTestId('review-dock').boundingBox()
  const viewport = page.viewportSize()
  expect(Math.round(dockBox?.x ?? 0)).toBe(12)
  expect(
    Math.round((viewport?.width ?? 0) - ((dockBox?.x ?? 0) + (dockBox?.width ?? 0))),
  ).toBe(12)
  await expect(page.getByTestId('review-dock-capsule')).toHaveCSS('padding-left', '6px')
  await expect(page.getByTestId('review-dock-capsule')).toHaveCSS('padding-top', '4px')
  await expect(page.getByTestId('review-dock-capsule')).toHaveCSS('border-radius', '999px')
  await expect(page.getByTestId('review-grade-row')).toHaveCSS('gap', '6px')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('gap', '6px')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('padding-top', '0px')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('padding-left', '14px')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('flex-direction', 'row')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('justify-content', 'center')
  await expect(page.getByRole('button', { name: /^Good/ })).toHaveCSS('align-items', 'center')
  const gradeFace = page.getByRole('button', { name: /^Good/ }).locator('[style*="font-size"]').first()
  await expect(gradeFace).toHaveCSS('font-size', '12px')
  await expect(gradeFace).toHaveCSS('line-height', '16px')
  await expect(gradeFace).toHaveCSS('letter-spacing', '0.3px')
  await expect(gradeFace).toHaveCSS('font-weight', '600')
  await expect(gradeFace).toHaveCSS('text-transform', 'none')
  await expect(page.getByTestId('review-mini')).toHaveCSS('padding-top', '10px')
  await expect(page.getByTestId('review-mini')).toHaveCSS('padding-left', '10px')
  await expect(page.getByTestId('review-mini')).toHaveCSS('border-radius', '16px')
  await expect(page.getByTestId('review-mini')).toHaveCSS('gap', '0px')
  const miniShadow = await page
    .getByTestId('review-mini')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(miniShadow).toContain('35, 30, 24')
  expect(miniShadow).toContain('0.25')
  const gradeShadow = await page
    .getByRole('button', { name: /^Again/ })
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(gradeShadow).toContain('35, 30, 24')
  expect(gradeShadow).toContain('0.05')
  const thumb = await page.getByTestId('review-mini-thumb').boundingBox()
  expect(Math.round(thumb?.width ?? 0)).toBe(44)
  expect(Math.round(thumb?.height ?? 0)).toBe(44)
  await expect(page.getByTestId('review-mini-thumb')).toHaveCSS('border-radius', '8px')
  await expect(page.getByTestId('review-mini-copy')).toHaveCSS('gap', '0px')
  await expect(page.getByTestId('review-mini-lead')).toHaveCSS('gap', '8px')
  const miniPlay = page.getByTestId('review-mini-play')
  if ((await miniPlay.count()) > 0) {
    await expect(miniPlay).toHaveCSS('margin-left', '8px')
  }
  await expect(page.getByText('VOL. 03')).toHaveCount(0)
  await expect(page.getByText('14,890')).toHaveCount(0)
  await expect(page.getByText('18.4 MB')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Grammar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Phonetics', exact: true })).toHaveCount(0)
  await expect(page.getByText('IPA:')).toHaveCount(0)
  await expect(page.getByText('94%')).toHaveCount(0)
  await expect(page.getByText('Rank V')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Show answer', exact: true })).toHaveCount(0)
  const notes = page.getByTestId('review-notes')
  await expect(notes).toBeVisible()
  await expect(notes).toHaveCSS('border-radius', '12px')
  const tabs = page.getByTestId('review-notes-tabs')
  await expect(tabs).toHaveCSS('padding-top', '6px')
  await expect(tabs).toHaveCSS('padding-left', '8px')
  const pane = page.getByTestId('review-notes-pane')
  await expect(pane).toHaveCSS('padding-top', '14px')
  await expect(pane).toHaveCSS('padding-left', '14px')
  await expect(page.getByRole('button', { name: 'Mnemonic', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Grammar', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Phonetics', exact: true })).toBeVisible()
  const mnemonicFace = page
    .getByTestId('review-tab-label-mnemonic')
    .locator('[style*="letter-spacing"]')
    .first()
  const grammarFace = page
    .getByTestId('review-tab-label-grammar')
    .locator('[style*="letter-spacing"]')
    .first()
  await expect(mnemonicFace).toHaveCSS('font-weight', '600')
  await expect(grammarFace).toHaveCSS('font-weight', '500')
  await expect(mnemonicFace).toHaveCSS('font-size', '11px')
  await expect(page.getByTestId('review-tab-mark-mnemonic')).toHaveText('💡')
  await expect(page.getByTestId('review-tab-mark-grammar')).toHaveText('📖')
  await expect(page.getByTestId('review-tab-mark-phonetics')).toHaveText('🗣️')
  await page.getByRole('button', { name: 'Grammar', exact: true }).click()
  await expect(grammarFace).toHaveCSS('font-weight', '600')
  await expect(mnemonicFace).toHaveCSS('font-weight', '500')
  await expect(pane).toBeVisible()
  await expect(page.getByText('Castilian Pragmatics')).toHaveCount(0)
  await expect(page.getByText('3rd Pers. Present Indicative')).toHaveCount(0)
  await expect(page.getByText('96%')).toHaveCount(0)
  await expect(page.getByText('IPA:')).toHaveCount(0)
  await expect(page.getByText('Iambic')).toHaveCount(0)
  await expect(page.getByText('Due in 10m')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Again/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Hard/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Easy/ })).toBeVisible()
  const notesShadow = await notes.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(notesShadow).toContain('35, 30, 24')
  expect(notesShadow).toContain('0.05')
  await expect
    .poll(async () => {
      const notesBox = await notes.boundingBox()
      const dockBox = await page.getByTestId('review-dock').boundingBox()
      if (notesBox === null || dockBox === null) return false
      return notesBox.y + notesBox.height <= dockBox.y
    })
    .toBeTruthy()
  await page.getByRole('button', { name: /^Good/ }).click()
  await expect(page.getByTestId('review-receded-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Good/ })).toBeVisible()
  await page.getByRole('button', { name: /^Good/ }).click()
  await expect(page.getByText('Nothing is due')).toBeVisible()
})

test('review shows 56 play and the shuffle badge only when audio can play', async ({ page }) => {
  await atInstant(page, '2026-05-04T10:00')
  await onboard(page)
  mockTtsStatus(page, true)
  await page.goto('/practice/refrain')
  await scheduleTwoReviewPhrases(page)
  await jumpTo(page, '2027-05-04T10:00')
  await page.getByRole('button', { name: /, open the menu$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Review', exact: true }).click()
  const play = page.getByRole('button', { name: 'Play cadence deck', exact: true })
  await expect(play).toBeVisible()
  const playBox = await play.boundingBox()
  const shuffleBox = await page.getByTestId('review-shuffle').boundingBox()
  const sleeveBox = await page.getByTestId('review-sleeve').boundingBox()
  expect(playBox, '56 play has a box').not.toBeNull()
  expect(shuffleBox, 'shuffle badge has a box').not.toBeNull()
  expect(sleeveBox, 'sleeve has a box').not.toBeNull()
  expect(Math.round(playBox?.width ?? 0)).toBeGreaterThanOrEqual(56)
  expect(Math.round(playBox?.width ?? 0)).toBeLessThanOrEqual(58)
  expect(Math.round(playBox?.height ?? 0)).toBeGreaterThanOrEqual(56)
  expect(Math.round(playBox?.height ?? 0)).toBeLessThanOrEqual(58)
  const playTri = page.getByTestId('review-play-tri')
  await expect(playTri).toHaveCSS('border-left-width', '30px')
  await expect(playTri).toHaveCSS('border-top-width', '15px')
  await expect(playTri).not.toHaveAttribute('role', 'button')
  await play.click()
  await expect(page.getByRole('button', { name: 'Stop cadence deck', exact: true })).toBeVisible()
  const packPause = page.getByTestId('review-pack-pause')
  await expect(packPause).toBeVisible()
  const packPauseBar = page.getByTestId('review-pack-pause-bar')
  await expect(packPauseBar).toHaveCSS('width', '4px')
  await expect(packPauseBar).toHaveCSS('height', '30px')
  const miniPauseBar = page.getByTestId('review-mini-pause-bar')
  await expect(page.getByTestId('review-mini-pause')).toBeVisible()
  await expect(miniPauseBar).toHaveCSS('width', '4px')
  await expect(miniPauseBar).toHaveCSS('height', '20px')
  await expect(page.getByText('►', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Stop cadence deck', exact: true }).click()
  await expect(playTri).toBeVisible()
  const playShadow = await play.evaluate((node) => getComputedStyle(node).boxShadow)
  expect(playShadow).toContain('35, 30, 24')
  expect(playShadow).toContain('0.1')
  const shuffleShadow = await page
    .getByTestId('review-shuffle')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(shuffleShadow).toContain('35, 30, 24')
  expect(shuffleShadow).toContain('0.05')
  expect(Math.round(shuffleBox?.width ?? 0)).toBe(20)
  expect(Math.round(shuffleBox?.height ?? 0)).toBe(20)
  expect(Math.round(sleeveBox?.width ?? 0)).toBe(112)
  expect(Math.round(sleeveBox?.height ?? 0)).toBe(112)
  const hear = await page.getByTestId('review-hear').boundingBox()
  expect(Math.round(hear?.width ?? 0)).toBe(40)
  expect(Math.round(hear?.height ?? 0)).toBe(40)
  const hearFace = await page.getByTestId('review-hear').getByTestId('review-hear-mark').evaluate((node) => {
    const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
    return getComputedStyle(face).fontSize
  })
  expect(hearFace).toBe('18px')
  const hearShadow = await page
    .getByTestId('review-hear')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(hearShadow).toContain('35, 30, 24')
  expect(hearShadow).toContain('0.05')
  const recededHear = await page.getByTestId('review-receded-hear').boundingBox()
  expect(Math.round(recededHear?.width ?? 0)).toBe(40)
  expect(Math.round(recededHear?.height ?? 0)).toBe(40)
  const recededHearShadow = await page
    .getByTestId('review-receded-hear')
    .evaluate((node) => getComputedStyle(node).boxShadow)
  expect(recededHearShadow).toContain('35, 30, 24')
  expect(recededHearShadow).toContain('0.05')
  const recededReveal = await page.getByTestId('review-receded-reveal').boundingBox()
  expect(Math.round(recededReveal?.width ?? 0)).toBe(32)
  expect(Math.round(recededReveal?.height ?? 0)).toBe(32)
  const recededHearFace = await page
    .getByTestId('review-receded-hear')
    .getByTestId('review-hear-mark')
    .evaluate((node) => {
      const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
      return getComputedStyle(face).fontSize
    })
  expect(recededHearFace).toBe('18px')
  const recededRevealFace = await page
    .getByTestId('review-receded-reveal')
    .getByTestId('review-reveal-mark')
    .evaluate((node) => {
      const face = node.querySelector('[style]') ?? node.firstElementChild ?? node
      return getComputedStyle(face).fontSize
    })
  expect(recededRevealFace).toBe('20px')
  await expect(page.getByText('60% Retention')).toHaveCount(0)
  await expect(page.getByText('Due tomorrow')).toHaveCount(0)
  const indexOnPlay = await page.getByTestId('review-index').boundingBox()
  expect(Math.round(indexOnPlay?.width ?? 0)).toBe(28)
  expect(Math.round(indexOnPlay?.height ?? 0)).toBe(28)
  expect(sleeveBox?.y ?? 0).toBeGreaterThanOrEqual(0)
  expect((sleeveBox?.y ?? 0) + (sleeveBox?.height ?? 0)).toBeLessThan(844)
  expect((playBox?.y ?? 0) + (playBox?.height ?? 0)).toBeLessThan(844)
  await expect(page.getByText('VOL. 03')).toHaveCount(0)
  await expect(page.getByTestId('review-mini')).toHaveCSS('gap', '0px')
  await expect(page.getByTestId('review-mini-play')).toHaveCSS('margin-left', '8px')
  const miniTri = page.getByTestId('review-mini-play-tri')
  await expect(miniTri).toHaveCSS('border-left-width', '20px')
  await expect(miniTri).toHaveCSS('border-top-width', '10px')
  await expect(miniTri).not.toHaveAttribute('role', 'button')
  await expect(page.getByText('0.8x')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Skip to next phrase/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show answer', exact: true }).click()
  await expect(page.getByTestId('review-notes')).toBeVisible()
  const sleeveAfter = await page.getByTestId('review-sleeve').boundingBox()
  expect(sleeveAfter?.y ?? 0).toBeGreaterThanOrEqual(0)
  expect((sleeveAfter?.y ?? 0) + (sleeveAfter?.height ?? 0)).toBeLessThan(844)
  await expect
    .poll(async () => {
      const notesBox = await page.getByTestId('review-notes').boundingBox()
      const dockBox = await page.getByTestId('review-dock').boundingBox()
      if (notesBox === null || dockBox === null) return false
      return notesBox.y + notesBox.height <= dockBox.y
    })
    .toBeTruthy()
})
