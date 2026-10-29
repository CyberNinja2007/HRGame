// AC16: every rendered screen is Russian-only, free of scoring vocabulary and of fractions other than 5/2 and 24/7.
// Walks the whole game, dumps the rendered text per screen into tests/artifacts/content-dump.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.mjs';
import { open, next, primary, waitStep, revealChoices, choose, CORRECT } from './helpers.mjs';
import { DATA } from './flows.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DUMP = path.join(ROOT, 'tests', 'artifacts', 'content-dump.md');

// Same rules as tests/unit/game-data.test.mjs (that file does not export them, so they are mirrored here).
const ALLOWED_FRACTIONS = new Set(['5/2', '24/7']);
const SCORING = /балл|очк(о|и|ов)\b|рейтинг|достижени|оценк[аиу] (игрока|прохождения)|правильн\w* ответ|\d+\s*из\s*\d+|итог\w* балл|статистик/i;
const LATIN_ALLOWLIST = new Set([
  'HR', 'IT', 'AI', 'IP', 'ChatGPT', 'Copilot', 'Windows', 'Server', 'Active', 'Directory', 'AD', 'VPN', 'DNS',
  'nslookup', 'PowerShell', 'MikroTik', 'Linux', 'Kubernetes', 'Go', 'BGP', 'GPO', 'CSV', 'gross'
]);
// The game's own product name in <title> («HR Simulator: Срочная вакансия») is the only addition, scoped to document.title.
const TITLE_LATIN = new Set([...LATIN_ALLOWLIST, 'Simulator']);

test.skip(({ transport }) => transport !== 'http', 'content scan runs over http only');

/** Rendered strings of the current screen: visible stage text, accessible names, alt texts and the document title. */
async function snapshot(page, heading) {
  const s = await page.evaluate(() => {
    const stage = document.querySelector('.stage');
    const uniq = (list) => [...new Set(list.map((t) => t.trim()).filter(Boolean))];
    return {
      text: stage.innerText.replace(/[ \t]+\n/g, '\n').trim(),
      labels: uniq([...document.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label'))),
      alts: uniq([...document.querySelectorAll('img[alt]')].map((n) => n.getAttribute('alt'))),
      titles: uniq([...document.querySelectorAll('[title]')].map((n) => n.getAttribute('title'))),
      live: (document.querySelector('.sr-live')?.textContent || '').trim(),
      docTitle: document.title
    };
  });
  return { heading, ...s };
}

function scan(where, value, latin = LATIN_ALLOWLIST) {
  expect(value, `${where}: empty`).not.toBe('');
  expect(value, `${where}: no Cyrillic`).toMatch(/[А-Яа-яЁё]/);
  expect(SCORING.test(value), `${where}: scoring wording «${value.match(SCORING)?.[0]}»`).toBe(false);
  expect(value, `${where}: «/12»`).not.toContain('/12');
  for (const frac of value.match(/\d+\s*\/\s*\d+/g) || []) expect(ALLOWED_FRACTIONS.has(frac), `${where}: fraction ${frac}`).toBe(true);
  for (const word of value.match(/[A-Za-z][A-Za-z0-9]*/g) || []) expect(latin.has(word), `${where}: Latin word «${word}» is not allowlisted`).toBe(true);
}

function dumpMarkdown(screens) {
  const out = ['# Content dump', '', 'Rendered player-visible text per screen (stage innerText, accessible names, alt texts, document title), produced by tests/e2e/content.spec.mjs.', ''];
  for (const s of screens) {
    out.push(`## ${s.heading}`, '', '```text', s.text, '```', '');
    if (s.live) out.push(`- screen-reader announcement: ${s.live}`);
    for (const l of s.labels) out.push(`- aria-label: ${l}`);
    for (const a of s.alts) out.push(`- alt: ${a}`);
    for (const t of s.titles) out.push(`- title attribute: ${t}`);
    out.push(`- document.title: ${s.docTitle}`, '');
  }
  return out.join('\n');
}

test('every rendered screen is Russian-only, has no scoring words and no stray fractions (AC16)', async ({ page, gameUrl }, testInfo) => {
  test.setTimeout(180_000);
  const screens = [];
  const snap = async (heading) => { screens.push(await snapshot(page, heading)); };

  await open(page, gameUrl);

  // Intro A–D
  await waitStep(page, 'intro-company');
  await snap('Вступление A: компания');
  await next(page);
  await waitStep(page, 'intro-role');
  await snap('Вступление B: вакансия');
  await next(page);
  await waitStep(page, 'intro-cast');
  await snap('Вступление C: команда');
  await next(page);
  await waitStep(page, 'intro-lead');
  for (let i = 0; i < DATA.intro.lead.lines.length; i++) {
    await expect(page.locator('.dialogue')).toHaveText(DATA.intro.lead.lines[i].text);
    await snap(`Вступление D: реплика ${i + 1}`);
    await next(page);
  }

  // Scenes: every line, the question, one wrong feedback (then retry) and the good feedback.
  let n = 0;
  for (const phase of DATA.phases) {
    for (const scene of phase.scenes) {
      n += 1;
      await waitStep(page, 'scene');
      for (let i = 0; i < scene.lines.length; i++) {
        await expect(page.locator('.dialogue')).toHaveText(scene.lines[i].text);
        await snap(`Решение ${n}: реплика ${i + 1}`);
        if (i < scene.lines.length - 1) await next(page);
      }
      await revealChoices(page);
      await expect(page.locator('#prompt')).toHaveText(scene.prompt);
      await snap(`Решение ${n}: вопрос`);

      const wrong = scene.choices.find((c) => c.kind !== 'good');
      await choose(page, wrong.id);
      await expect(page.locator('.explanation')).toHaveText(wrong.feedback);
      await snap(`Решение ${n}: обратная связь, вариант ${wrong.id} (${wrong.kind})`);
      await page.locator('.feedback-btn').click();
      await expect(page.locator('.feedback')).toBeHidden();

      const good = scene.choices.find((c) => c.id === CORRECT[n]);
      expect(good.kind).toBe('good');
      await choose(page, good.id);
      await expect(page.locator('.explanation')).toHaveText(good.feedback);
      await snap(`Решение ${n}: обратная связь, вариант ${good.id} (${good.kind})`);
      await page.locator('.feedback-btn').click();

      if (phase.transition && scene === phase.scenes[phase.scenes.length - 1]) {
        await waitStep(page, 'transition');
        await expect(page.locator('.dialogue')).toHaveText(phase.transition.text);
        await snap(`Переход: ${phase.title}`);
        await next(page);
      }
    }
  }
  expect(n).toBe(12);

  // Offer and ending
  await waitStep(page, 'offer');
  await snap('Оффер');
  await next(page);
  await waitStep(page, 'ending');
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.message.text);
  await snap('Финал: сообщение Геннадия');
  await next(page);
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.text);
  await snap('Финал: итоговый текст');

  // Restart → Intro A, then the resume screen (a save exists after step 1)
  await next(page);
  await waitStep(page, 'intro-company');
  await next(page);
  await waitStep(page, 'intro-role');
  await page.waitForLoadState('networkidle');
  await page.reload();
  await expect(primary(page)).toHaveText(DATA.ui.resume);
  await expect(page.locator('.btn.secondary')).toBeVisible();
  await snap('Экран продолжения');

  // ---- scans
  expect(screens.length).toBeGreaterThan(60);
  for (const s of screens) {
    scan(`${s.heading} / текст`, s.text);
    for (const l of s.labels) scan(`${s.heading} / aria-label «${l}»`, l);
    for (const a of s.alts) scan(`${s.heading} / alt «${a}»`, a);
    for (const t of s.titles) scan(`${s.heading} / title «${t}»`, t);
    if (s.live) scan(`${s.heading} / объявление`, s.live);
    scan(`${s.heading} / document.title`, s.docTitle, TITLE_LATIN);
  }
  // sanity: the allowlisted fractions really are rendered somewhere, and scoring words are not
  const all = screens.map((s) => s.text).join('\n');
  expect(all).toContain('5/2');
  expect(all).not.toContain('/12');
  expect(screens.some((s) => s.alts.length > 0), 'cast alt texts are collected').toBe(true);

  if (testInfo.project.name === 'chromium-http') {
    fs.mkdirSync(path.dirname(DUMP), { recursive: true });
    fs.writeFileSync(DUMP, dumpMarkdown(screens));
  }
});
