// Save/resume (AC 9–11). File projects follow the recorded file:// storage expectation; http always persists.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.mjs';
import { open, bootDone, next, primary, waitStep, goToScene, revealChoices, choose, saveValue } from './helpers.mjs';
import { DATA, playthrough } from './flows.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPECT = JSON.parse(readFileSync(path.join(ROOT, 'tests/e2e/file-storage.expect.json'), 'utf8'));
const KEY = 'hrsim.save.v1';
const D7 = 11; // steps: 0–3 intro, 4–8 D1–D5, 9 transition, 10 D6, 11 D7

const readSave = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const storageMode = (browserName, transport) => (transport === 'http' ? 'persist' : EXPECT[browserName]);

async function reload(page) {
  await page.waitForLoadState('networkidle');
  await page.reload();
  await bootDone(page);
}

async function expectNormalIntro(page) {
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');
  await expect(primary(page)).toHaveText(DATA.ui.next);
  await expect(page.locator('.btn.secondary')).toBeHidden();
}

async function expectResumeScreen(page) {
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');
  await expect(primary(page)).toHaveText(DATA.ui.resume);
  await expect(page.locator('.btn.secondary')).toBeVisible();
  await expect(page.locator('.btn.secondary')).toHaveText(DATA.ui.restart);
  await expect(primary(page)).toBeFocused();
}

test('progress is saved per step and resumed fresh @parity', async ({ page, gameUrl, browserName, transport }) => {
  test.skip(storageMode(browserName, transport) !== 'persist', 'storage does not persist here');
  await open(page, gameUrl);
  await expectNormalIntro(page); // AC10: no save → «Далее» only
  expect(await readSave(page)).toBeNull();

  await next(page);
  await waitStep(page, 'intro-role');
  expect(JSON.parse(await readSave(page))).toEqual({ v: 1, step: 1, id: 'intro-role' });

  await goToScene(page, 7);
  expect(JSON.parse(await readSave(page))).toEqual({ v: 1, step: D7, id: 'd07' });

  // Open a wrong-answer feedback; resume must reopen the question fresh.
  await revealChoices(page);
  await choose(page, 'А');
  await reload(page);
  await expectResumeScreen(page);
  await primary(page).click();
  await waitStep(page, 'scene');
  const d7 = DATA.phases[1].scenes[1];
  await expect(page.locator('.dialogue')).toHaveText(d7.lines[0].text);
  await expect(page.locator('.feedback')).toBeHidden();
  await revealChoices(page);
  for (const l of ['А', 'Б', 'В']) await expect(page.locator(`.choice[data-choice="${l}"]`)).toBeEnabled();

  // Resume-screen restart clears the key and shows the normal Intro A; a reload has no resume UI (AC11).
  await reload(page);
  await expectResumeScreen(page);
  await page.locator('.btn.secondary').click();
  await expectNormalIntro(page);
  await expect(primary(page)).toBeFocused();
  expect(await readSave(page)).toBeNull();
  await reload(page);
  await expectNormalIntro(page);
});

test('ending and ending restart clear the save @parity', async ({ page, gameUrl, browserName, transport }) => {
  test.skip(storageMode(browserName, transport) !== 'persist', 'storage does not persist here');
  await open(page, gameUrl);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveValue(18)]);
  await reload(page);
  await expectResumeScreen(page);
  await primary(page).click();
  await waitStep(page, 'offer');
  await next(page);
  await waitStep(page, 'ending');
  expect(await readSave(page)).toBeNull(); // AC11: ending removes the key
  await next(page);
  await next(page); // «Начать заново»
  await waitStep(page, 'intro-company');
  expect(await readSave(page)).toBeNull();
  await reload(page);
  await expectNormalIntro(page);
});

test('corrupt and out-of-range saves are ignored and removed @parity', async ({ page, gameUrl, browserName, transport }) => {
  test.skip(storageMode(browserName, transport) !== 'persist', 'storage does not persist here');
  await open(page, gameUrl);
  for (const bad of ['{', 'null', '{"v":2,"step":5}', '{"v":1,"step":0}', '{"v":1,"step":19}', '{"v":1,"step":1.5}', '{"v":1,"step":"5"}', '{"v":1,"step":5}', '{"v":1,"step":5,"id":"d03"}', '{"v":2,"step":5,"id":"d02"}']) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bad]);
    await reload(page);
    await expectNormalIntro(page);
    expect(await readSave(page), `removed: ${bad}`).toBeNull();
  }
});

test('throwing storage: full playthrough completes without errors @parity', async ({ page, gameUrl }) => {
  await page.addInitScript(() => {
    const boom = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
    Storage.prototype.removeItem = boom;
    Storage.prototype.clear = boom;
  });
  await playthrough(page, gameUrl, { clearSave: false });
  await reload(page);
  await expectNormalIntro(page);
});

test('non-persistent storage matches the recorded expectation @parity', async ({ page, gameUrl, browserName, transport }) => {
  const mode = storageMode(browserName, transport);
  test.skip(mode === 'persist', 'covered by the persist tests');
  await open(page, gameUrl, { clearSave: false });
  await next(page);
  await waitStep(page, 'intro-role');
  await reload(page);
  await expectNormalIntro(page);
});
