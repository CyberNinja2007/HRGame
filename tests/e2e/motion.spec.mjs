// Motion contract: typing gate, completion keys, durations, reduced motion, preload, one speaker layer.
import { test, expect } from './fixtures.mjs';
import { open, next, primary, waitStep, advanceTo, goToScene, revealChoices, choose, restLength, choicesShown, CORRECT, saveValue } from './helpers.mjs';
import { DATA } from './flows.mjs';

test.skip(({ transport }) => transport !== 'http', 'motion runs on the served build');

async function durations(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const n = document.querySelector(sel);
      return n ? parseFloat(getComputedStyle(n).transitionDuration) : null;
    };
    return { bg: pick('.bg-layer'), speaker: pick('.speaker-layer'), panel: pick('.panel') };
  });
}

const opaqueLayers = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('.speaker-layer'))
    .filter((n) => getComputedStyle(n).display !== 'none')
    .map((n) => ({ o: parseFloat(getComputedStyle(n).opacity), src: n.getAttribute('src') || '' })),
);

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  // D3 is a single 148-character line (~3 s of typing): completion can only come from the input.
  for (const how of ['click', 'Enter', 'Space']) {
    test(`choices hidden while typing; ${how} completes the text @motion`, async ({ page, gameUrl }) => {
      await open(page, gameUrl);
      await goToScene(page, 3);
      await expect.poll(() => restLength(page)).toBeGreaterThan(0);
      expect(await choicesShown(page)).toBe(false);
      if (how === 'click') await page.locator('.dialogue').click();
      else {
        await page.locator('#panel-title').focus();
        await page.keyboard.press(how === 'Space' ? ' ' : 'Enter');
      }
      // Non-retrying reads right after the input: natural typing would still be running.
      expect(await restLength(page)).toBe(0);
      expect(await choicesShown(page)).toBe(true);
      await expect(page.locator('.choice').first()).toBeFocused();
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

  test('step n+1 background is preloaded before it is entered @motion', async ({ page, gameUrl }) => {
    await open(page, gameUrl);
    // Transition 1 (step 9) is the first moment the meeting room is needed next; nothing earlier uses it.
    await goToScene(page, 5);
    const meeting = /assets\/backgrounds\/meeting_room(-836)?\.webp$/;
    const has = () => page.evaluate((re) => performance.getEntriesByType('resource').some((e) => new RegExp(re).test(e.name)), meeting.source);
    // D5 commit preloads steps 9 and 10; the transition stays on the office background, D6 needs the meeting room.
    await expect.poll(has).toBe(true);
    await revealChoices(page);
    await choose(page, CORRECT[5]);
    await page.locator('.feedback-btn').click();
    await waitStep(page, 'transition');
    await next(page);
    await waitStep(page, 'scene');
    const src = await page.locator('.bg-layer.is-active img').evaluate((i) => i.currentSrc);
    expect(src).toMatch(meeting);
  });

  test('wide mode crossfades speaker to speaker with exactly one opaque layer @motion', async ({ page, gameUrl }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(gameUrl);
    await page.evaluate((v) => localStorage.setItem('hrsim.save.v1', v), saveValue(11));
    await page.reload();
    await expect(page.locator('.stage')).not.toHaveClass(/is-booting/);
    await primary(page).click(); // «Продолжить» → D7: pavel → gennady → narration
    await waitStep(page, 'scene');
    const lines = DATA.phases[1].scenes[1].lines;
    for (let i = 0; i < lines.length; i++) {
      const speaker = lines[i].speaker;
      const want = speaker ? DATA.characters[speaker].portrait : null;
      // Settle: the expected layer (or none) fully opaque and nothing mid-fade.
      await expect.poll(async () => {
        const ls = await opaqueLayers(page);
        const settled = ls.every((l) => l.o > 0.99 || l.o < 0.01);
        const op = ls.filter((l) => l.o > 0.99).map((l) => l.src);
        return settled && (want ? op.length === 1 && op[0] === want : op.length === 0);
      }, { timeout: 3000 }).toBe(true);
      const layers = await opaqueLayers(page);
      const opaque = layers.filter((l) => l.o > 0.99);
      const clear = layers.filter((l) => l.o < 0.01);
      expect(opaque.length + clear.length, 'no layer mid-fade after the crossfade').toBe(layers.length);
      if (speaker) {
        expect(opaque).toHaveLength(1);
        expect(opaque[0].src).toBe(DATA.characters[speaker].portrait);
      } else {
        expect(opaque).toHaveLength(0);
      }
      if (i < lines.length - 1) await next(page);
    }
  });

  test('a second tap right after the choices appear never answers @motion', async ({ page, gameUrl }) => {
    // Models the second click of a double click / a second tap landing on choice А as it replaces «Далее».
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, gameUrl);
    await goToScene(page, 3);
    await expect.poll(() => restLength(page)).toBeGreaterThan(0);
    await primary(page).click();
    const box = await page.locator('.choice').first().boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    await expect(page.locator('.feedback')).toBeHidden();
    await expect(page.locator('.choice[aria-current]')).toHaveCount(0);
    await expect(page.locator('.choice').first()).toBeFocused();
  });

  test('the live region gets each line once, never per character @motion', async ({ page, gameUrl }) => {
    await open(page, gameUrl);
    await page.evaluate(() => {
      window.__live = [];
      new MutationObserver(() => {
        const t = document.querySelector('.sr-live').textContent;
        if (t) window.__live.push(t);
      }).observe(document.querySelector('.sr-live'), { childList: true, characterData: true, subtree: true });
    });
    await advanceTo(page, 'intro-lead');
    await expect.poll(() => restLength(page)).toBe(0);
    await page.waitForTimeout(100);
    const lead = DATA.intro.lead.lines[0].text;
    const log = await page.evaluate(() => window.__live);
    expect(log.filter((t) => t.includes(lead))).toHaveLength(1);
    expect(log.some((t) => lead.startsWith(t) && t !== lead)).toBe(false);
    await expect(page.locator('.sr-live')).toHaveText(lead);
  });
});

test('reduced motion: 0 s transitions, instant text, last line and prompt both announced', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  const d = await durations(page);
  for (const v of Object.values(d)) expect(v).toBe(0);
  expect(await restLength(page)).toBe(0);
  await goToScene(page, 1);
  await expect(page.locator('.choices')).toBeVisible();
  const scene = DATA.phases[0].scenes[0];
  await expect(page.locator('.sr-live')).toContainText(scene.lines[0].text);
  await expect(page.locator('.sr-live')).toContainText(scene.prompt);
  await expect(page.locator('.choice').first()).toBeFocused();
  await choose(page, 'Б');
  await expect(page.locator('.feedback-btn')).toBeFocused();
  await expect(page.locator('.sr-live')).toContainText(DATA.ui.feedbackHeadings.good);
});

test('held Space (global key path) advances exactly one line on release', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await goToScene(page, 7); // D7 has three lines; reduced motion: instant text
  await page.locator('#panel-title').focus();
  await page.keyboard.down(' ');
  for (let i = 0; i < 5; i++) await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true })));
  await page.waitForTimeout(400); // choices would be armed by now if they had been revealed
  await page.keyboard.up(' ');
  await page.waitForTimeout(300);
  await expect(page.locator('.feedback')).toBeHidden();
  await expect(page.locator('.choice[aria-current]')).toHaveCount(0);
  const lines = DATA.phases[1].scenes[1].lines;
  await expect(page.locator('.dialogue')).toHaveText(lines[1].text); // exactly one line advanced
});

test('step headings are announced on titled dialogue steps', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await expect(page.locator('.sr-live')).toContainText(DATA.intro.company.title);
  await goToScene(page, 5);
  await revealChoices(page);
  await choose(page, CORRECT[5]);
  await page.locator('.feedback-btn').click();
  await waitStep(page, 'transition');
  await expect(page.locator('.sr-live')).toContainText(DATA.phases[0].title);
  await expect(page.locator('.sr-live')).toContainText(DATA.phases[0].transition.text);
});

test('a tap on the final ending line does not restart; only the button does', async ({ page, gameUrl }) => {
  await open(page, gameUrl);
  await page.evaluate((v) => localStorage.setItem('hrsim.save.v1', v), saveValue(18));
  await page.reload();
  await expect(page.locator('.stage')).not.toHaveClass(/is-booting/);
  await primary(page).click();
  await waitStep(page, 'offer');
  await next(page);
  await waitStep(page, 'ending');
  await next(page);
  await expect(page.locator('.dialogue')).toHaveText(DATA.ending.text);
  await page.locator('.dialogue').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.stage')).toHaveAttribute('data-step-type', 'ending');
  await primary(page).click();
  await waitStep(page, 'intro-company');
});
