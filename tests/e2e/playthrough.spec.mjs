// Full playthrough: every one of the 20 steps, wrong + retry, transitions, offer, ending.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.mjs';
import { CORRECT, open, next, primary, waitStep, revealChoices, choose, assertVisibleImagesLoaded, assertFontLoaded } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'hr-simulator', 'game-data.js'), 'utf8'), sandbox);
const DATA = sandbox.window.GAME_DATA;
const scenes = DATA.phases.flatMap((p) => p.scenes.map((s) => ({ phase: p, scene: s })));

async function bgSrc(page) {
  return page.locator('.bg-layer.is-active img').evaluate((i) => i.currentSrc || i.src);
}

async function expectBg(page, id) {
  const b = DATA.backgrounds[id];
  const src = await bgSrc(page);
  expect([b.src, b.srcSmall].some((s) => src.endsWith(s)), `background ${id} (got ${src})`).toBe(true);
}

async function screenOk(page) {
  await assertVisibleImagesLoaded(page);
}

async function playthrough(page, gameUrl) {
  await open(page, gameUrl);
  await assertFontLoaded(page);

  // Intro A (AC1)
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');
  await expect(page.locator('#panel-title')).toHaveText(DATA.intro.company.title);
  await expect(page.locator('.subtitle')).toHaveText(DATA.intro.company.subtitle);
  await expect(page.locator('.dialogue')).toHaveText(DATA.intro.company.text);
  await expect(primary(page)).toHaveText(DATA.ui.next);
  await expect(page.locator('.btn.secondary')).toBeHidden();
  await expectBg(page, 'company');
  await screenOk(page);

  // Intro B (AC2)
  await next(page);
  await waitStep(page, 'intro-role');
  await expect(page.locator('#panel-title')).toHaveText(DATA.intro.role.title);
  await expect(page.locator('.speaker-name')).toHaveText(DATA.characters.maria.name);
  await expect(page.locator('.card-list li')).toHaveCount(DATA.intro.role.vacancy.length);
  await expect(page.locator('.notice')).toHaveText(DATA.intro.role.aiPolicy);
  await screenOk(page);

  // Intro C: 6 names, roles, distinct loaded images
  await next(page);
  await waitStep(page, 'intro-cast');
  const cards = page.locator('.cast figure');
  await expect(cards).toHaveCount(6);
  const order = DATA.intro.cast.order;
  for (let i = 0; i < 6; i++) {
    const c = DATA.characters[order[i]];
    await expect(cards.nth(i).locator('h3')).toHaveText(c.name);
    await expect(cards.nth(i).locator('figcaption p')).toHaveText(c.role);
    await cards.nth(i).scrollIntoViewIfNeeded();
  }
  const imgs = await cards.locator('img').evaluateAll((list) => list.map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0 })));
  expect(new Set(imgs.map((i) => i.src)).size).toBe(6);
  expect(imgs.every((i) => i.ok)).toBe(true);

  // Intro D
  await next(page);
  await waitStep(page, 'intro-lead');
  await expect(page.locator('.dialogue')).toHaveText(DATA.intro.lead.lines[0].text);
  await next(page);
  await expect(page.locator('.dialogue')).toHaveText(DATA.intro.lead.lines[1].text);
  await expect(primary(page)).toHaveText(DATA.ui.start);
  await screenOk(page);
  await next(page);

  for (let i = 0; i < scenes.length; i++) {
    const n = i + 1;
    const { phase, scene } = scenes[i];
    await waitStep(page, 'scene');
    await expectBg(page, phase.background);
    await expect(page.locator('.topbar-phase')).toHaveText(phase.title);
    await expect(page.locator('.topbar-date')).toHaveText(phase.dateLabel);
    await expect(page.locator('.dialogue')).toHaveText(scene.lines[0].text);
    await screenOk(page);
    await revealChoices(page);
    await expect(page.locator('#prompt')).toHaveText(scene.prompt);
    await expect(page.locator('.choice-letter')).toHaveText(['А', 'Б', 'В']);
    const choiceTexts = await page.locator('.choice-text').allTextContents();
    expect(choiceTexts).toEqual(scene.choices.map((c) => c.text));
    await expect(page.locator('body')).not.toContainText('/12');

    if (n === 1) {
      // Wrong answer + retry (AC7, AC8)
      await choose(page, 'А');
      await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings.improve);
      await expect(page.locator('.reaction')).toContainText(scene.choices[0].reaction[0].text);
      await expect(page.locator('.explanation')).toHaveText(scene.choices[0].feedback);
      await expect(page.locator('.feedback-btn')).toHaveText(DATA.ui.retry);
      await expect(page.locator('.choice[data-choice="Б"]')).toBeDisabled();
      await expect(page.locator('.choice[data-choice="В"]')).toBeDisabled();
      await expect(page.locator('.choice[data-choice="А"]')).toHaveAttribute('aria-current', 'true');
      await page.locator('.feedback-btn').click();
      await expect(page.locator('.feedback')).toBeHidden();
      await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'scene');
      await expect(page.locator('#prompt')).toHaveText(scene.prompt);
      for (const l of ['А', 'Б', 'В']) await expect(page.locator(`.choice[data-choice="${l}"]`)).toBeEnabled();
      await expect(page.locator('.choice[data-choice="А"]')).toBeFocused();
    }

    const letter = CORRECT[n];
    const good = scene.choices.find((c) => c.id === letter);
    expect(good.kind).toBe('good');
    await choose(page, letter);
    await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings.good);
    await expect(page.locator('.explanation')).toHaveText(good.feedback);
    for (const r of good.reaction) await expect(page.locator('.reaction')).toContainText(r.text);
    if (n === 1) await expect(page.locator('.reaction')).toContainText('Да, Мария, сейчас удобно.');
    await expect(page.locator('.feedback-btn')).toHaveText(DATA.ui.continue);
    await page.locator('.feedback-btn').click();

    if (phase.transition && scene === phase.scenes[phase.scenes.length - 1]) {
      await waitStep(page, 'transition');
      await expect(page.locator('#panel-title')).toHaveText(phase.title);
      await expect(page.locator('.dialogue')).toHaveText(phase.transition.text);
      await screenOk(page);
      await next(page);
    }
  }

  // Offer (AC5)
  await waitStep(page, 'offer');
  await expectBg(page, 'victory');
  await expect(page.locator('#panel-title')).toHaveText(DATA.ui.offerTitle);
  await expect(page.locator('.card-list li')).toHaveText(DATA.offer.lines);
  expect(DATA.offer.lines).toHaveLength(9);
  await screenOk(page);
  await next(page);

  // Ending (AC6)
  await waitStep(page, 'ending');
  await expectBg(page, 'victory');
  await expect(page.locator('.topbar-date')).toHaveText(DATA.ending.date);
  await expect(page.locator('#panel-title')).toHaveText(DATA.ending.title);
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.message.text);
  await expect(page.locator('.speaker-name')).toHaveText(DATA.characters.gennady.name);
  await next(page);
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.text);
  await expect(page.getByRole('button', { name: DATA.ui.restart })).toHaveCount(1);
  await expect(primary(page)).toHaveText(DATA.ui.restart);
  await expect(primary(page)).toBeFocused();
  await screenOk(page);
  expect(await page.evaluate(() => { try { return localStorage.getItem('hrsim.save.v1'); } catch (e) { return 'err'; } })).toBeNull();

  // Restart returns to Intro A
  await next(page);
  await waitStep(page, 'intro-company');
  await expect(page.locator('#panel-title')).toHaveText(DATA.intro.company.title);
  await expect(page.locator('.btn.secondary')).toBeHidden();
  await expectBg(page, 'company');
  await screenOk(page);
  await page.waitForLoadState('networkidle');
}

test('full playthrough @parity', async ({ page, gameUrl }) => {
  await playthrough(page, gameUrl);
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('full playthrough with typing @motion', async ({ page, gameUrl }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-http', 'one motion copy');
    await playthrough(page, gameUrl);
  });
});
