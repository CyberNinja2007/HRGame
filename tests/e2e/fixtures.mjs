// Shared Playwright fixtures: strict network guard applied automatically to every test.
import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HTTP_PREFIX = 'http://127.0.0.1:8123/hr-simulator/';
export const FILE_PREFIX = pathToFileURL(path.join(ROOT, 'hr-simulator')).href + '/';

function allowed(url, extra) {
  if (extra.includes(url)) return true;
  return url.startsWith(HTTP_PREFIX) || url.startsWith(FILE_PREFIX) || url.startsWith('data:') || url === 'about:blank';
}

export const test = base.extend({
  gameUrl: [HTTP_PREFIX, { option: true }],
  transport: ['http', { option: true }],
  guardExtraAllow: [[], { option: true }],
  networkLog: [
    async ({ context, guardExtraAllow }, use, testInfo) => {
      const log = [];
      const problems = [];
      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (allowed(url, guardExtraAllow)) return route.continue();
        problems.push(`blocked request: ${url}`);
        return route.abort();
      });
      const watch = (page) => {
        page.on('request', (r) => log.push(r.url()));
        page.on('requestfailed', (r) => {
          const why = r.failure()?.errorText || '';
          // Navigation aborted by a reload is not a failed asset.
          if (/NS_BINDING_ABORTED|ERR_ABORTED|cancelled/i.test(why) && r.resourceType() === 'document') return;
          problems.push(`request failed: ${r.url()} ${why}`);
        });
        page.on('response', (r) => {
          if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
        });
        page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
        page.on('console', (m) => {
          if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
        });
      };
      context.pages().forEach(watch);
      context.on('page', watch);
      await use(log);
      if (problems.length) {
        await testInfo.attach('network-problems', { body: problems.join('\n'), contentType: 'text/plain' });
      }
      expect(problems, 'network guard: no external, failed, 4xx or error traffic').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
