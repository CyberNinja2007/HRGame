// Layout checks for every screen kind at four viewports (applicability table in the plan).
import { test, expect } from './fixtures.mjs';
import {
  VIEWPORTS, CORRECT, open, primary, advanceTo, waitStep, revealChoices, choose, goToScene,
  assertNoHorizontalOverflow, assertButtonsMin44, assertVisibleImagesLoaded, assertFontLoaded,
  assertPanelReachable, panelRatio, shot,
} from './helpers.mjs';

test.skip(({ transport }) => transport !== 'http', 'layout runs on the served build');

async function common(page) {
  await assertNoHorizontalOverflow(page);
  await assertButtonsMin44(page);
  await assertVisibleImagesLoaded(page);
  await assertPanelReachable(page);
}

async function modeChecks(page, vp, { speaker }) {
  const wide = vp.width >= 900 && vp.height >= 600;
  const short = vp.height <= 500;
  const opaqueCutouts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.speaker-layer')).filter((n) => getComputedStyle(n).display !== 'none' && n.classList.contains('is-active')).length,
  );
  const avatarVisible = await page.locator('.speaker-row .avatar').isVisible();
  if (wide) {
    expect(opaqueCutouts, 'wide: one cut-out iff a speaker').toBe(speaker ? 1 : 0);
    expect(avatarVisible).toBe(false);
  } else {
    expect(opaqueCutouts, 'avatar mode: no cut-out').toBe(0);
    expect(avatarVisible, 'avatar mode: avatar iff speaker').toBe(Boolean(speaker));
    const r = await panelRatio(page);
    if (short) expect(r).toBeGreaterThanOrEqual(0.8);
    else {
      expect(r).toBeGreaterThanOrEqual(0.6);
      expect(r).toBeLessThanOrEqual(0.72);
    }
  }
}

for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`${vpName} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, isMobile: false });

    test(`intro screens @intro`, async ({ page, gameUrl }, testInfo) => {
      await open(page, gameUrl);
      await assertFontLoaded(page);
      await common(page);
      await modeChecks(page, vp, { speaker: false });
      await shot(page, testInfo, vpName, '01-intro-company');

      await primary(page).click();
      await waitStep(page, 'intro-role');
      await common(page);
      await modeChecks(page, vp, { speaker: true });
      await shot(page, testInfo, vpName, '02-intro-role');

      await primary(page).click();
      await waitStep(page, 'intro-cast');
      await common(page);
      await modeChecks(page, vp, { speaker: false });
      const cards = page.locator('.cast figure');
      await expect(cards).toHaveCount(6);
      if (vpName === 'desktop') {
        for (let i = 0; i < 6; i++) await expect(cards.nth(i)).toBeInViewport({ ratio: 1 });
      } else {
        for (let i = 0; i < 6; i++) {
          await cards.nth(i).scrollIntoViewIfNeeded();
          await expect(cards.nth(i)).toBeInViewport();
        }
      }
      await page.locator('.panel').evaluate((p) => { p.scrollTop = 0; });
      await shot(page, testInfo, vpName, '03-intro-cast');

      await primary(page).click();
      await waitStep(page, 'intro-lead');
      await common(page);
      await modeChecks(page, vp, { speaker: false });
      await shot(page, testInfo, vpName, '04-intro-lead');
      await primary(page).click();
      await common(page);
      await modeChecks(page, vp, { speaker: true });
      await shot(page, testInfo, vpName, '05-intro-lead-thought');
    });

    test(`scene, feedback, transition, offer, ending`, async ({ page, gameUrl }, testInfo) => {
      await open(page, gameUrl);
      await goToScene(page, 1);
      await common(page);
      await modeChecks(page, vp, { speaker: true });
      await shot(page, testInfo, vpName, '06-scene-line');
      await revealChoices(page);
      await common(page);
      await shot(page, testInfo, vpName, '07-question');
      await choose(page, 'А');
      await common(page);
      await expect(page.locator('.feedback')).toBeInViewport();
      await shot(page, testInfo, vpName, '08-feedback-improve');
      await page.locator('.feedback-btn').click();
      await choose(page, CORRECT[1]);
      await shot(page, testInfo, vpName, '09-feedback-good');
      await page.locator('.feedback-btn').click();

      for (let i = 2; i <= 12; i++) {
        await waitStep(page, i === 6 || i === 11 ? 'transition' : 'scene');
        if (i === 6 || i === 11) {
          await common(page);
          await modeChecks(page, vp, { speaker: false });
          await shot(page, testInfo, vpName, `10-transition-${i === 6 ? 1 : 2}`);
          await primary(page).click();
          await waitStep(page, 'scene');
        }
        await revealChoices(page);
        if (i === 7) {
          await common(page);
          await shot(page, testInfo, vpName, '11-meeting-question');
        }
        await choose(page, CORRECT[i]);
        if (i === 8) {
          await page.locator('.feedback-btn').click();
          continue;
        }
        await page.locator('.feedback-btn').click();
      }
      await waitStep(page, 'offer');
      await common(page);
      await modeChecks(page, vp, { speaker: false });
      await expect(page.locator('.card-list li')).toHaveCount(9);
      await shot(page, testInfo, vpName, '12-offer');
      await primary(page).click();
      await waitStep(page, 'ending');
      await common(page);
      await modeChecks(page, vp, { speaker: true });
      await shot(page, testInfo, vpName, '13-ending');
      await advanceTo(page, 'ending');
      await primary(page).click();
      await shot(page, testInfo, vpName, '14-ending-final');
      await common(page);
    });
  });
}
