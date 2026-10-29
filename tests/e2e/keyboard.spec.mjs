// Keyboard-only contract: the whole game is playable with page.keyboard alone, every stop has a focused
// <button> with a visible focus indicator, and consecutive lines advance with Enter alone.
import { test, expect } from './fixtures.mjs';
import { open, primary, waitStep, CORRECT } from './helpers.mjs';
import { DATA } from './flows.mjs';

const LETTERS = ['А', 'Б', 'В'];
const scenes = DATA.phases.flatMap((p) => p.scenes.map((s) => ({ phase: p, scene: s })));

// Pointer events must never fire: keyboard activation of a button yields a click, but no pointer/mouse down.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__pointerEvents = 0;
    for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
      window.addEventListener(type, () => { window.__pointerEvents += 1; }, true);
    }
  });
});

const pointerEvents = (page) => page.evaluate(() => window.__pointerEvents);

/**
 * The focused element is a <button> that is :focus-visible and draws an outline. Buttons carry a resting
 * box-shadow (pixel-art bevel), so a shadow alone is not evidence of a focus indicator.
 */
async function expectFocusRing(page) {
  const info = await page.evaluate(() => {
    const a = document.activeElement;
    const cs = getComputedStyle(a);
    return {
      tag: a.tagName,
      label: (a.id || a.className || '').toString(),
      focusVisible: a.matches(':focus-visible'),
      outlineStyle: cs.outlineStyle,
      outlineWidth: parseFloat(cs.outlineWidth),
    };
  });
  expect(info.tag, `focused element ${info.label} is a button`).toBe('BUTTON');
  expect(info.focusVisible, `${info.label} matches :focus-visible`).toBe(true);
  expect(info.outlineStyle, `${info.label} outline-style`).not.toBe('none');
  expect(info.outlineWidth, `${info.label} outline-width`).toBeGreaterThan(0);
}

/** A stop: `locator` holds focus and shows the focus indicator. */
async function stop(page, locator) {
  await expect(locator).toBeFocused();
  await expectFocusRing(page);
}

const enter = (page) => page.keyboard.press('Enter');

/**
 * Read every line of the current dialogue step: focused «Далее» + Enter per line.
 * `scene` steps replace the button with the choices on the last line, so no Enter and no primary focus there.
 */
async function readLines(page, lines, { pressLast = true, scene = false } = {}) {
  for (let i = 0; i < lines.length; i++) {
    const last = i === lines.length - 1;
    await expect(page.locator('.dialogue')).toHaveText(lines[i].text);
    if (last && scene) return;
    await stop(page, primary(page));
    if (!last || pressLast) await enter(page);
  }
}

/** Fresh Intro A → D1 choices, Enter only. The first Enter has no focused control (global key on body). */
async function enterToScene1(page) {
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'intro-company');
  await expect(page.locator('.dialogue')).toHaveText(DATA.intro.company.text);
  await enter(page);
  await waitStep(page, 'intro-role');
  await stop(page, primary(page));
  await enter(page);
  await waitStep(page, 'intro-cast');
  await stop(page, primary(page));
  await enter(page);
  await waitStep(page, 'intro-lead');
  await readLines(page, DATA.intro.lead.lines);
  await waitStep(page, 'scene');
}

/** Choices appear, the first one receives focus once armed. Tab to `letter`, activate with Enter. */
async function answer(page, letter) {
  const first = page.locator(`.choice[data-choice="${LETTERS[0]}"]`);
  await expect(page.locator('.choices')).toBeVisible();
  await stop(page, first);
  for (let i = 1; i <= LETTERS.indexOf(letter); i++) {
    await page.keyboard.press('Tab');
    await stop(page, page.locator(`.choice[data-choice="${LETTERS[i]}"]`));
  }
  await enter(page);
  await expect(page.locator('.feedback')).toBeVisible();
}

test('Intro A → Intro B by Enter, D1 answered by keyboard @parity', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await enterToScene1(page);
  const d1 = scenes[0].scene;
  await readLines(page, d1.lines, { scene: true });
  await expect(page.locator('#prompt')).toHaveText(d1.prompt);
  await answer(page, CORRECT[1]);
  await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings.good);
  await stop(page, page.locator('.feedback-btn'));
  await expect(page.locator('.feedback-btn')).toHaveText(DATA.ui.continue);
  await enter(page);
  await waitStep(page, 'scene');
  await expect(page.locator('.dialogue')).toHaveText(scenes[1].scene.lines[0].text);
  expect(await pointerEvents(page)).toBe(0);
});

test('Tab order reaches fullscreen and «Далее» on Intro A with a visible focus ring', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  let reached = false;
  for (let i = 0; i < 4 && !reached; i++) {
    await page.keyboard.press('Tab');
    await expectFocusRing(page);
    reached = await primary(page).evaluate((b) => b === document.activeElement);
  }
  expect(reached, '#primary is reachable by Tab').toBe(true);
  await enter(page);
  await waitStep(page, 'intro-role');
  await stop(page, primary(page));
});

test('full keyboard-only playthrough: wrong answer + retry on D1, offer, ending, restart', async ({ page, gameUrl }) => {
  test.setTimeout(120_000);
  await open(page, gameUrl);
  await enterToScene1(page);

  for (let i = 0; i < scenes.length; i++) {
    const n = i + 1;
    const { phase, scene } = scenes[i];
    await waitStep(page, 'scene');
    // Consecutive lines: Enter alone, no Tab between them.
    await readLines(page, scene.lines, { scene: true });
    await expect(page.locator('#prompt')).toHaveText(scene.prompt);

    if (n === 1) {
      // Wrong answer А, then retry with Enter on the feedback button; focus returns to А.
      await answer(page, 'А');
      await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings.improve);
      await stop(page, page.locator('.feedback-btn'));
      await expect(page.locator('.feedback-btn')).toHaveText(DATA.ui.retry);
      await enter(page);
      await expect(page.locator('.feedback')).toBeHidden();
      await expect(page.locator('#prompt')).toHaveText(scene.prompt);
      await stop(page, page.locator('.choice[data-choice="А"]'));
    }

    await answer(page, CORRECT[n]);
    await expect(page.locator('#feedback-title')).toHaveText(DATA.ui.feedbackHeadings.good);
    await stop(page, page.locator('.feedback-btn'));
    await expect(page.locator('.feedback-btn')).toHaveText(DATA.ui.continue);
    await enter(page);

    if (phase.transition && scene === phase.scenes[phase.scenes.length - 1]) {
      await waitStep(page, 'transition');
      await expect(page.locator('.dialogue')).toHaveText(phase.transition.text);
      await stop(page, primary(page));
      await enter(page);
    }
  }

  // Offer
  await waitStep(page, 'offer');
  await expect(page.locator('.card-list li')).toHaveCount(DATA.offer.lines.length);
  await stop(page, primary(page));
  await enter(page);

  // Ending: two lines, the last button restarts
  await waitStep(page, 'ending');
  await readLines(page, [DATA.ending.message, { text: DATA.ending.text }], { pressLast: false });
  await expect(primary(page)).toHaveText(DATA.ui.restart);
  await enter(page);

  // Restart → Intro A with a focused primary
  await waitStep(page, 'intro-company');
  await expect(page.locator('#panel-title')).toHaveText(DATA.intro.company.title);
  await stop(page, primary(page));
  expect(await page.evaluate(() => localStorage.getItem('hrsim.save.v1'))).toBeNull();
  expect(await pointerEvents(page), 'no pointer events during the keyboard-only run').toBe(0);
});
