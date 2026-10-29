// Shared e2e helpers: game driving, layout assertions, screenshots.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCREENS_DIR = path.join(ROOT, 'tests', 'artifacts', 'screens');

export const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  phone: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};

export const CORRECT = { 1: 'Б', 2: 'А', 3: 'В', 4: 'Б', 5: 'А', 6: 'Б', 7: 'В', 8: 'А', 9: 'Б', 10: 'В', 11: 'А', 12: 'Б' };

const DATA_TITLE = 'СеверСофт';

export async function open(page, gameUrl, { clearSave = true } = {}) {
  await page.goto(gameUrl);
  if (clearSave) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
    // Let boot-time preloads settle so the reload does not abort in-flight requests.
    await page.waitForLoadState('networkidle');
    await page.reload();
  }
  await bootDone(page);
  await expect(page.locator('#panel-title')).toHaveText(DATA_TITLE);
  await page.evaluate(() => document.fonts.ready);
}

/** game.js has booted (the static shell markup is replaced and listeners are attached). */
export async function bootDone(page) {
  await expect(page.locator('.stage')).not.toHaveClass(/is-booting/);
  await page.waitForLoadState('networkidle');
}

export const primary = (page) => page.locator('#primary');
/** Activate «Далее»-like primary once the current line is fully shown (a click while typing only completes it). */
export async function next(page) {
  const btn = page.locator('#primary');
  if (await page.evaluate(() => { const r = document.querySelector('.dialogue .rest'); return !!r && r.textContent.length > 0; })) {
    await btn.click();
    await expect(page.locator('.dialogue .rest')).toHaveText('');
  }
  await btn.click();
}

/** Characters of the current line not yet typed (non-retrying read). */
export const restLength = (page) => page.evaluate(() => { const r = document.querySelector('.dialogue .rest'); return r ? r.textContent.length : 0; });
export const choicesShown = (page) => page.evaluate(() => !document.querySelector('.choices').hidden);

export const stepType = (page) => page.locator('.stage').getAttribute('data-step-type');

export async function waitStep(page, type) {
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', type);
  await expect(page.locator('.panel')).not.toHaveClass(/is-swapping/);
}

/** Press the visible primary button until the next step type is reached (lines within a step are clicked through). */
export async function advanceTo(page, type, maxClicks = 12) {
  for (let i = 0; i < maxClicks; i++) {
    if ((await stepType(page)) === type && !(await page.locator('.panel').evaluate((n) => n.classList.contains('is-swapping')))) return;
    const btn = primary(page);
    if (await btn.isVisible()) await btn.click();
    else await page.waitForTimeout(50);
  }
  await waitStep(page, type);
}

/** Click through scene lines until the choices are visible. */
export async function revealChoices(page) {
  const choices = page.locator('.choices');
  for (let i = 0; i < 12 && !(await choices.isVisible()); i++) {
    const btn = primary(page);
    if (await btn.isVisible()) await btn.click();
    else await page.waitForTimeout(50);
  }
  await expect(choices).toBeVisible();
}

export async function choose(page, letter) {
  await page.locator(`.choice[data-choice="${letter}"]`).click();
  await expect(page.locator('.feedback')).toBeVisible();
}

/** From Intro A (fresh), go to scene n (1-based) with choices visible, answering correctly. */
export async function goToScene(page, n) {
  await advanceTo(page, 'scene', 20);
  for (let i = 1; i < n; i++) {
    await revealChoices(page);
    await choose(page, CORRECT[i]);
    await page.locator('.feedback-btn').click();
    // After decisions 5 and 10 a transition screen sits between scenes.
    if (i === 5 || i === 10) {
      await waitStep(page, 'transition');
      await primary(page).click();
    }
    await waitStep(page, 'scene');
  }
}

export async function assertNoHorizontalOverflow(page) {
  const res = await page.evaluate(() => {
    const doc = document.documentElement;
    const bad = [];
    document.querySelectorAll('.panel, .panel *').forEach((n) => {
      if (n.offsetParent === null || n.clientWidth <= 1) return;
      if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible' && n.clientWidth > 0) bad.push(n.className || n.tagName);
    });
    return { docOverflow: doc.scrollWidth > doc.clientWidth + 1, bad };
  });
  expect(res.docOverflow, 'document has no horizontal overflow').toBe(false);
  expect(res.bad, 'no panel element overflows horizontally').toEqual([]);
}

export async function assertButtonsMin44(page) {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ t: b.textContent.trim().slice(0, 30), h: b.getBoundingClientRect().height }))
      .filter((b) => b.h < 44),
  );
  expect(small, 'all visible buttons are at least 44px tall').toEqual([]);
}

export async function assertVisibleImagesLoaded(page) {
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((i) => i.offsetParent !== null && getComputedStyle(i).opacity !== '0' && i.getAttribute('src'))
      .every((i) => i.complete),
  );
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((i) => i.offsetParent !== null && getComputedStyle(i).opacity !== '0' && i.getAttribute('src'))
      .filter((i) => !(i.complete && i.naturalWidth > 0))
      .map((i) => i.currentSrc || i.src),
  );
  expect(broken, 'visible images are loaded').toEqual([]);
}

export async function assertFontLoaded(page) {
  const ok = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts).some((f) => f.family.replace(/"/g, '') === 'Pixelify Sans' && f.status === 'loaded');
  });
  expect(ok, 'Pixelify Sans is loaded').toBe(true);
}

/** Panel scrollable (if needed) and its last visible action reachable. */
export async function assertPanelReachable(page) {
  const info = await page.evaluate(() => {
    const p = document.querySelector('.panel');
    const cs = getComputedStyle(p);
    const overflows = p.scrollHeight > p.clientHeight + 1;
    return { overflows, oy: cs.overflowY };
  });
  if (info.overflows) expect(['auto', 'scroll']).toContain(info.oy);
  const actions = page.locator('.panel button:visible');
  const count = await actions.count();
  if (count) {
    const last = actions.nth(count - 1);
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
  }
}

export async function panelRatio(page) {
  return page.evaluate(() => document.querySelector('.panel').getBoundingClientRect().height / window.innerHeight);
}

export async function shot(page, testInfo, viewportName, name) {
  const file = path.join(SCREENS_DIR, testInfo.project.name, viewportName, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}
