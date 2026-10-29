import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSources, enumeratePlayerStrings } from './source-validator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dataFile = path.join(root, 'hr-simulator', 'game-data.js');
const specText = fs.readFileSync(path.join(root, 'HR_Simulator_Static_HTML_Starter_Pack', 'SPEC.md'), 'utf8');
const refText = fs.readFileSync(path.join(root, 'HR_Simulator_Static_HTML_Starter_Pack', 'STORY_REFERENCE_RU.md'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests', 'fixtures', 'source-fixture.json'), 'utf8'));

function loadData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(dataFile, 'utf8'), sandbox, { filename: dataFile });
  // Re-create the data in this realm so prototypes match for deep equality.
  return JSON.parse(JSON.stringify(sandbox.window.GAME_DATA));
}

const data = loadData();
const clone = (v) => structuredClone(v);
const scenes = data.phases.flatMap((phase) => phase.scenes);
const choices = scenes.flatMap((scene) => scene.choices.map((choice) => ({ scene, choice })));

// Pinned tables from the plan (Intent Diff).
const CORRECT = ['Б', 'А', 'В', 'Б', 'А', 'Б', 'В', 'А', 'Б', 'В', 'А', 'Б']; // 1Б 2А 3В 4Б 5А 6Б 7В 8А 9Б 10В 11А 12Б
const KINDS = [
  ['improve', 'good', 'risky'], // D1  А improve, Б good,  В risky
  ['good', 'improve', 'risky'], // D2
  ['risky', 'risky', 'good'], //   D3
  ['risky', 'good', 'risky'], //   D4
  ['good', 'risky', 'risky'], //   D5
  ['improve', 'good', 'risky'], // D6
  ['risky', 'risky', 'good'], //   D7
  ['good', 'risky', 'risky'], //   D8
  ['risky', 'good', 'risky'], //   D9
  ['risky', 'risky', 'good'], //   D10
  ['good', 'risky', 'improve'], // D11 А good, Б risky, В improve
  ['risky', 'good', 'risky'] //    D12
];
// Speaker sequences of the scene lines and of the good reaction (null = narration).
const LINE_SPEAKERS = [
  ['gennady'], [null], ['gennady'], ['gennady'], ['gennady'],
  [null], ['pavel', 'gennady', null], ['pavel', 'gennady'], ['pavel', 'gennady', null, 'gennady'], ['gennady', 'pavel', 'gennady'],
  ['pavel', null], [null]
];
const GOOD_REACTION_SPEAKERS = [
  ['gennady'], ['gennady'], ['gennady'], ['gennady'], ['gennady'],
  ['maria', 'gennady'], ['gennady', 'pavel'], ['gennady'], ['gennady'], ['pavel', 'gennady'],
  ['elena', 'darya', 'pavel', 'oleg'], [null]
];
const D12_GOOD_REACTION = 'Мария отправляет Геннадию письменное предложение и просит подтвердить ответ письменно до 10 ноября.';

test('game-data.js passes node --check and loads in a bare vm context', () => {
  const res = spawnSync(process.execPath, ['--check', dataFile], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(typeof data, 'object');
  assert.equal(data.version, 1);
});

test('structure: 5/5/2 scenes, backgrounds, choice ids, offer and ending shape', () => {
  assert.deepEqual(data.phases.map((p) => p.scenes.length), [5, 5, 2]);
  assert.deepEqual(data.phases.map((p) => p.id), ['phone', 'onsite', 'offer']);
  assert.deepEqual(data.phases.map((p) => p.background), ['office', 'meeting_room', 'office']);
  assert.deepEqual(data.phases.map((p) => (p.transition ? true : false)), [true, true, false]);
  assert.deepEqual(scenes.map((s) => s.id), Array.from({ length: 12 }, (_, i) => `d${String(i + 1).padStart(2, '0')}`));
  for (const scene of scenes) {
    assert.deepEqual(scene.choices.map((c) => c.id), ['А', 'Б', 'В'], scene.id);
    assert.ok(scene.lines.length >= 1, `${scene.id} needs at least one line`);
    assert.ok(scene.prompt.trim().length > 0, `${scene.id} prompt`);
  }
  assert.equal(data.offer.lines.length, 9);
  assert.equal(data.ending.background, 'victory');
  assert.deepEqual(data.intro.cast.order, ['maria', 'gennady', 'pavel', 'elena', 'oleg', 'darya']);
  assert.deepEqual(Object.keys(data.characters).sort(), [...data.intro.cast.order].sort());
  assert.equal(data.intro.lead.lines.length, 2);
  assert.deepEqual(data.intro.lead.lines.map((l) => l.speaker), [null, 'maria']);
  assert.equal(data.ending.message.speaker, 'gennady');
  assert.equal(data.intro.role.vacancy.length, 7);
});

test('assets referenced by the data exist on disk with relative paths', () => {
  const refs = [];
  for (const bg of Object.values(data.backgrounds)) refs.push(bg.src, bg.srcSmall);
  for (const c of Object.values(data.characters)) refs.push(c.portrait, c.avatar);
  assert.deepEqual(Object.keys(data.backgrounds).sort(), ['company', 'meeting_room', 'office', 'victory']);
  for (const ref of refs) {
    assert.match(ref, /^assets\/(backgrounds|characters|avatars)\/[a-z_]+(-836)?\.webp$/, ref);
    assert.ok(fs.existsSync(path.join(root, 'hr-simulator', ref)), `${ref} is missing`);
  }
  for (const [id, c] of Object.entries(data.characters)) {
    assert.equal(c.portrait, `assets/characters/${id}.webp`);
    assert.equal(c.avatar, `assets/avatars/${id}.webp`);
  }
  for (const id of ['company', 'office', 'meeting_room', 'victory']) {
    assert.equal(data.backgrounds[id].src, `assets/backgrounds/${id}.webp`);
    assert.equal(data.backgrounds[id].srcSmall, `assets/backgrounds/${id}-836.webp`);
  }
  for (const phase of data.phases) assert.ok(data.backgrounds[phase.background], phase.id);
});

test('correctness is derived only from kind === good and equals the pinned table', () => {
  scenes.forEach((scene, i) => {
    const good = scene.choices.filter((c) => c.kind === 'good');
    assert.equal(good.length, 1, `${scene.id}: exactly one good choice`);
    assert.equal(good[0].id, CORRECT[i], `${scene.id}: correct option`);
    for (const c of scene.choices) assert.ok(!('correct' in c) && !('score' in c) && !('points' in c), `${scene.id}${c.id}`);
  });
});

test('kinds equal the Intent Diff map and map to the three feedback headings', () => {
  scenes.forEach((scene, i) => assert.deepEqual(scene.choices.map((c) => c.kind), KINDS[i], scene.id));
  assert.deepEqual(data.ui.feedbackHeadings, {
    good: 'Почему это хороший выбор',
    improve: 'Что можно улучшить',
    risky: 'Почему это рискованно'
  });
  assert.deepEqual(Object.keys(data.ui.feedbackHeadings).sort(), ['good', 'improve', 'risky']);
  assert.equal(choices.filter((c) => c.choice.kind === 'good').length, 12);
  assert.equal(choices.filter((c) => c.choice.kind === 'improve').length, 4);
  assert.equal(choices.filter((c) => c.choice.kind === 'risky').length, 20);
});

test('speakers: line and good-reaction speaker sequences are pinned; all speakers are known ids or null', () => {
  const known = new Set([...Object.keys(data.characters), null]);
  scenes.forEach((scene, i) => {
    assert.deepEqual(scene.lines.map((l) => l.speaker), LINE_SPEAKERS[i], `${scene.id} lines`);
    const good = scene.choices.find((c) => c.kind === 'good');
    assert.deepEqual(good.reaction.map((r) => r.speaker), GOOD_REACTION_SPEAKERS[i], `${scene.id} good reaction`);
    for (const c of scene.choices) for (const r of c.reaction) assert.ok(known.has(r.speaker), `${scene.id}${c.id}: ${r.speaker}`);
  });
});

test('36 feedback texts: unique, 80-450 chars, 2-4 sentences, Russian, no grading words', () => {
  const texts = choices.map(({ choice }) => choice.feedback);
  assert.equal(texts.length, 36);
  assert.equal(new Set(texts).size, 36, 'feedback texts must be unique');
  const grading = /балл|оценк|правильн|неправильн|неверн|ошибк|ошибоч|провал|штраф|неудач|рейтинг|поздравля|молодец/i;
  for (const { scene, choice } of choices) {
    const t = choice.feedback;
    const label = `${scene.id}${choice.id}`;
    assert.ok(t.length >= 80 && t.length <= 450, `${label}: length ${t.length}`);
    const sentences = (t.match(/[.!?…]+(?=\s|$)/g) || []).length;
    assert.ok(sentences >= 2 && sentences <= 4, `${label}: ${sentences} sentences`);
    assert.match(t, /[А-Яа-яЁё]/, label);
    assert.ok(!grading.test(t), `${label}: grading wording`);
  }
});

test('reactions: wrong reactions are 1-2 unique non-empty lines; good reactions come from the data', () => {
  const seen = new Set();
  for (const { scene, choice } of choices) {
    const label = `${scene.id}${choice.id}`;
    assert.ok(Array.isArray(choice.reaction) && choice.reaction.length >= 1, `${label}: reaction required`);
    for (const r of choice.reaction) assert.ok(typeof r.text === 'string' && r.text.trim().length > 0, label);
    if (choice.kind === 'good') continue;
    assert.ok(choice.reaction.length <= 2, `${label}: wrong reactions are at most two lines`);
    for (const r of choice.reaction) {
      assert.ok(!seen.has(r.text), `${label}: duplicate wrong reaction`);
      seen.add(r.text);
    }
  }
  assert.equal(seen.size >= 24, true);
  for (const scene of scenes) assert.ok(!('success' in scene) && !('successReaction' in scene), scene.id);
});

test('D12 authored good reaction is exact narration and implies no acceptance', () => {
  const d12 = scenes[11];
  const good = d12.choices.find((c) => c.kind === 'good');
  assert.deepEqual(good.reaction, [{ speaker: null, text: D12_GOOD_REACTION }]);
  assert.ok(!/принят|принима|согласил/i.test(good.reaction.map((r) => r.text).join(' ')));
  assert.ok(!/принят|принима|согласил/i.test(d12.lines.map((l) => l.text).join(' ')), 'D12 lines must not imply acceptance either');
  // acceptance appears only in the ending
  const before = JSON.stringify({ intro: data.intro, phases: data.phases, offer: data.offer });
  assert.ok(!/готов его принять|Оффер принят/.test(before));
  assert.match(data.ending.message.text, /готов его принять/);
});

test('choice and line texts are unique inside a scene; offer lines unique', () => {
  for (const scene of scenes) {
    const texts = scene.choices.map((c) => c.text);
    assert.equal(new Set(texts).size, 3, scene.id);
    const all = [...scene.lines.map((l) => l.text), ...texts];
    assert.equal(new Set(all).size, all.length, `${scene.id}: repeated text`);
  }
  assert.equal(new Set(data.offer.lines).size, 9);
});

test('money formatting: NBSP between digit groups and before the ruble sign', () => {
  const NBSP = '\u00a0';
  for (const { path: p, value } of enumeratePlayerStrings(data)) {
    assert.ok(!/\d \d{3}(?!\d)/.test(value), `${p}: digit group separated by a plain space`);
    assert.ok(!/ ₽/.test(value), `${p}: plain space before ₽`);
    if (value.includes('₽')) assert.ok(value.includes(`${NBSP}₽`), p);
  }
  assert.ok(data.offer.lines[1].includes(`160${NBSP}000${NBSP}₽`));
  assert.ok(data.phases[0].scenes[3].choices[1].text.includes(`134${NBSP}850`));
});

test('typography: no straight quotes, no double spaces, no hyphen used as a dash', () => {
  for (const { path: p, value } of enumeratePlayerStrings(data)) {
    assert.ok(!/"/.test(value), `${p}: straight double quote`);
    assert.ok(!/ - /.test(value), `${p}: spaced hyphen instead of em dash`);
    assert.ok(!/ {2,}/.test(value), `${p}: double space`);
    assert.equal(value, value.trim(), `${p}: untrimmed`);
  }
});

test('positive acceptance: the complete data set satisfies the field-exact source validator', () => {
  const errors = validateSources(data, fixture, specText, refText);
  assert.deepEqual(errors, []);
});

test('fixture: Gate C holds and the D12 bridging line is the only authored list entry', () => {
  assert.ok(fixture.authored.length <= 3);
  assert.deepEqual(fixture.authored.map((a) => a.path), ['phases[2].scenes[1].lines[0].text']);
  for (const a of fixture.authored) assert.ok(a.reason.length > 20);
  for (const p of fixture.overrides) assert.equal(fixture.locators[p].src, 'SPEC', p);
});

// ---------------------------------------------------------------- negative mutations
function mutate(fn, fixtureFn) {
  const d = clone(data);
  const f = clone(fixture);
  fn?.(d);
  fixtureFn?.(f);
  return validateSources(d, f, specText, refText);
}
const D1 = (d) => d.phases[0].scenes[0];

test('mutation (i): D1 good reaction replaced by the reference wording fails', () => {
  const errors = mutate((d) => {
    D1(d).choices[1].reaction[0].text = 'Да, Мария, здравствуйте. Помню нашу переписку. Сейчас удобно';
  });
  assert.ok(errors.some((e) => e.startsWith('phases[0].scenes[0].choices[1].reaction[0].text')), errors.join('\n'));
});

test('mutation (ii): a D2 option truncated by its last word fails', () => {
  const errors = mutate((d) => {
    const c = d.phases[0].scenes[1].choices[1];
    c.text = c.text.replace(/\s*\S+$/, '').replace(/[?.!]*$/, '?');
  });
  assert.ok(errors.some((e) => e.startsWith('phases[0].scenes[1].choices[1].text')), errors.join('\n'));
});

test('mutation (iii): D3 В text replaced by the D4 Б text fails', () => {
  const errors = mutate((d) => {
    d.phases[0].scenes[2].choices[2].text = d.phases[0].scenes[3].choices[1].text;
  });
  assert.ok(errors.some((e) => e.startsWith('phases[0].scenes[2].choices[2].text')), errors.join('\n'));
});

test('mutation (iv): an unlocated new line added to D5 fails', () => {
  const errors = mutate((d) => {
    d.phases[0].scenes[4].lines.push({ speaker: 'gennady', text: 'Ещё один вопрос, которого нет в источниках.' });
  });
  assert.ok(errors.some((e) => e.includes('unclassified') && e.includes('phases[0].scenes[4].lines[1].text')), errors.join('\n'));
});

test('mutation (v): the D1 А locator switched to src REF fails', () => {
  const errors = mutate(null, (f) => {
    f.locators['phases[0].scenes[0].choices[0].text'].src = 'REF';
  });
  assert.ok(errors.some((e) => e.startsWith('phases[0].scenes[0].choices[0].text')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('override phases[0].scenes[0].choices[0].text must cite SPEC')), errors.join('\n'));
});

test('mutation (vi): D1 good-option quote substituted into the same-line good-reaction field fails', () => {
  const fx = fixture.locators;
  const optionLoc = fx['phases[0].scenes[0].choices[1].text'];
  const reactionLoc = fx['phases[0].scenes[0].choices[1].reaction[0].text'];
  assert.equal(optionLoc.line, reactionLoc.line, 'precondition: option and reaction share one SPEC line');
  assert.deepEqual([optionLoc.sel, reactionLoc.sel], [{ quote: 0 }, { quote: 1 }]);
  const errors = mutate((d) => {
    D1(d).choices[1].reaction[0].text = D1(d).choices[1].text;
  });
  assert.ok(errors.some((e) => e.startsWith('phases[0].scenes[0].choices[1].reaction[0].text')), errors.join('\n'));
  assert.equal(errors.length, 1, 'only the swapped field is reported');
});

test('mutation (vii): cast name swap fails', () => {
  const errors = mutate((d) => {
    d.characters.pavel.name = 'Олег Белов';
  });
  assert.ok(errors.some((e) => e.startsWith('characters.pavel.name')), errors.join('\n'));
});

test('mutation (viii): pinned dateLabel drift fails', () => {
  const errors = mutate((d) => {
    d.phases[1].dateLabel = 'Четверг, 5 ноября 2026 · 16:00';
  });
  assert.ok(errors.some((e) => e.startsWith('pinned mismatch at phases[1].dateLabel')), errors.join('\n'));
});

test('validator hardening: selector, section, coverage and Gate C errors', () => {
  const sel = (p) => (f) => delete f.locators[p].sel;
  assert.ok(mutate(null, sel('intro.company.title')).some((e) => e.includes('selector is missing')));
  assert.ok(mutate(null, (f) => { f.locators['intro.company.title'].sel = { quote: 7 }; }).some((e) => e.includes('quote:7 does not exist')));
  // a line selector on a line that contains «...» is an error, with no fallback
  assert.ok(mutate(null, (f) => { f.locators['phases[0].scenes[0].lines[0].text'].sel = { line: true }; }).some((e) => e.includes('line selector used on a line that contains')));
  // option selector without a marker
  assert.ok(mutate(null, (f) => { f.locators['phases[0].scenes[0].choices[0].text'].sel = { option: true }; }).some((e) => e.includes('no option marker')));
  // a locator line outside its section (D2 option cited from the D3 line)
  assert.ok(mutate(null, (f) => { f.locators['phases[0].scenes[1].choices[0].text'].line = 142; }).some((e) => e.includes('lies outside SPEC decision 2')));
  // option of the right text on the wrong letter line
  assert.ok(mutate(
    (d) => { d.phases[0].scenes[0].choices[0].text = d.phases[0].scenes[0].choices[2].text; },
    (f) => { f.locators['phases[0].scenes[0].choices[0].text'].line = 134; }
  ).some((e) => e.includes('is option В, but the choice is А')));
  // double classification and non-existent fixture paths
  assert.ok(mutate(null, (f) => { f.pinned['phases[0].scenes[0].prompt'] = D1(data).prompt; }).some((e) => e.includes('double-classified')));
  assert.ok(mutate(null, (f) => { f.pinned['ui.nonexistent'] = 'х'; }).some((e) => e.includes('does not exist in data')));
  assert.ok(mutate((d) => { d.ui.extraLabel = 'Новая кнопка'; }).some((e) => e.includes('unclassified player-visible string: ui.extraLabel')));
  // a fragment that is only a prefix of the located quote is rejected (no containment matching)
  assert.ok(mutate((d) => { d.intro.company.text = 'Небольшая IT-компания разрабатывает программы для логистики и складов.'; }).some((e) => e.startsWith('intro.company.text')));
  // Gate C
  assert.ok(mutate(null, (f) => {
    for (const p of ['phases[0].scenes[0].lines[0].text', 'phases[0].scenes[1].lines[0].text', 'phases[0].scenes[2].lines[0].text']) {
      delete f.locators[p];
      f.overrides = f.overrides.filter((o) => o !== p);
      f.authored.push({ path: p, reason: 'bridging line used to exceed the limit' });
    }
  }).some((e) => e.includes('Gate C')));
  // override must be SPEC
  assert.ok(mutate(null, (f) => { f.overrides.push('phases[0].scenes[1].lines[0].text'); }).some((e) => e.includes('must cite SPEC')));
});

// ---------------------------------------------------------------- lexicon / language scans
const ALLOWED_FRACTIONS = new Set(['5/2', '24/7']);
const SCORING = /балл|очк(о|и|ов)\b|рейтинг|достижени|оценк[аиу] (игрока|прохождения)|правильн\w* ответ|\d+\s*из\s*\d+|итог\w* балл|статистик/i;
const LATIN_ALLOWLIST = new Set([
  'HR', 'IT', 'AI', 'IP', 'ChatGPT', 'Copilot', 'Windows', 'Server', 'Active', 'Directory', 'AD', 'VPN', 'DNS',
  'nslookup', 'PowerShell', 'MikroTik', 'Linux', 'Kubernetes', 'Go', 'BGP', 'GPO', 'CSV', 'gross'
]);

test('no scoring vocabulary and no fractions other than 5/2 and 24/7 in any player-visible string', () => {
  const strings = enumeratePlayerStrings(data);
  assert.ok(strings.length > 200);
  for (const { path: p, value } of strings) {
    assert.ok(!SCORING.test(value), `${p}: scoring wording «${value.match(SCORING)?.[0]}»`);
    for (const frac of value.match(/\d+\s*\/\s*\d+/g) || []) assert.ok(ALLOWED_FRACTIONS.has(frac), `${p}: fraction ${frac}`);
  }
  assert.ok(strings.some((s) => s.value.includes('5/2')) && strings.some((s) => s.value.includes('24/7')), 'allowlisted fractions are really used');
  // the data model carries no score fields at all
  const keys = new Set();
  JSON.stringify(data, (k, v) => (keys.add(k), v));
  for (const bad of ['score', 'points', 'correct', 'grade', 'rating', 'result', 'results']) assert.ok(!keys.has(bad), bad);
  // the allowed fractions only appear where the sources have them
  assert.ok(!/«?\d+\s*\/\s*\d+/.test(data.ui.feedbackHeadings.good));
});

test('Russian-only: every string has Cyrillic and Latin tokens stay inside the allowlist', () => {
  const used = new Set();
  for (const { path: p, value } of enumeratePlayerStrings(data)) {
    assert.match(value, /[А-Яа-яЁё]/, `${p}: no Cyrillic`);
    for (const word of value.match(/[A-Za-z][A-Za-z0-9]*/g) || []) {
      assert.ok(LATIN_ALLOWLIST.has(word), `${p}: Latin word «${word}» is not allowlisted`);
      used.add(word);
    }
  }
  // the allowlist is finalized from the data: nothing in it is unused
  assert.deepEqual([...LATIN_ALLOWLIST].filter((w) => !used.has(w)), []);
});
