// Interaction contract: typing completion, double activation, touch, Space, drag-scroll.
import { test, expect } from './fixtures.mjs';
import { open, bootDone, next, primary, waitStep, advanceTo, goToScene, revealChoices, restLength, choicesShown } from './helpers.mjs';

test.skip(({ transport }) => transport !== 'http', 'interaction runs on the served build');
test.use({ reducedMotion: 'no-preference' });

const isTyping = (page) => page.evaluate(() => { const r = document.querySelector('.dialogue .rest'); return !!r && r.textContent.length > 0; });

test('(a) «Далее» while typing completes the line without advancing; focus stays @motion', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await expect.poll(() => isTyping(page)).toBe(true);
  await primary(page).click();
  expect(await restLength(page)).toBe(0); // non-retrying: Intro A types for ~3 s on its own
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');
  await expect(primary(page)).toBeFocused();
  await primary(page).click();
  await waitStep(page, 'intro-role');
  await expect(primary(page)).toBeFocused();
});

test('(b) double activation advances exactly one step @motion', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await primary(page).click(); // finish typing
  await expect(page.locator('.dialogue .rest')).toHaveText('');
  await primary(page).dblclick();
  await waitStep(page, 'intro-role');
  await page.waitForTimeout(500);
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-role');

  // «Продолжить» on feedback
  await goToScene(page, 1);
  await revealChoices(page);
  await page.locator('.choice[data-choice="Б"]').click();
  await page.locator('.feedback-btn').dblclick();
  await waitStep(page, 'scene');
  await page.waitForTimeout(500);
  // Still on decision 2 (its single narration line), not beyond; the second click may only finish typing.
  await expect(page.locator('.dialogue')).toHaveText('Мария открывает резюме: Windows Server, AD, VPN, сети.');
  await expect(page.locator('.feedback')).toBeHidden();
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'scene');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hrsim.save.v1')).step)).toBe(5);
});

test.describe('touch', () => {
  // isMobile is left off: Chromium's device emulation lets the preload scanner evaluate <picture> media
  // against a 980px layout viewport before the meta viewport applies, which fetches and then aborts the
  // desktop background. Real phones resolve the meta viewport first; touch input only needs hasTouch.
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 390, height: 844 } });

  test('(c) taps on D7 complete lines without double advance @motion', async ({ page, gameUrl }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('firefox'), 'Firefox has no mobile emulation');
    await page.goto(gameUrl);
    await page.evaluate(() => localStorage.setItem('hrsim.save.v1', JSON.stringify({ v: 1, step: 11 })));
    await page.waitForLoadState('networkidle');
    await page.reload();
    await bootDone(page);
    await page.locator('#primary').tap();
    await waitStep(page, 'scene');
    // D7 has more than one line.
    await expect.poll(() => isTyping(page)).toBe(true);
    const first = await page.locator('.dialogue').textContent();
    await page.locator('.dialogue').tap();
    expect(await restLength(page)).toBe(0);
    expect(await choicesShown(page)).toBe(false);
    expect(await page.locator('.dialogue').textContent()).toBe(first);
    // advance to the last line
    for (let i = 0; i < 10 && !(await page.locator('.choices').isVisible()); i++) {
      await page.locator('#primary').tap();
      await expect.poll(() => isTyping(page)).toBe(true);
      const before = await page.locator('.dialogue').textContent();
      await page.locator('.dialogue').tap();
      expect(await restLength(page)).toBe(0);
      expect(await page.locator('.dialogue').textContent()).toBe(before);
    }
    expect(await choicesShown(page)).toBe(true);
    await expect(page.locator('#prompt')).toBeVisible();
    await expect(page.locator('.feedback')).toBeHidden();
    await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'scene');
  });

  test('(e) touch-drag scroll of the panel does not advance @motion', async ({ page, gameUrl }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('chromium'), 'CDP touch emulation');
    await open(page, gameUrl);
    await next(page);
    await waitStep(page, 'intro-role');
    const panel = page.locator('.panel');
    const box = await panel.boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let k = 1; k <= 8; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - k * 30 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-role');
  });
});

test('(d) Space on #primary advances exactly one line @motion', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await advanceTo(page, 'intro-lead');
  await primary(page).click(); // complete line 1 typing if still typing
  await expect(page.locator('.dialogue .rest')).toHaveText('');
  await expect(page.locator('.dialogue')).not.toHaveText(/Сначала проверю/);
  await primary(page).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.dialogue')).toContainText('Сначала');
  await page.waitForTimeout(300);
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-lead');
  await expect(primary(page)).toBeFocused();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('(f) a human-paced double click (150 ms apart) opens exactly one new screen', async ({ page, gameUrl }) => {
    await open(page, gameUrl);
    await advanceTo(page, 'intro-cast');
    await page.waitForLoadState('networkidle'); // Intro D images cached: its commit is immediate
    await primary(page).click(); // first click of the pair
    await waitStep(page, 'intro-lead');
    const box = await primary(page).boundingBox();
    await page.waitForTimeout(150);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    // Instant text: without the guard the second click would show line 2 (Maria's thought).
    await expect(page.locator('.dialogue')).toHaveText(/^В архиве/);
    await expect(primary(page)).toBeFocused();
  });
});
