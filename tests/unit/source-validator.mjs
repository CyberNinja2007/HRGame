// Field-exact source-fidelity validator for window.GAME_DATA (dev-only, no dependencies).
//
// validateSources(data, fixture, specText, refText) -> string[]   (empty array = accepted)
//
// Every player-visible string in `data` must fall into exactly ONE class:
//   * locators  - the value equals one exact fragment (selector `sel`) of one line of SPEC.md / the Russian reference;
//   * pinned    - the value equals an exact expected string stored in the fixture;
//   * authored  - a prompt / feedback / non-good reaction / the D12 good reaction (pattern-authored),
//                 or a bridging line listed in `fixture.authored` with a reason (Gate C: at most 3).
//
// Fragment selectors (all 0-based, applied to exactly one source line, no fallback to other candidates):
//   {quote:i}   i-th top-level balanced «...» span, inner text. Nested «» and „“ belong to the enclosing span.
//               If the closing » is immediately followed by "." and the inner text has no terminal . ! ? …,
//               that period is part of the fragment (Russian shared quote/sentence period).
//   {bold:i}    i-th **...** span, inner text (an outer «» pair wrapping the whole span is stripped).
//   {option:true} text after the option marker "**Х.** " to end of line, verbatim. If the whole text is one
//               «...» span (optionally followed by "."), it is unwrapped exactly like {quote} (same period rule).
//   {line:true} the whole line without leading ">" / "- " / whitespace and without "**". Error if it holds «...».

const SKIP_KEYS = new Set(['id', 'src', 'srcSmall', 'portrait', 'avatar', 'background', 'speaker', 'kind', 'version', 'order']);
const OPEN = '«';
const CLOSE = '»';

export function normalize(s) {
  return String(s)
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[„“”"]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripOuterQuotes(s) {
  const t = String(s);
  const spans = topLevelSpans(t);
  if (spans.length === 1 && spans[0].start === 0 && spans[0].end === t.length - 1) {
    return t.slice(1, -1);
  }
  return t;
}

function topLevelSpans(text) {
  const spans = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === OPEN) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === CLOSE && depth > 0) {
      depth--;
      if (depth === 0) spans.push({ start, end: i });
    }
  }
  return spans;
}

function spanFragment(text, span) {
  const inner = text.slice(span.start + 1, span.end);
  const sharedPeriod = text[span.end + 1] === '.' && !/[.!?…]$/.test(inner.trimEnd());
  return sharedPeriod ? inner + '.' : inner;
}

function extractFragment(line, sel) {
  if (!sel || typeof sel !== 'object') return { error: 'selector is missing' };
  const keys = Object.keys(sel);
  if (keys.length !== 1) return { error: `selector must have exactly one key, got ${JSON.stringify(sel)}` };
  const key = keys[0];
  const val = sel[key];
  if (key === 'quote') {
    if (!Number.isInteger(val) || val < 0) return { error: `invalid quote index ${JSON.stringify(val)}` };
    const spans = topLevelSpans(line);
    if (val >= spans.length) return { error: `quote:${val} does not exist (line has ${spans.length} top-level «» spans)` };
    return { fragment: spanFragment(line, spans[val]) };
  }
  if (key === 'bold') {
    if (!Number.isInteger(val) || val < 0) return { error: `invalid bold index ${JSON.stringify(val)}` };
    const found = [...line.matchAll(/\*\*(.+?)\*\*/g)];
    if (val >= found.length) return { error: `bold:${val} does not exist (line has ${found.length} bold spans)` };
    return { fragment: stripOuterQuotes(found[val][1]) };
  }
  if (key === 'option') {
    if (val !== true) return { error: 'option selector must be {"option": true}' };
    const m = line.match(/^\s*(?:>\s*)?\*\*([АБВ])\.\*\*\s+(.*?)\s*$/);
    if (!m) return { error: 'no option marker "**Х.** " on the line' };
    const rest = m[2];
    const spans = topLevelSpans(rest);
    const wholeWrapped =
      spans.length === 1 && spans[0].start === 0 && (spans[0].end === rest.length - 1 || (spans[0].end === rest.length - 2 && rest[rest.length - 1] === '.'));
    return { fragment: wholeWrapped ? spanFragment(rest, spans[0]) : rest, letter: m[1] };
  }
  if (key === 'line') {
    if (val !== true) return { error: 'line selector must be {"line": true}' };
    if (/[«»]/.test(line)) return { error: 'line selector used on a line that contains «...»' };
    const fragment = line
      .replace(/\*\*/g, '')
      .replace(/^[\s>]*/, '')
      .replace(/^-\s+/, '')
      .trim();
    return { fragment };
  }
  return { error: `unknown selector key "${key}"` };
}

function splitLines(text) {
  return String(text).split(/\r?\n/);
}

function findFrom(lines, re, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}

function nthMatch(lines, re, n) {
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]) && ++seen === n) return i;
  }
  return -1;
}

// Returns {from, to} (1-based, inclusive) or null.
function range(lines, startIdx, endRe, includeStartInSearch = false) {
  if (startIdx < 0) return null;
  let end = lines.length;
  for (let i = startIdx + (includeStartInSearch ? 0 : 1); i < lines.length; i++) {
    if (endRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { from: startIdx + 1, to: end };
}

const INTRO_LETTER = { company: 'A', role: 'B', cast: 'C', lead: 'D' };
const ROMAN = ['I', 'II', 'III'];

// Determines which source section a data path is allowed to cite, or an error string.
function sectionFor(path, src, specLines, refLines) {
  let m;
  const intro = (letter) => range(specLines, findFrom(specLines, new RegExp(`^### Intro ${letter}\\b`)), /^#{2,3} /);
  if ((m = path.match(/^intro\.(company|role|lead)\./))) {
    if (src !== 'SPEC') return { error: `${path}: intro text may only cite SPEC` };
    return { range: intro(INTRO_LETTER[m[1]]), name: `SPEC Intro ${INTRO_LETTER[m[1]]}` };
  }
  if (/^characters\.[a-z]+\.(name|role)$/.test(path)) {
    if (src !== 'SPEC') return { error: `${path}: cast names and roles may only cite SPEC` };
    return { range: intro('C'), name: 'SPEC Intro C' };
  }
  if ((m = path.match(/^phases\[(\d+)\]\.title$/))) {
    if (src !== 'SPEC') return { error: `${path}: phase titles may only cite SPEC` };
    const at = nthMatch(specLines, /^### Phase /, Number(m[1]));
    return { range: range(specLines, at, /^\*\*Decision |^#{2,3} /), name: `SPEC Phase ${ROMAN[m[1]]} header` };
  }
  if ((m = path.match(/^phases\[(\d+)\]\.transition\.text$/))) {
    if (src !== 'SPEC') return { error: `${path}: transitions may only cite SPEC` };
    const at = nthMatch(specLines, /^\*\*Phase transition/, Number(m[1]));
    return { range: range(specLines, at, /^\*\*Decision |^#{2,3} /), name: `SPEC phase transition ${Number(m[1]) + 1}` };
  }
  if ((m = path.match(/^offer\.lines\[\d+\]$/))) {
    if (src !== 'SPEC') return { error: `${path}: offer lines may only cite SPEC` };
    return { range: range(specLines, findFrom(specLines, /^\*\*Show the actual offer card/), /^#{1,3} /), name: 'SPEC offer card' };
  }
  if (/^ending\./.test(path)) {
    if (src !== 'SPEC') return { error: `${path}: ending text may only cite SPEC` };
    return { range: range(specLines, findFrom(specLines, /^## 7\./), /^## /), name: 'SPEC ending' };
  }
  return { error: `${path}: no source section is defined for this path (it must be pinned or authored)` };
}

function decisionRange(src, n, specLines, refLines) {
  if (src === 'SPEC') {
    return range(specLines, findFrom(specLines, new RegExp(`^\\*\\*Decision ${n}\\b`)), /^\*\*Decision |^#{2,3} |^\*\*Phase transition/);
  }
  return range(refLines, findFrom(refLines, new RegExp(`^## Решение ${n}/12\\.`)), /^#{1,2} /);
}

function decisionOrdinals(data) {
  const map = new Map(); // "p:s" -> ordinal 1..12
  let n = 0;
  (data.phases || []).forEach((phase, p) => (phase.scenes || []).forEach((_scene, s) => map.set(`${p}:${s}`, ++n)));
  return map;
}

function enumerateStrings(value, path, out) {
  if (typeof value === 'string') {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => enumerateStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(k)) continue;
      enumerateStrings(v, path ? `${path}.${k}` : k, out);
    }
  }
}

export function enumeratePlayerStrings(data) {
  const out = [];
  enumerateStrings(data, '', out);
  return out;
}

function getAt(data, path) {
  const parts = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map((m) => (m[2] !== undefined ? Number(m[2]) : m[1]));
  let cur = data;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

// Pattern-authored paths (no fixture entry needed).
function isPatternAuthored(path, data, ordinals) {
  let m;
  if (/^phases\[\d+\]\.scenes\[\d+\]\.prompt$/.test(path)) return true;
  if (/^phases\[\d+\]\.scenes\[\d+\]\.choices\[\d+\]\.feedback$/.test(path)) return true;
  if ((m = path.match(/^phases\[(\d+)\]\.scenes\[(\d+)\]\.choices\[(\d+)\]\.reaction\[\d+\]\.text$/))) {
    const choice = data.phases?.[m[1]]?.scenes?.[m[2]]?.choices?.[m[3]];
    if (!choice) return false;
    if (choice.kind !== 'good') return true;
    return ordinals.get(`${m[1]}:${m[2]}`) === 12; // the single D12 good-reaction policy
  }
  return false;
}

export function validateSources(data, fixture, specText, refText) {
  const errors = [];
  const specLines = splitLines(specText);
  const refLines = splitLines(refText);
  const sources = { SPEC: specLines, REF: refLines };
  const locators = fixture?.locators || {};
  const pinned = fixture?.pinned || {};
  const overrides = fixture?.overrides || [];
  const authored = fixture?.authored || [];
  const ordinals = decisionOrdinals(data);
  const strings = enumeratePlayerStrings(data);
  const present = new Map(strings.map((s) => [s.path, s.value]));

  // --- Gate C and authored list shape
  if (authored.length > 3) errors.push(`Gate C: ${authored.length} authored bridging lines listed (maximum 3)`);
  for (const a of authored) {
    if (!a || typeof a.path !== 'string' || typeof a.reason !== 'string' || !a.reason.trim()) {
      errors.push(`authored entry needs a path and a non-empty reason: ${JSON.stringify(a)}`);
    }
  }
  const authoredPaths = authored.map((a) => a?.path);

  // --- Fixture paths must exist in the data
  for (const p of Object.keys(locators)) if (!present.has(p)) errors.push(`fixture locator path does not exist in data: ${p}`);
  for (const p of Object.keys(pinned)) if (!present.has(p)) errors.push(`fixture pinned path does not exist in data: ${p}`);
  for (const p of authoredPaths) if (!present.has(p)) errors.push(`fixture authored path does not exist in data: ${p}`);
  for (const p of overrides) if (!present.has(p)) errors.push(`fixture override path does not exist in data: ${p}`);

  // --- Coverage: each player-visible path in exactly one class
  for (const { path } of strings) {
    const classes = [];
    if (Object.hasOwn(locators, path)) classes.push('locator');
    if (Object.hasOwn(pinned, path)) classes.push('pinned');
    if (authoredPaths.includes(path)) classes.push('authored-list');
    if (isPatternAuthored(path, data, ordinals)) classes.push('authored-pattern');
    if (classes.length === 0) errors.push(`unclassified player-visible string: ${path}`);
    else if (classes.length > 1) errors.push(`double-classified string: ${path} (${classes.join(' + ')})`);
  }

  // --- Overrides must be SPEC locators
  for (const p of overrides) {
    if (!Object.hasOwn(locators, p)) errors.push(`override ${p} has no locator`);
    else if (locators[p].src !== 'SPEC') errors.push(`override ${p} must cite SPEC, found ${locators[p].src}`);
  }

  // --- Pinned values
  for (const [p, expected] of Object.entries(pinned)) {
    if (!present.has(p)) continue;
    if (normalize(present.get(p)) !== normalize(expected)) {
      errors.push(`pinned mismatch at ${p}: expected «${expected}», got «${present.get(p)}»`);
    }
  }

  // --- Locators
  for (const [p, loc] of Object.entries(locators)) {
    if (!present.has(p)) continue;
    const value = present.get(p);
    if (!loc || (loc.src !== 'SPEC' && loc.src !== 'REF')) {
      errors.push(`${p}: locator src must be SPEC or REF`);
      continue;
    }
    const lines = sources[loc.src];
    if (!Number.isInteger(loc.line) || loc.line < 1 || loc.line > lines.length) {
      errors.push(`${p}: locator line ${JSON.stringify(loc.line)} is outside ${loc.src}`);
      continue;
    }

    // Section check
    let sec;
    const sceneMatch = p.match(/^phases\[(\d+)\]\.scenes\[(\d+)\]\./);
    if (sceneMatch) {
      const n = ordinals.get(`${sceneMatch[1]}:${sceneMatch[2]}`);
      sec = { range: decisionRange(loc.src, n, specLines, refLines), name: `${loc.src} decision ${n}` };
    } else {
      sec = sectionFor(p, loc.src, specLines, refLines);
      if (sec.error) {
        errors.push(sec.error);
        continue;
      }
    }
    if (!sec.range) {
      errors.push(`${p}: section ${sec.name} was not found in ${loc.src}`);
      continue;
    }
    if (loc.line < sec.range.from || loc.line > sec.range.to) {
      errors.push(`${p}: ${loc.src} line ${loc.line} lies outside ${sec.name} (lines ${sec.range.from}-${sec.range.to})`);
      continue;
    }

    // Fragment
    const line = lines[loc.line - 1];
    const ex = extractFragment(line, loc.sel);
    if (ex.error) {
      errors.push(`${p}: ${loc.src}:${loc.line} ${ex.error}`);
      continue;
    }
    if (normalize(stripOuterQuotes(value)) !== normalize(ex.fragment)) {
      errors.push(`${p}: value does not equal ${loc.src}:${loc.line} ${JSON.stringify(loc.sel)}; expected «${ex.fragment}», got «${value}»`);
      continue;
    }

    // Option letter must belong to the choice the text is assigned to
    const choiceText = p.match(/\.choices\[(\d+)\]\.text$/);
    if (choiceText) {
      const choiceId = getAt(data, p.replace(/\.text$/, '.id'));
      const letter = ex.letter ?? line.match(/^\s*-\s+\*\*([АБВ])(?=[\s.(])/)?.[1];
      if (!letter) errors.push(`${p}: ${loc.src}:${loc.line} carries no option letter (А/Б/В)`);
      else if (letter !== choiceId) errors.push(`${p}: ${loc.src}:${loc.line} is option ${letter}, but the choice is ${choiceId}`);
    }
  }

  return errors;
}
