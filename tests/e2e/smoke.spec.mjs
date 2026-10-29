// @smoke: engine launch + localStorage behaviour of the storage probe over http and file://.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, expect } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE_PROBE = pathToFileURL(path.join(ROOT, 'tests/fixtures/storage-probe/index.html')).href;
const HTTP_PROBE = 'http://127.0.0.1:8123/tests/fixtures/storage-probe/index.html';
const EXPECT = JSON.parse(readFileSync(path.join(ROOT, 'tests/e2e/file-storage.expect.json'), 'utf8'));

test.use({ guardExtraAllow: [FILE_PROBE, HTTP_PROBE] });

async function probe(page, url) {
  await page.goto(url + '#write');
  const written = await page.locator('#out').textContent();
  if (written === 'throws') return 'throws';
  await page.goto(url);
  await page.reload();
  const read = await page.locator('#out').textContent();
  return read === 'persist' ? 'persist' : read === 'throws' ? 'throws' : 'session-only';
}

test('engine launches and localStorage matches recorded expectation @smoke', async ({ page, browserName, transport }) => {
  await page.goto('about:blank');
  const url = transport === 'file' ? FILE_PROBE : HTTP_PROBE;
  const result = await probe(page, url);
  if (transport === 'http') {
    expect(result).toBe('persist');
  } else {
    expect(EXPECT[browserName], `recorded file:// expectation for ${browserName}`).toBeDefined();
    expect(result).toBe(EXPECT[browserName]);
  }
});
