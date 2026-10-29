/* HR Simulator: Срочная вакансия — game engine (vanilla, no modules, works from file://). */
(function () {
  'use strict';

  var DATA = window.GAME_DATA;
  var UI = DATA.ui;
  var SAVE_KEY = 'hrsim.save.v1';
  var CHARS_PER_SECOND = 48;
  var PRELOAD_RACE_MS = 300;
  var ARM_DELAY_MS = 250; // choices/feedback ignore input this long after appearing (stray double click or tap)
  var SWAP_READY_MS = 400; // longest wait for a new layer image before the crossfade starts anyway

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideQuery = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
  var smallBgQuery = window.matchMedia('(max-width: 899px)');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var stage = $('.stage');
  var panel = $('.panel');
  var el = {
    bg: Array.prototype.slice.call(document.querySelectorAll('.bg-layer')),
    speaker: Array.prototype.slice.call(document.querySelectorAll('.speaker-layer')),
    phase: $('.topbar-phase'),
    date: $('.topbar-date'),
    info: $('.topbar-info'),
    fullscreen: $('.fullscreen-btn'),
    speakerRow: $('.speaker-row'),
    avatar: $('.avatar'),
    speakerName: $('.speaker-name'),
    title: $('#panel-title'),
    subtitle: $('.subtitle'),
    dialogue: $('.dialogue'),
    content: $('.content'),
    prompt: $('#prompt'),
    choices: $('.choices'),
    feedback: $('.feedback'),
    feedbackTitle: $('#feedback-title'),
    reaction: $('.reaction'),
    explanation: $('.explanation'),
    feedbackBtn: $('.feedback-btn'),
    primary: $('#primary'),
    secondary: $('.btn.secondary'),
    live: $('.sr-live')
  };

  /* ---------------- storage (never throws) ---------------- */

  var memorySave = null;
  var storage = {
    read: function () {
      var raw = null;
      try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { raw = memorySave; }
      if (raw == null) return null;
      try {
        var v = JSON.parse(raw);
        if (v && v.v === 1 && Number.isInteger(v.step) && v.step >= 1 && v.step < steps.length - 1) return v.step;
      } catch (e) { /* corrupt value: removed below */ }
      storage.clear();
      return null;
    },
    write: function (step) {
      var raw = JSON.stringify({ v: 1, step: step });
      memorySave = raw;
      try { window.localStorage.setItem(SAVE_KEY, raw); } catch (e) { /* in-memory fallback */ }
    },
    clear: function () {
      memorySave = null;
      try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* in-memory fallback */ }
    }
  };

  /* ---------------- steps ---------------- */

  function buildSteps(data) {
    var list = [];
    var intro = data.intro;
    list.push({ type: 'intro-company', panel: 'dialogue', bg: 'company', title: intro.company.title, subtitle: intro.company.subtitle, lines: [{ speaker: null, text: intro.company.text }], action: UI.next });
    list.push({ type: 'intro-role', panel: 'card', bg: 'office', speaker: 'maria', title: intro.role.title });
    list.push({ type: 'intro-cast', panel: 'card', bg: 'office', title: UI.castTitle });
    list.push({ type: 'intro-lead', panel: 'dialogue', bg: 'office', lines: intro.lead.lines, action: UI.start });
    data.phases.forEach(function (phase) {
      phase.scenes.forEach(function (scene) {
        list.push({ type: 'scene', panel: 'dialogue', bg: phase.background, phase: phase, scene: scene, lines: scene.lines });
      });
      if (phase.transition) {
        list.push({ type: 'transition', panel: 'dialogue', bg: phase.background, phase: phase, title: phase.title, lines: [{ speaker: null, text: phase.transition.text }], action: UI.next });
      }
    });
    var last = data.phases[data.phases.length - 1];
    list.push({ type: 'offer', panel: 'card', bg: data.ending.background, phase: last, title: UI.offerTitle });
    list.push({ type: 'ending', panel: 'dialogue', bg: data.ending.background, date: data.ending.date, title: data.ending.title, lines: [data.ending.message, { speaker: null, text: data.ending.text }], action: UI.restart });
    return list;
  }

  var steps = buildSteps(DATA);

  var state = {
    step: 0,
    lineIndex: 0,
    phase: 'reading', // typing | reading | choosing | feedback | transitioning
    navToken: 0,
    resumeStep: null
  };

  /* ---------------- helpers ---------------- */

  function character(id) { return id ? DATA.characters[id] : null; }

  function bgSources(id) {
    var bg = DATA.backgrounds[id];
    return { src: bg.src, small: bg.srcSmall };
  }

  function currentBgUrl(id) {
    var s = bgSources(id);
    return smallBgQuery.matches ? s.small : s.src;
  }

  // Announcements made in the same turn are merged so none is lost (e.g. last line + prompt under reduced motion).
  var pendingAnnouncements = [];
  var announceTimer = 0;
  // While choices or the feedback button are arming, speech waits for the focus move: screen readers
  // cancel ongoing speech on focus change, which would cut off the line just announced.
  var announceHeld = false;
  function holdAnnouncements() {
    announceHeld = true;
    window.clearTimeout(announceTimer);
    announceTimer = 0;
  }
  function releaseAnnouncements() {
    announceHeld = false;
    if (!pendingAnnouncements.length || announceTimer) return;
    var batch = pendingAnnouncements;
    pendingAnnouncements = [];
    announce(batch.join(' '));
  }
  function announce(text) {
    if (!text) return;
    pendingAnnouncements.push(text);
    if (announceTimer || announceHeld) return;
    el.live.textContent = '';
    // Separate task so screen readers notice a change even for identical text.
    announceTimer = window.setTimeout(function () {
      el.live.textContent = pendingAnnouncements.join(' ');
      pendingAnnouncements = [];
      announceTimer = 0;
    }, 30);
  }

  // Runs fn once img has a decoded frame (or after SWAP_READY_MS), unless a newer swap on the same group started.
  function whenReady(group, img, fn) {
    var token = ++group.token;
    var done = false;
    var run = function () {
      if (done || token !== group.token) return;
      done = true;
      fn();
    };
    if (img.complete && img.naturalWidth > 0) { run(); return; }
    window.setTimeout(run, SWAP_READY_MS);
    img.addEventListener('load', run, { once: true });
    img.addEventListener('error', run, { once: true });
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function loadImage(url) {
    return new Promise(function (resolve) {
      if (!url) { resolve(); return; }
      var img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = function () { resolve(); };
      img.src = url;
      if (img.decode) img.decode().then(resolve, resolve);
    });
  }

  function stepImages(index) {
    var s = steps[index];
    if (!s) return [];
    var urls = [currentBgUrl(s.bg)];
    speakersOf(s).forEach(function (id) {
      var c = character(id);
      if (c) urls.push(wideQuery.matches ? c.portrait : c.avatar);
    });
    if (s.type === 'intro-cast') {
      DATA.intro.cast.order.forEach(function (id) {
        var c = character(id);
        urls.push(wideQuery.matches ? c.portrait : c.avatar);
      });
    }
    return urls;
  }

  function speakersOf(s) {
    var ids = [];
    if (s.speaker) ids.push(s.speaker);
    (s.lines || []).forEach(function (l) { if (l.speaker) ids.push(l.speaker); });
    if (s.scene) {
      s.scene.choices.forEach(function (c) { c.reaction.forEach(function (r) { if (r.speaker) ids.push(r.speaker); }); });
    }
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  }

  var preloaded = {};
  function preload(index) {
    stepImages(index).forEach(function (u) {
      if (preloaded[u]) return;
      preloaded[u] = true;
      loadImage(u);
    });
  }

  /* ---------------- background & speaker layers ---------------- */

  var activeBg = 0;
  var bgSwap = { token: 0 };
  var speakerSwap = { token: 0 };
  var activeBgId = 'company';

  function showBackground(id) {
    if (id === activeBgId) return;
    var next = el.bg[1 - activeBg];
    var sources = bgSources(id);
    var source = next.querySelector('source');
    var img = next.querySelector('img');
    var current = el.bg[activeBg];
    source.srcset = sources.small;
    img.src = sources.src;
    activeBgId = id;
    // The active index flips only when the swap happens, so a superseded swap reuses the same pending layer.
    whenReady(bgSwap, img, function () {
      next.classList.add('is-active');
      current.classList.remove('is-active');
      activeBg = 1 - activeBg;
    });
  }

  var activeSpeakerLayer = 0;
  var activeSpeaker = '';

  function setSrc(img, url) {
    if (img.getAttribute('src') !== url) img.src = url;
  }

  // Only the variant the current layout displays gets a src (cut-out in wide mode, avatar otherwise),
  // so phones never download portraits and no request is started and then cancelled.
  function showSpeaker(id) {
    id = id || '';
    stage.setAttribute('data-speaker', id);
    var c = character(id);
    var wide = wideQuery.matches;
    el.speakerRow.hidden = !c;
    el.speakerName.textContent = c ? c.name : '';
    if (c && !wide) setSrc(el.avatar, c.avatar);
    if (id === activeSpeaker) return;
    activeSpeaker = id;
    var current = el.speaker[activeSpeakerLayer];
    var next = el.speaker[1 - activeSpeakerLayer];
    if (!c) {
      speakerSwap.token++;
      el.speaker.forEach(function (n) { n.classList.remove('is-active'); });
      return;
    }
    var swap = function () {
      next.classList.add('is-active');
      current.classList.remove('is-active');
      activeSpeakerLayer = 1 - activeSpeakerLayer;
    };
    if (wide) {
      setSrc(next, c.portrait);
      whenReady(speakerSwap, next, swap);
    } else {
      speakerSwap.token++;
      swap();
    }
  }

  // Rotation or resize across the wide breakpoint: give the newly displayed variant its image.
  function onLayoutModeChange() {
    var c = character(activeSpeaker);
    if (!c) return;
    if (wideQuery.matches) setSrc(el.speaker[activeSpeakerLayer], c.portrait);
    else setSrc(el.avatar, c.avatar);
  }
  if (wideQuery.addEventListener) wideQuery.addEventListener('change', onLayoutModeChange);
  else if (wideQuery.addListener) wideQuery.addListener(onLayoutModeChange);

  /* ---------------- typewriter ---------------- */

  var typing = { raf: 0, text: '', shown: 0, start: 0, shownNode: null, restNode: null };

  function renderLine(line, instant) {
    window.cancelAnimationFrame(typing.raf);
    clear(el.dialogue);
    el.dialogue.classList.toggle('is-narration', !line.speaker);
    showSpeaker(line.speaker);
    typing.text = line.text;
    typing.shownNode = make('span', 'shown');
    typing.restNode = make('span', 'rest', line.text);
    el.dialogue.appendChild(typing.shownNode);
    el.dialogue.appendChild(typing.restNode);
    var c = character(line.speaker);
    announce((c ? c.name + ': ' : '') + line.text);
    var s = steps[state.step];
    el.primary.textContent = isLastLine() && s.action ? s.action : UI.next;
    el.primary.hidden = false;
    if (instant || reducedMotion.matches) {
      finishTyping();
      return;
    }
    state.phase = 'typing';
    typing.shown = 0;
    typing.start = performance.now();
    var tick = function (now) {
      var n = Math.max(0, Math.min(typing.text.length, Math.floor((now - typing.start) * CHARS_PER_SECOND / 1000)));
      if (n !== typing.shown) {
        typing.shown = n;
        typing.shownNode.textContent = typing.text.slice(0, n);
        typing.restNode.textContent = typing.text.slice(n);
      }
      if (n >= typing.text.length) { finishTyping(); return; }
      typing.raf = window.requestAnimationFrame(tick);
    };
    typing.raf = window.requestAnimationFrame(tick);
  }

  function finishTyping() {
    window.cancelAnimationFrame(typing.raf);
    typing.shownNode.textContent = typing.text;
    typing.restNode.textContent = '';
    state.phase = 'reading';
    afterLineComplete();
  }

  function isLastLine() {
    var s = steps[state.step];
    return !s.lines || state.lineIndex >= s.lines.length - 1;
  }

  function afterLineComplete() {
    var s = steps[state.step];
    if (s.type === 'scene' && isLastLine()) {
      revealChoices();
      return;
    }
    el.primary.textContent = isLastLine() && s.action ? s.action : UI.next;
    el.primary.hidden = false;
  }

  /* ---------------- choices & feedback ---------------- */

  function revealChoices() {
    var scene = steps[state.step].scene;
    state.phase = 'choosing';
    el.primary.hidden = true;
    el.prompt.textContent = scene.prompt;
    el.prompt.hidden = false;
    clear(el.choices);
    scene.choices.forEach(function (choice) {
      var b = make('button', 'choice');
      b.type = 'button';
      b.setAttribute('data-choice', choice.id);
      b.appendChild(make('span', 'choice-letter', choice.id));
      b.appendChild(make('span', 'choice-text', choice.text));
      b.addEventListener('click', function () { selectChoice(choice, b); });
      el.choices.appendChild(b);
    });
    el.choices.hidden = false;
    announce(scene.prompt);
    armChoices();
  }

  // Choices start disabled and become usable after ARM_DELAY_MS, so the second click of a double click
  // (or a second tap) on «Далее» / «Попробовать ещё раз» cannot land on an answer.
  var armTimer = 0;
  function armChoices() {
    var buttons = el.choices.querySelectorAll('.choice');
    Array.prototype.forEach.call(buttons, function (b) {
      b.disabled = true;
      b.removeAttribute('aria-current');
    });
    var token = state.navToken;
    window.clearTimeout(armTimer);
    el.choices.classList.add('is-arming');
    holdAnnouncements();
    armTimer = window.setTimeout(function () {
      el.choices.classList.remove('is-arming');
      if (token === state.navToken && state.phase === 'choosing') {
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
        if (buttons[0]) buttons[0].focus({ preventScroll: false });
      }
      releaseAnnouncements();
    }, ARM_DELAY_MS);
  }

  function armFeedbackButton() {
    el.feedbackBtn.disabled = true;
    var token = state.navToken;
    window.clearTimeout(armTimer);
    holdAnnouncements();
    armTimer = window.setTimeout(function () {
      if (token === state.navToken && state.phase === 'feedback') {
        el.feedbackBtn.disabled = false;
        el.feedbackBtn.focus({ preventScroll: true });
      }
      releaseAnnouncements();
    }, ARM_DELAY_MS);
  }

  function selectChoice(choice, button) {
    if (state.phase !== 'choosing') return;
    state.phase = 'feedback';
    Array.prototype.forEach.call(el.choices.querySelectorAll('.choice'), function (b) {
      b.disabled = true;
      b.removeAttribute('aria-current');
    });
    button.setAttribute('aria-current', 'true');

    var heading = UI.feedbackHeadings[choice.kind];
    el.feedback.setAttribute('data-kind', choice.kind);
    el.feedbackTitle.textContent = heading;
    clear(el.reaction);
    var spoken = [];
    var firstSpeaker = null;
    choice.reaction.forEach(function (r) {
      var p = make('p');
      var c = character(r.speaker);
      if (c) {
        if (!firstSpeaker) firstSpeaker = r.speaker;
        p.appendChild(make('b', null, c.name + ': '));
      }
      p.appendChild(document.createTextNode(r.text));
      el.reaction.appendChild(p);
      spoken.push((c ? c.name + ': ' : '') + r.text);
    });
    el.explanation.textContent = choice.feedback;
    var good = choice.kind === 'good';
    el.feedbackBtn.textContent = good ? UI.continue : UI.retry;
    el.feedbackBtn.setAttribute('data-action', good ? 'continue' : 'retry');
    el.feedback.hidden = false;
    if (firstSpeaker) showSpeaker(firstSpeaker);
    announce(heading + '. ' + spoken.join(' ') + ' ' + choice.feedback);
    el.feedback.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    armFeedbackButton();
  }

  function onFeedbackAction() {
    if (state.phase !== 'feedback') return;
    if (el.feedbackBtn.getAttribute('data-action') === 'continue') {
      go(state.step + 1);
      return;
    }
    el.feedback.hidden = true;
    var s = steps[state.step];
    showSpeaker(s.lines[s.lines.length - 1].speaker);
    state.phase = 'choosing';
    el.prompt.scrollIntoView({ block: 'nearest' });
    armChoices();
  }

  /* ---------------- step renderers ---------------- */

  function resetPanel() {
    el.title.textContent = '';
    el.title.classList.remove('is-quiet');
    el.subtitle.hidden = true;
    el.subtitle.textContent = '';
    clear(el.dialogue);
    clear(el.content);
    el.prompt.hidden = true;
    el.prompt.textContent = '';
    el.choices.hidden = true;
    clear(el.choices);
    el.feedback.hidden = true;
    el.secondary.hidden = true;
    el.primary.hidden = true;
    panel.scrollTop = 0;
  }

  function setHeader(s) {
    var phaseTitle = s.phase && s.type !== 'offer' ? s.phase.title : '';
    var date = s.date || (s.phase && s.type !== 'offer' ? s.phase.dateLabel : '');
    el.phase.textContent = phaseTitle;
    el.date.textContent = date;
    el.info.classList.toggle('is-empty', !phaseTitle && !date);
  }

  function renderCardRole(s) {
    var role = DATA.intro.role;
    el.content.appendChild(make('p', null, role.text));
    var list = make('ul', 'card-list');
    role.vacancy.forEach(function (row) {
      var li = make('li');
      li.appendChild(make('span', 'label', row.label + ': '));
      li.appendChild(document.createTextNode(row.value));
      list.appendChild(li);
    });
    el.content.appendChild(list);
    el.content.appendChild(make('p', 'notice', role.aiPolicy));
    announce(s.title + '. ' + role.text);
  }

  function renderCardCast(s) {
    var grid = make('ul', 'cast');
    DATA.intro.cast.order.forEach(function (id) {
      var c = character(id);
      var li = make('li');
      var fig = make('figure');
      var pic = make('picture');
      var source = make('source');
      source.media = '(min-width: 900px) and (min-height: 600px)';
      source.srcset = c.portrait;
      var img = make('img');
      img.src = c.avatar;
      img.alt = c.name;
      img.width = 543;
      img.height = 724;
      img.decoding = 'async';
      pic.appendChild(source);
      pic.appendChild(img);
      var cap = make('figcaption');
      cap.appendChild(make('h3', null, c.name));
      cap.appendChild(make('p', null, c.role));
      fig.appendChild(pic);
      fig.appendChild(cap);
      li.appendChild(fig);
      grid.appendChild(li);
    });
    el.content.appendChild(grid);
    announce(s.title);
  }

  function renderCardOffer(s) {
    var list = make('ul', 'card-list');
    DATA.offer.lines.forEach(function (line) { list.appendChild(make('li', null, line)); });
    el.content.appendChild(list);
    announce(s.title + '. ' + DATA.offer.lines.join('. '));
  }

  function renderStep(index, opts) {
    opts = opts || {};
    var s = steps[index];
    state.step = index;
    state.lineIndex = 0;
    stage.setAttribute('data-step-type', s.type);
    stage.setAttribute('data-panel', s.panel);
    resetPanel();
    setHeader(s);
    showBackground(s.bg);

    if (s.title) {
      el.title.textContent = s.title;
    } else {
      el.title.textContent = s.scene ? s.phase.title : '';
      el.title.classList.add('is-quiet');
    }
    if (s.subtitle) {
      el.subtitle.textContent = s.subtitle;
      el.subtitle.hidden = false;
    }

    if (s.panel === 'card') {
      showSpeaker(s.speaker || null);
      if (s.type === 'intro-role') renderCardRole(s);
      else if (s.type === 'intro-cast') renderCardCast(s);
      else renderCardOffer(s);
      state.phase = 'reading';
      el.primary.textContent = UI.next;
      el.primary.hidden = false;
      return;
    }

    if (s.title) announce(s.title);
    renderLine(s.lines[0], opts.instant);
    if (index === 0 && state.resumeStep != null) {
      // Resume screen: «Продолжить» resumes, «Начать заново» clears the save.
      window.cancelAnimationFrame(typing.raf);
      finishTypingSilently();
      el.primary.textContent = UI.resume;
      el.primary.hidden = false;
      el.secondary.textContent = UI.restart;
      el.secondary.hidden = false;
    }
  }

  function finishTypingSilently() {
    typing.shownNode.textContent = typing.text;
    typing.restNode.textContent = '';
    state.phase = 'reading';
  }

  /* ---------------- navigation ---------------- */

  function go(index) {
    if (index < 0 || index >= steps.length) return;
    var token = ++state.navToken;
    state.phase = 'transitioning';
    el.primary.disabled = true;
    el.secondary.disabled = true;
    el.feedbackBtn.disabled = true;
    panel.classList.add('is-swapping');
    var ready = Promise.all(stepImages(index).map(loadImage));
    var race = new Promise(function (resolve) { window.setTimeout(resolve, reducedMotion.matches ? 0 : PRELOAD_RACE_MS); });
    Promise.race([ready, race]).then(function () {
      if (token !== state.navToken) return;
      commit(index);
    });
  }

  function commit(index) {
    state.resumeStep = null;
    if (index === steps.length - 1) storage.clear();
    else if (index >= 1) storage.write(index);
    el.primary.disabled = false;
    el.secondary.disabled = false;
    el.feedbackBtn.disabled = false;
    panel.classList.remove('is-swapping');
    renderStep(index);
    focusForStep();
    preload(index + 1);
    preload(index + 2);
  }

  function focusForStep() {
    var s = steps[state.step];
    if (state.phase === 'choosing') return; // armChoices focuses the first choice once it is usable
    if (!el.primary.hidden) {
      el.primary.focus({ preventScroll: true });
    } else if (s) {
      el.title.focus({ preventScroll: true });
    }
  }

  function restart() {
    storage.clear();
    state.resumeStep = null;
    state.navToken++;
    el.primary.disabled = false;
    el.secondary.disabled = false;
    el.feedbackBtn.disabled = false;
    panel.classList.remove('is-swapping');
    renderStep(0, { instant: true });
    el.primary.focus({ preventScroll: true });
    preload(1);
  }

  function primaryIntent() {
    var s = steps[state.step];
    if (state.phase === 'typing') {
      finishTyping();
      return;
    }
    if (state.phase !== 'reading') return;
    if (state.step === 0 && state.resumeStep != null) {
      go(state.resumeStep);
      return;
    }
    if (s.type === 'ending') {
      if (isLastLine()) { restart(); return; }
    }
    if (s.lines && !isLastLine()) {
      state.lineIndex += 1;
      renderLine(s.lines[state.lineIndex]);
      return;
    }
    go(state.step + 1);
  }

  /* ---------------- fullscreen ---------------- */

  function setupFullscreen() {
    var root = document.documentElement;
    var supported = (document.fullscreenEnabled && root.requestFullscreen) ||
      (document.webkitFullscreenEnabled && root.webkitRequestFullscreen);
    if (!supported) return;
    var btn = el.fullscreen;
    var current = function () { return document.fullscreenElement || document.webkitFullscreenElement || null; };
    var sync = function () {
      var on = !!current();
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? UI.fullscreenExit : UI.fullscreenEnter;
    };
    btn.addEventListener('click', function () {
      var p;
      try {
        if (current()) p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
      } catch (e) { p = null; }
      if (p && p.catch) p.catch(function () { sync(); });
    });
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    btn.hidden = false;
  }

  /* ---------------- events ---------------- */

  el.primary.addEventListener('click', primaryIntent);
  el.secondary.addEventListener('click', function () {
    if (state.step === 0 && state.resumeStep != null) restart();
  });
  el.feedbackBtn.addEventListener('click', onFeedbackAction);

  // A held Enter/Space must not auto-repeat onto the next control that receives focus.
  document.addEventListener('keydown', function (e) {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.choice, .feedback-btn, #primary')) {
      e.preventDefault();
    }
  }, true);

  panel.addEventListener('click', function (e) {
    if (e.target.closest('button, a')) return;
    if (state.phase !== 'typing' && state.phase !== 'reading') return;
    var sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (state.phase === 'reading' && el.primary.hidden) return;
    var s = steps[state.step];
    // Restarting is destructive: on the final ending line only the button restarts.
    if (state.phase === 'reading' && s.type === 'ending' && isLastLine()) return;
    primaryIntent();
  });

  function keyTargetOk() {
    var a = document.activeElement;
    return !a || a === document.body || a === panel || a === el.title || a === document.documentElement;
  }
  var spaceArmed = false;
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || !keyTargetOk()) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) primaryIntent();
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (!e.repeat) spaceArmed = true;
    }
  });
  document.addEventListener('keyup', function (e) {
    if ((e.key === ' ' || e.key === 'Spacebar') && spaceArmed) {
      spaceArmed = false;
      if (keyTargetOk()) primaryIntent();
    }
  });

  /* ---------------- boot ---------------- */

  function boot() {
    setupFullscreen();
    state.resumeStep = storage.read();
    renderStep(0);
    if (state.resumeStep != null) el.primary.focus({ preventScroll: true });
    preload(state.resumeStep != null ? state.resumeStep : 1);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { stage.classList.remove('is-booting'); });
    });
  }

  boot();
})();
