// Motion contract: typing gate, completion keys, durations, reduced motion, preload, one speaker layer.
import { test, expect } from './fixtures.mjs';
import { open, primary, waitStep, advanceTo, goToScene, revealChoices } from './helpers.mjs';

test.skip(({ transport }) => transport !== 'http', 'motion runs on the served build');

const isTyping = (page) => page.evaluate(() => { const r = document.querySelector('.dialogue .rest'); return !!r && r.textContent.length > 0; });

async function durations(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const n = document.querySelector(sel);
      return n ? parseFloat(getComputedStyle(n).transitionDuration) : null;
    };
    return { bg: pick('.bg-layer'), speaker: pick('.speaker-layer'), panel: pick('.panel') };
  });
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const how of ['click', 'Enter', 'Space']) {
    test(`choices hidden while typing; ${how} completes the text @motion`, async ({ page, gameUrl }) => {
      await open(page, gameUrl);
      await goToScene(page, 1);
      await expect.poll(() => isTyping(page)).toBe(true);
      await expect(page.locator('.choices')).toBeHidden();
      if (how === 'click') await page.locator('.dialogue').click();
      else {
        await page.locator('#panel-title').focus();
        await page.keyboard.press(how === 'Space' ? ' ' : 'Enter');
      }
      await expect(page.locator('.dialogue .rest')).toHaveText('');
      await expect(page.locator('.choices')).toBeVisible();
    });
  }

  test('transition durations are within 0.12–0.25 s @motion', async ({ page, gameUrl }) => {
    await open(page, gameUrl);
    const d = await durations(page);
    for (const v of Object.values(d)) {
      expect(v).toBeGreaterThanOrEqual(0.12);
      expect(v).toBeLessThanOrEqual(0.25);
    }
  });

  test('step n+1 images are preloaded after commit @motion', async ({ page, gameUrl }) => {
    await open(page, gameUrl);
    await advanceTo(page, 'intro-lead');
    // Next step is scene 1 on the office background, speaker Gennady.
    const names = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
    const wide = await page.evaluate(() => matchMedia('(min-width: 900px) and (min-height: 600px)').matches);
    expect(names.some((n) => /assets\/backgrounds\/office(-836)?\.webp$/.test(n))).toBe(true);
    expect(names.some((n) => (wide ? /characters\/gennady\.webp$/ : /avatars\/gennady\.webp$/).test(n))).toBe(true);
  });

  test('wide mode keeps exactly one opaque speaker layer after a swap @motion', async ({ page, gameUrl }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, gameUrl);
    await goToScene(page, 1);
    await revealChoices(page);
    await page.locator('.choice[data-choice="Б"]').click();
    await page.locator('.feedback-btn').click();
    await waitStep(page, 'scene');
    // scene 2 opens on narration (no speaker) then Gennady; walk lines and check after each swap.
    for (let i = 0; i < 6 && !(await page.locator('.choices').isVisible()); i++) {
      await page.waitForTimeout(300);
      const opaque = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.speaker-layer')).filter((n) => getComputedStyle(n).display !== 'none' && parseFloat(getComputedStyle(n).opacity) > 0.99).length,
      );
      const speaker = await page.locator('.stage').getAttribute('data-speaker');
      expect(opaque).toBe(speaker ? 1 : 0);
      await primary(page).click().catch(() => {});
    }
  });
});

test('reduced motion: 0 s transitions and instant text', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  const d = await durations(page);
  for (const v of Object.values(d)) expect(v).toBe(0);
  await expect(page.locator('.dialogue .rest')).toHaveText('');
  await goToScene(page, 1);
  await expect(page.locator('.choices')).toBeVisible();
});
