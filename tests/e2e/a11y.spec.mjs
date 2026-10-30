// Accessibility: axe-core on every screen kind, plus the polite live region contract.
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';
import { open, bootDone, primary, waitStep, advanceTo, revealChoices, restLength, saveValue } from './helpers.mjs';
import { DATA } from './flows.mjs';

test.skip(({ transport }) => transport !== 'http', 'axe runs on the served build');

const KEY = 'hrsim.save.v1';
// Steps: 0–3 intro, 4–8 D1–D5, 9 transition, 10–14 D6–D10, 15 transition, 16–17 D11–D12, 18 offer, 19 ending.
const STEP = { d1: 4, transition: 9, d7: 11, offer: 18 }; // the ending is not a save point; reach it from the offer

// Rules that must report nothing (landmark-* is matched by prefix).
const MUST_BE_CLEAN = ['color-contrast', 'button-name', 'region', 'html-has-lang', 'document-title', 'image-alt'];
const isMustBeClean = (id) => MUST_BE_CLEAN.includes(id) || id.startsWith('landmark-');

const summarize = (violations) =>
  violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => `${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(0, 2).join(' ')}`),
  }));

/** The page is idle: no pending swap, images and fonts loaded, so axe sees the final visuals. */
async function settle(page) {
  await expect(page.locator('.panel')).not.toHaveClass(/is-swapping/);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

async function audit(page, testInfo, label) {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(summarize(severe), `${label}: no serious/critical axe violations`).toEqual([]);
  const required = results.violations.filter((v) => isMustBeClean(v.id));
  expect(summarize(required), `${label}: zero violations for ${MUST_BE_CLEAN.join(', ')}, landmark-*`).toEqual([]);
  const review = results.incomplete.filter((v) => isMustBeClean(v.id)).map((v) => `${v.id}:${v.nodes.length}`);
  if (review.length) testInfo.annotations.push({ type: 'axe-needs-review', description: `${label}: ${review.join(' ')}` });
  return results;
}

/** Open the game with a save at `step`, press «Продолжить» and wait for `type`. */
async function resumeInto(page, gameUrl, step, type) {
  await page.goto(gameUrl);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveValue(step)]);
  await page.waitForLoadState('networkidle');
  await page.reload();
  await bootDone(page);
  await expect(primary(page)).toHaveText(DATA.ui.resume);
  await primary(page).click();
  await waitStep(page, type);
  await settle(page);
}

async function pick(page, letter) {
  const btn = page.locator(`.choice[data-choice="${letter}"]`);
  await expect(btn).toBeEnabled(); // choices arm after a short delay; disabled buttons are exempt from contrast checks
  await btn.click();
  await expect(page.locator('.feedback')).toBeVisible();
  await expect(page.locator('.feedback-btn')).toBeEnabled();
  await settle(page);
}

test('Intro A–D have no violations', async ({ page, gameUrl }, testInfo) => {
  await open(page, gameUrl);
  await settle(page);
  await audit(page, testInfo, 'Intro A');

  await primary(page).click();
  await waitStep(page, 'intro-role');
  await settle(page);
  await audit(page, testInfo, 'Intro B');

  await primary(page).click();
  await waitStep(page, 'intro-cast');
  await settle(page);
  await audit(page, testInfo, 'Intro C');

  await primary(page).click();
  await waitStep(page, 'intro-lead');
  await settle(page);
  await audit(page, testInfo, 'Intro D');
});

test('resume screen has no violations', async ({ page, gameUrl }, testInfo) => {
  await page.goto(gameUrl);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveValue(STEP.d7)]);
  await page.waitForLoadState('networkidle');
  await page.reload();
  await bootDone(page);
  await expect(page.locator('.btn.secondary')).toBeVisible();
  await settle(page);
  await audit(page, testInfo, 'resume screen');
});

test('question screen has no violations', async ({ page, gameUrl }, testInfo) => {
  await resumeInto(page, gameUrl, STEP.d1, 'scene');
  await revealChoices(page);
  await expect(page.locator('.choice[data-choice="А"]')).toBeEnabled();
  await settle(page);
  await audit(page, testInfo, 'question D1');
});

test('feedback screens (improve, risky, good) have no violations', async ({ page, gameUrl }, testInfo) => {
  await resumeInto(page, gameUrl, STEP.d1, 'scene');
  await revealChoices(page);
  // D1: А = improve, Б = good, В = risky.
  const kinds = [['А', 'improve'], ['В', 'risky'], ['Б', 'good']];
  for (const [letter, kind] of kinds) {
    await pick(page, letter);
    await expect(page.locator('.feedback')).toHaveAttribute('data-kind', kind);
    await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings[kind]);
    await audit(page, testInfo, `feedback ${kind}`);
    if (kind !== 'good') {
      await page.locator('.feedback-btn').click();
      await expect(page.locator('.feedback')).toBeHidden();
    }
  }
});

test('transition screen has no violations', async ({ page, gameUrl }, testInfo) => {
  await resumeInto(page, gameUrl, STEP.transition, 'transition');
  await audit(page, testInfo, 'transition');
});

test('offer screen has no violations', async ({ page, gameUrl }, testInfo) => {
  await resumeInto(page, gameUrl, STEP.offer, 'offer');
  await audit(page, testInfo, 'offer');
});

test('ending screen has no violations', async ({ page, gameUrl }, testInfo) => {
  await resumeInto(page, gameUrl, STEP.offer, 'offer');
  await primary(page).click();
  await waitStep(page, 'ending');
  await settle(page);
  await audit(page, testInfo, 'ending (message)');
  await primary(page).click();
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.text);
  await expect(primary(page)).toHaveText(DATA.ui.restart);
  await settle(page);
  await audit(page, testInfo, 'ending (final line)');
});

test.describe('mid-typing', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('Intro A while the text is being typed has no violations @motion', async ({ page, gameUrl }, testInfo) => {
    await open(page, gameUrl);
    expect(await restLength(page), 'text is still being typed').toBeGreaterThan(0);
    await audit(page, testInfo, 'Intro A mid-typing');
  });
});

test.describe('live region', () => {
  test('.sr-live mirrors the current dialogue line', async ({ page, gameUrl }) => {
    const d7 = DATA.phases[1].scenes[1];
    expect(d7.lines.length).toBeGreaterThan(2);
    await resumeInto(page, gameUrl, STEP.d7, 'scene');
    const spoken = (line) => {
      const c = line.speaker ? DATA.characters[line.speaker] : null;
      return (c ? `${c.name}: ` : '') + line.text;
    };
    const live = page.locator('.sr-live');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    for (let i = 0; i < d7.lines.length; i++) {
      await expect(page.locator('.dialogue')).toHaveText(d7.lines[i].text);
      // The announcement is set after a 30 ms task delay; the expectation retries until then.
      // The last line is merged with the question prompt announced in the same turn.
      const last = i === d7.lines.length - 1;
      await expect(live).toHaveText(last ? `${spoken(d7.lines[i])} ${d7.prompt}` : spoken(d7.lines[i]));
      if (i < d7.lines.length - 1) await primary(page).click();
    }
    await expect(page.locator('.choices')).toBeVisible();
  });

  test('.sr-live announces the question prompt and feedback', async ({ page, gameUrl }) => {
    const d1 = DATA.phases[0].scenes[0];
    await resumeInto(page, gameUrl, STEP.d1, 'scene');
    await advanceTo(page, 'scene');
    await revealChoices(page);
    await expect(page.locator('.sr-live')).toContainText(d1.prompt);
    await pick(page, 'Б');
    await expect(page.locator('.sr-live')).toContainText(DATA.ui.feedbackHeadings.good);
    await expect(page.locator('.sr-live')).toContainText(d1.choices.find((c) => c.id === 'Б').feedback);
  });
});
