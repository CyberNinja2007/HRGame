// Full playthrough: every one of the 20 steps, wrong + retry, transitions, offer, ending.
import { test } from './fixtures.mjs';
import { playthrough } from './flows.mjs';

test('full playthrough @parity', async ({ page, gameUrl }) => {
  await playthrough(page, gameUrl);
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('full playthrough with typing @motion', async ({ page, gameUrl }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-http', 'one motion copy');
    await playthrough(page, gameUrl);
  });
});
