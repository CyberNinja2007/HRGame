// Fullscreen button (AC12): hidden where unsupported; state follows change events.
import { test, expect } from './fixtures.mjs';
import { open } from './helpers.mjs';
import { DATA } from './flows.mjs';

test.skip(({ transport }) => transport !== 'http', 'fullscreen runs on the served build');

test('unsupported fullscreen keeps the button hidden', async ({ page, gameUrl }) => {
  await page.addInitScript(() => {
    for (const name of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
      Object.defineProperty(Document.prototype, name, { configurable: true, get: () => false });
    }
  });
  await open(page, gameUrl, { clearSave: false });
  await expect(page.locator('.fullscreen-btn')).toBeHidden();
});

test('fullscreen toggles and aria-pressed follows the real state', async ({ page, gameUrl, browserName }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, gameUrl);
  const btn = page.locator('.fullscreen-btn');
  const real = () => page.evaluate(() => String(!!(document.fullscreenElement || document.webkitFullscreenElement)));
  if (!(await btn.isVisible())) {
    expect(await page.evaluate(() => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled))).toBe(false);
    return;
  }
  await expect(btn).toHaveText(DATA.ui.fullscreenEnter);
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await btn.click();
  if (browserName === 'chromium') {
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveText(DATA.ui.fullscreenExit);
    expect(await real()).toBe('true');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveText(DATA.ui.fullscreenEnter);
  } else {
    await page.waitForTimeout(500);
    await expect(btn).toHaveAttribute('aria-pressed', await real());
  }
  expect(errors).toEqual([]);
});
