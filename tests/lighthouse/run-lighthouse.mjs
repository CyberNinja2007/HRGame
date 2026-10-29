// Lighthouse gate: 3 mobile + 3 desktop runs; medians of performance and accessibility must be >= 0.90.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { start, HOST } from '../serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'tests', 'artifacts', 'lighthouse');
const CLI = path.join(ROOT, 'node_modules', 'lighthouse', 'cli', 'index.js');
const RUNS = 3;
const THRESHOLD = 0.9;
const PORT = Number(process.env.LH_PORT || 8124);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function runOnce(url, mode, n, chromePath) {
  const outFile = path.join(OUT, `${mode}-${n}.json`);
  const args = [
    CLI, url,
    '--only-categories=performance,accessibility',
    '--output=json', `--output-path=${outFile}`,
    '--chrome-flags=--headless=new --no-sandbox',
    '--quiet',
  ];
  if (mode === 'desktop') args.push('--preset=desktop');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, CHROME_PATH: chromePath }, stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`lighthouse ${mode}-${n} exited with ${code}`));
      resolve(JSON.parse(fs.readFileSync(outFile, 'utf8')));
    });
  });
}

function summarize(lhr) {
  const a = lhr.audits;
  const node = (a['lcp-breakdown-insight']?.details?.items ?? []).find((i) => i.type === 'node');
  const lcpEl = node ? `${node.selector} «${node.nodeLabel}»` : 'n/a';
  return {
    performance: lhr.categories.performance.score,
    accessibility: lhr.categories.accessibility.score,
    lcp: a['largest-contentful-paint'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    lcpEl,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chromePath = chromium.executablePath();
  const server = await start(PORT);
  const url = `http://${HOST}:${PORT}/hr-simulator/`;
  let failed = false;
  try {
    for (const mode of ['mobile', 'desktop']) {
      const results = [];
      for (let n = 1; n <= RUNS; n++) {
        const s = summarize(await runOnce(url, mode, n, chromePath));
        results.push(s);
        console.log(`${mode} #${n}: perf ${s.performance} a11y ${s.accessibility} LCP ${Math.round(s.lcp)}ms TBT ${Math.round(s.tbt)}ms CLS ${s.cls.toFixed(3)} LCP element: ${s.lcpEl}`);
      }
      for (const cat of ['performance', 'accessibility']) {
        const m = median(results.map((r) => r[cat]));
        const ok = m >= THRESHOLD;
        if (!ok) failed = true;
        console.log(`${mode} median ${cat}: ${m} ${ok ? 'OK' : `FAIL (< ${THRESHOLD})`}`);
      }
    }
  } catch (e) {
    console.error(e.message);
    failed = true;
  } finally {
    await new Promise((r) => server.close(r));
  }
  process.exit(failed ? 1 : 0);
}

main();
