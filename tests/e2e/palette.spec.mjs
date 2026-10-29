// AC32: the computed colours of the key UI elements come from the SPEC palette (read from SPEC.md, not duplicated).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.mjs';
import { open, next, primary, waitStep, advanceTo, revealChoices, choose, goToScene } from './helpers.mjs';
import { DATA } from './flows.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = fs.readFileSync(path.join(ROOT, 'HR_Simulator_Static_HTML_Starter_Pack', 'SPEC.md'), 'utf8');

test.skip(({ transport }) => transport !== 'http', 'palette is transport-independent; checked over http only');

// "Suggested colors: `#25334F` text, `#F8F4EB` cream panel, `#6178B3` panel border, ..."
const ROLES = { text: 'ink', 'cream panel': 'cream', 'panel border': 'frame', 'deep blue accents': 'navy', success: 'success', caution: 'caution' };
const PALETTE = {};
for (const m of SPEC.matchAll(/`(#[0-9A-Fa-f]{6})`\s+(text|cream panel|panel border|deep blue accents|success|caution)\b/g)) {
  PALETTE[ROLES[m[2]]] = m[1].toUpperCase();
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const c = (role) => rgb(PALETTE[role]);

/** Computed style properties of the first match of a selector. */
const style = (page, selector, props) =>
  page.locator(selector).first().evaluate((el, list) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(list.map((p) => [p, cs.getPropertyValue(p)]));
  }, props);

test('the SPEC palette is parsed completely', () => {
  expect(Object.keys(PALETTE).sort()).toEqual(['caution', 'cream', 'frame', 'ink', 'navy', 'success']);
  expect(PALETTE).toEqual({ ink: '#25334F', cream: '#F8F4EB', frame: '#6178B3', navy: '#263C70', success: '#72B59B', caution: '#C17F59' });
});

test('panel, title, buttons and frame use the SPEC colours (intro)', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');

  // Panel: cream fill, ink text, navy border, SPEC panel-border blue as the stacked frame ring.
  const panel = await style(page, '.panel', ['background-color', 'color', 'border-top-color', 'border-top-width', 'border-top-style', 'box-shadow']);
  expect(panel['background-color']).toBe(c('cream'));
  expect(panel.color).toBe(c('ink'));
  expect(panel['border-top-color']).toBe(c('navy'));
  expect(panel['border-top-width']).toBe('4px');
  expect(panel['border-top-style']).toBe('solid');
  expect(panel['box-shadow']).toContain(c('frame'));
  expect(panel['box-shadow']).toContain(c('navy'));

  // Title: deep-blue accent.
  expect((await style(page, '#panel-title', ['color'])).color).toBe(c('navy'));

  // Primary button: navy fill, cream label, panel-border-blue ring.
  await expect(primary(page)).toBeVisible();
  const btn = await style(page, '#primary', ['background-color', 'color', 'box-shadow']);
  expect(btn['background-color']).toBe(c('navy'));
  expect(btn.color).toBe(c('cream'));
  expect(btn['box-shadow']).toContain(c('frame'));

  // The browser chrome colour matches the deep-blue accent too.
  expect((await page.locator('meta[name="theme-color"]').getAttribute('content')).toUpperCase()).toBe(PALETTE.navy);
});

test('spoken dialogue text is ink; speaker name is navy', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await advanceTo(page, 'intro-lead');
  // Line 0 is narration (own tint); line 1 is Maria speaking.
  await next(page);
  await expect(page.locator('.dialogue')).toHaveText(DATA.intro.lead.lines[1].text);
  await expect(page.locator('.speaker-row')).toBeVisible();
  expect((await style(page, '.dialogue', ['color'])).color).toBe(c('ink'));
  expect((await style(page, '.speaker-name', ['color'])).color).toBe(c('navy'));
});

test('choices and feedback: frame-blue choice border, caution/success accents, navy feedback border', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await goToScene(page, 1);
  await revealChoices(page);

  const choice = await style(page, '.choice[data-choice="Б"]', ['border-top-color', 'border-top-width', 'color']);
  expect(choice['border-top-color']).toBe(c('frame'));
  expect(choice['border-top-width']).toBe('3px');
  expect(choice.color).toBe(c('ink'));

  // D1 А is a wrong option: caution accent.
  await choose(page, 'А');
  await expect(page.locator('.feedback')).toHaveAttribute('data-kind', /.+/);
  expect(await page.locator('.feedback').getAttribute('data-kind')).not.toBe('good');
  let fb = await style(page, '.feedback', ['border-top-color', 'box-shadow']);
  expect(fb['border-top-color']).toBe(c('navy'));
  expect(fb['box-shadow']).toContain(c('caution'));
  expect(fb['box-shadow']).not.toContain(c('success'));
  expect((await style(page, '#feedback-title', ['color'])).color).toBe(c('navy'));
  await page.locator('.feedback-btn').click();
  await expect(page.locator('.feedback')).toBeHidden();

  // D1 Б is the good option: success accent.
  await choose(page, 'Б');
  await expect(page.locator('.feedback')).toHaveAttribute('data-kind', 'good');
  fb = await style(page, '.feedback', ['border-top-color', 'box-shadow']);
  expect(fb['border-top-color']).toBe(c('navy'));
  expect(fb['box-shadow']).toContain(c('success'));
  expect(fb['box-shadow']).not.toContain(c('caution'));
  await expect(page.locator('.choice[data-choice="Б"]')).toHaveAttribute('aria-current', 'true');
  expect((await style(page, '.choice[data-choice="Б"]', ['border-top-color']))['border-top-color']).toBe(c('navy'));
});

test('secondary button (resume screen): cream fill, navy label and ring', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await next(page);
  await waitStep(page, 'intro-role');
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(page.locator('.btn.secondary')).toBeVisible();
  const sec = await style(page, '.btn.secondary', ['background-color', 'color', 'box-shadow']);
  expect(sec['background-color']).toBe(c('cream'));
  expect(sec.color).toBe(c('navy'));
  expect(sec['box-shadow']).toContain(c('navy'));
});
