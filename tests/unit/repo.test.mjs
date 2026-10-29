import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const deploy = path.join(root, 'hr-simulator');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const files = walk(deploy).sort();

test('deploy root: git-visible files equal files on disk (nothing ignored or stray)', () => {
  const visible = new Set([
    ...git('ls-files', 'hr-simulator'),
    ...git('ls-files', '--others', '--exclude-standard', 'hr-simulator'),
  ].map((f) => f.replace(/^hr-simulator\//, '')));
  assert.deepEqual([...visible].sort(), files);
});

test('deploy root: only shipped file kinds, no dev sources', () => {
  for (const required of ['index.html', 'styles.css', 'game.js', 'game-data.js', 'README.md', 'assets/fonts/OFL.txt', 'assets/ui/favicon.png']) {
    assert.ok(files.includes(required), `missing ${required}`);
  }
  assert.ok(files.some((f) => /^assets\/fonts\/.+\.woff2$/.test(f)), 'woff2 font present');
  for (const f of files) {
    assert.ok(!/\.ttf$/i.test(f), `source font shipped: ${f}`);
    assert.ok(!/\.(mjs|py|json|map|log)$/i.test(f), `dev file shipped: ${f}`);
    if (/\.md$/i.test(f)) assert.equal(f, 'README.md', `unexpected markdown: ${f}`);
    if (/\.png$/i.test(f)) assert.equal(f, 'assets/ui/favicon.png', `png source shipped: ${f}`);
    assert.ok(!/(^|\/)(node_modules|\.git|tests|tools)(\/|$)/.test(f), `dev dir shipped: ${f}`);
  }
  const top = files.filter((f) => !f.includes('/')).sort();
  assert.deepEqual(top, ['README.md', 'game-data.js', 'game.js', 'index.html', 'styles.css']);
  for (const f of files.filter((x) => x.startsWith('assets/'))) {
    assert.match(f, /\.(webp|woff2|png|txt)$/, `unexpected asset type: ${f}`);
  }
});

test('player README (Russian, no dev tooling)', () => {
  const text = read('hr-simulator', 'README.md');
  assert.match(text, /index\.html/);
  assert.match(text, /[А-Яа-яЁё]{4,}/);
  assert.match(text, /OFL\.txt/);
  assert.match(text, /GitHub Pages/);
  assert.match(text, /iPhone/);
  assert.match(text, /cookie/i);
  for (const banned of [/npm/i, /npx/i, /node /i, /localhost/i, /http-server/i]) {
    assert.doesNotMatch(text, banned, `player README must not match ${banned}`);
  }
});

test('root README (Russian, documents dev workflow)', () => {
  const text = read('README.md');
  assert.match(text, /[А-Яа-яЁё]{4,}/);
  const scripts = JSON.parse(read('package.json')).scripts;
  for (const name of ['serve', 'assets', 'assets:check', 'assets:glyphs', 'test:unit', 'test:e2e', 'test:e2e:native', 'test:e2e:webkit', 'lighthouse']) {
    assert.ok(scripts[name], `package.json lacks script ${name}`);
    assert.ok(text.includes(`npm run ${name}`), `root README lacks npm run ${name}`);
  }
  for (const needle of ['tests/run-in-container.sh', 'tools/requirements.txt', 'pages.yml', 'hr-simulator/']) {
    assert.ok(text.includes(needle), `root README lacks ${needle}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'tests', 'run-in-container.sh')));
  assert.ok(fs.existsSync(path.join(root, 'tools', 'requirements.txt')));
});

test('package.json has no runtime dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!('dependencies' in pkg));
  assert.ok(pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0);
});

test('Pages workflow publishes hr-simulator without a build', () => {
  const wf = read('.github', 'workflows', 'pages.yml');
  for (const needle of ['actions/configure-pages', 'upload-pages-artifact', 'path: hr-simulator', 'deploy-pages', 'pages: write', 'id-token: write', 'contents: read', 'workflow_dispatch', 'group: pages']) {
    assert.ok(wf.includes(needle), `workflow lacks ${needle}`);
  }
  assert.match(wf, /push:\s*\n\s+branches:\s*\[\s*main\s*\]/);
  assert.doesNotMatch(wf, /npm |npx |run:/, 'workflow must have no build step');
});

test('index.html structure', () => {
  const html = read('hr-simulator', 'index.html');
  assert.match(html, /<html[^>]*\blang="ru"/);
  assert.match(html, /<meta\s+charset="utf-8"/i);
  assert.match(html, /<meta\s+name="viewport"[^>]*width=device-width/);
  const title = /<title>([^<]*)<\/title>/.exec(html);
  assert.ok(title && /[А-Яа-яЁё]{4,}/.test(title[1]), 'Russian <title>');
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(scripts.length >= 2);
  for (const s of scripts) {
    assert.match(s, /\bdefer\b/);
    assert.match(s, /\bsrc="/);
    assert.doesNotMatch(s, /type\s*=\s*["']?module/);
  }
  assert.doesNotMatch(html, /type\s*=\s*["']?module/);
  const main = /<main\b[^>]*>/.exec(html);
  assert.ok(main, '<main> present');
  assert.doesNotMatch(main[0], /\brole=/);
});

test('game scripts use no network or module APIs', () => {
  for (const f of ['game.js', 'game-data.js']) {
    const text = read('hr-simulator', f);
    assert.ok(!text.includes('fetch('), `${f}: fetch(`);
    assert.ok(!text.includes('XMLHttpRequest'), `${f}: XMLHttpRequest`);
    assert.doesNotMatch(text, /\bimport\s/, `${f}: import`);
  }
});

test('all references are relative', () => {
  const isRelative = (u) => !/^(\/|[a-z][a-z0-9+.-]*:|\\)/i.test(u.trim());
  const html = read('hr-simulator', 'index.html');
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const u of refs) assert.ok(isRelative(u), `non-relative ref in index.html: ${u}`);
  for (const m of html.matchAll(/\bsrcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) assert.ok(isRelative(u), `non-relative srcset: ${u}`);
    }
  }
  const data = read('hr-simulator', 'game-data.js');
  const paths = [...data.matchAll(/['"]((?:[^'"\s]*\/)?[^'"\s/]+\.(?:webp|png|woff2|jpg|svg))['"]/g)].map((m) => m[1]);
  assert.ok(paths.length >= 10);
  for (const u of paths) {
    assert.ok(isRelative(u), `non-relative asset path in game-data.js: ${u}`);
    assert.ok(fs.existsSync(path.join(deploy, u)), `asset missing on disk: ${u}`);
  }
  const css = read('hr-simulator', 'styles.css');
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (m[1].startsWith('data:')) continue;
    assert.ok(isRelative(m[1]), `non-relative url() in styles.css: ${m[1]}`);
  }
});

test('guardExtraAllow is confined to smoke spec and fixtures', () => {
  const e2e = path.join(root, 'tests', 'e2e');
  const users = fs.readdirSync(e2e)
    .filter((f) => /\.(mjs|js)$/.test(f))
    .filter((f) => fs.readFileSync(path.join(e2e, f), 'utf8').includes('guardExtraAllow'))
    .sort();
  assert.deepEqual(users, ['fixtures.mjs', 'smoke.spec.mjs']);
});
