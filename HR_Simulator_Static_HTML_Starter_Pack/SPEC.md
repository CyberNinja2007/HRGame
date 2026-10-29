# AI Implementation Brief — «HR Simulator: Срочная вакансия»

**Document language:** English  
**Game language:** Russian (`ru-RU`), with Cyrillic UI and dialogue text  
**Target:** A complete, short, interactive, static HTML visual-novel / training game  
**Setting:** Saint Petersburg, Russia; 29 October–9 November 2026  
**Estimated playtime:** 15–20 minutes

## 1. Your assignment

Build a finished, polished, playable game called **«HR Simulator: Срочная вакансия»** using only static web technologies. The player is **Maria Orlova**, a recruiter at the fictional Russian IT company **«СеверСофт»**. She interviews **Gennady Krylov**, a system administrator, and guides his recruitment from a phone screening through an in-person interview and a signed-off job offer. The story ends when Gennady accepts the offer.

**Important:** Implement the game. Do not deliver just wireframes, mockups, a design proposal, or placeholder screens. Preserve the existing story and its teaching purpose, but make the experience compact, visually polished, and easy to navigate.

## 2. Non-negotiable scope

**Include only:**
1. A short **introduction** showing the company, Maria's workplace, the vacancy briefing, and **all six story characters**.
2. The **main interactive story**, with three phases and twelve multiple-choice decisions.
3. A short **narrative ending** confirming that Gennady has accepted the offer, plus an optional **«Начать заново»** button.

**Do NOT include:**
- Name entry, character creation, profile setup, login, or registration. The player is always **Maria Orlova**.
- A score, points, grades, performance ratings, results page, statistics dashboard, achievements, medals, leaderboard, or separate debrief/results screen.
- A recruitment-management sandbox, free-form chat, AI-generated dialogue at runtime, random candidates, multiple endings, timers, real phone calls, payments, or integrations with real hiring websites.
- Backend, database, APIs, accounts, cookies, analytics, advertising, remote font loading, or third-party runtime dependencies.

**Education still matters:** After each selection, show brief contextual feedback explaining why the choice was good, weak, or inappropriate. **This is instructional feedback, not a score or results screen.** Incorrect choices must not block the entire game: present the explanation and allow **«Попробовать ещё раз»**. Correct choices unlock **«Продолжить»**.

## 3. Product and tech requirements

- Provide a runnable `index.html`, `styles.css`, `game-data.js`, and `game.js` (or fewer vanilla files if simpler).
- Use **HTML5, CSS3, and vanilla JavaScript**. No build step, frameworks, npm packages, bundlers, or TypeScript compilation.
- It must work by opening `index.html` locally in a modern browser (`file://`). To ensure this, use ordinary `<script defer>` files or inline scripts; do **not** require `fetch()` for local JSON or ES module imports.
- All imagery must load from relative local `assets/` paths and work offline.
- Fully keyboard-operable: Tab, Enter/Space for choices; visible focus indicators. Support mouse and touch.
- Responsive to 1920×1080, 1366×768, and mobile layouts around 390×844. On narrow screens, let the panel scroll internally rather than clipping text; do not squeeze buttons below a readable size.
- Accessible semantic buttons and readable contrast; honor `prefers-reduced-motion`.
- UI and story copy in **Russian only**. English is used only in developer-facing code/comments/this brief. Use proper Cyrillic spelling and punctuation.
- Set `<html lang="ru">`, `UTF-8`, viewport meta tag, and a Russian document title.
- No automatic audio is necessary. If adding any sound, ship it locally, keep it off by default, and provide a mute button.

## 4. Art direction and asset usage

Create a cohesive, **modern 16-bit-inspired pixel-art visual novel**, with saturated but comfortable colors, warm golden lighting, navy/indigo UI outlines, cream dialogue panels, and recognizable Saint Petersburg scenery. Preserve pixel edges using `image-rendering: pixelated` only where it improves asset appearance; avoid blurry enlargement or distorted aspect ratios.

**Supplied background assets** (use them as the four principal scenes):

| Asset | Required use |
| --- | --- |
| `assets/backgrounds/company.png` | Exterior of «СеверСофт», first intro scene |
| `assets/backgrounds/office.png` | Maria's desk, briefing, phone interview, and staff introductions |
| `assets/backgrounds/meeting_room.png` | In-person interview and relevant discussions |
| `assets/backgrounds/victory.png` | Final successful job-offer scene |

**Supplied character portraits** (six, one individual file each):

| ID | Character | Role | Asset |
| --- | --- | --- | --- |
| `maria` | Мария Орлова | HR specialist and player | `assets/characters/maria.png` |
| `gennady` | Геннадий Крылов | Candidate | `assets/characters/gennady.png` |
| `pavel` | Павел Соколов | IT manager | `assets/characters/pavel.png` |
| `elena` | Елена Миронова | HR director | `assets/characters/elena.png` |
| `oleg` | Олег Белов | Operations director | `assets/characters/oleg.png` |
| `darya` | Дарья Ветрова | Finance director | `assets/characters/darya.png` |

**Portrait format:** The supplied portraits are 1086×1448 (3:4) RGBA PNGs — waist-up cut-out sprites **with transparent backgrounds**. Place them directly over scene backgrounds (e.g. standing beside or above the dialogue panel) or on plain cards in the cast gallery. Scale with `object-fit: contain` to preserve the whole figure; do not stretch or distort. Display names as actual HTML text, not baked into artwork.

`assets/ui/dialogue_reference.png` is a design **reference** for the blue/navy pixel-bordered cream dialogue window. The supplied original has a black matte/background; therefore **prefer recreating the frame in CSS** (stepped corners, blue stacked borders, cream fill, bottom-right next indicator) rather than using a stretched opaque PNG. Do not place black rectangles over scene artwork.

**Typography:** Use locally hosted **Pixelify Sans** for Russian dialogue. It is supplied in `assets/Pixelify_Sans/` (SIL OFL 1.1, Cyrillic-capable): `PixelifySans-VariableFont_wght.ttf` plus `static/PixelifySans-{Regular,Medium,SemiBold,Bold}.ttf`; load via `@font-face` with a relative path and keep `OFL.txt` alongside. The font lacks the `₽` glyph, so the fallback stack must render it legibly. Recommended sizes at 1080p: body 24px (weight 500), speaker names 28px (weight 700), line-height 1.35–1.45. Scale responsively (e.g., body `clamp(17px, 1.6vw, 24px)`). Use a legible system fallback if the font file is absent; the game must still work. Do not hotlink Google Fonts. Pixelify Sans is a font recommendation, not a claim that generated image text used that exact typeface.

Suggested colors: `#25334F` text, `#F8F4EB` cream panel, `#6178B3` panel border, `#263C70` deep blue accents, `#72B59B` success, `#C17F59` caution. Keep choice buttons large, clear and readable; the window may occupy the bottom 35–45% of the screen. Maintain a safe margin around text.

## 5. Narrative setup / introduction

**Start immediately** on the company exterior. No name entry or setup screen. Implement a short clickable intro with these four beats:

### Intro A — The company (background: company)

Title: **«СеверСофт»**  
Subtitle: **«Санкт-Петербург · 29 октября 2026 года»**  
Narration: **«Небольшая IT-компания разрабатывает программы для логистики и складов. Здесь работают 96 человек. Внутреннему IT-отделу срочно нужен ещё один специалист.»**

Button: **«Далее»**.

### Intro B — Your role and vacancy (background: office, Maria portrait)

Title: **«Ты — Мария Орлова»**  
Narration: **«Ты HR-специалист с трёхлетним опытом. Руководство поручило тебе закрыть вакансию системного администратора.»**  
Display a **compact** vacancy card: position **«IT-специалист»**, salary **«125–155 тыс. ₽ до вычета налогов»**, possible approved exception **«до 170 тыс. ₽»**, accepted-offer deadline **«25 ноября»**, hiring budget **«до 80 000 ₽»**, primarily office-based. Technical scope: Windows, Active Directory, networks, VPN, troubleshooting. State company AI policy in one sentence: **«Для рабочих задач разрешены только согласованные локальные AI-модели; специалист должен справляться и без них.»**

Do not turn these facts into interactive budget management.

### Intro C — Meet the team (office background)

Show **all six named characters**, preferably in a clean, responsive 2×3 portrait gallery. It is acceptable to reveal them one by one with **«Далее»**, but the full six must be introduced before the main gameplay. Keep each card to the name and a short role description:
- **Мария Орлова** — «HR-специалист (ты)»
- **Геннадий Крылов** — «Кандидат, системный администратор»
- **Павел Соколов** — «Руководитель IT-отдела»
- **Елена Миронова** — «HR-директор»
- **Олег Белов** — «Операционный директор»
- **Дарья Ветрова** — «Финансовый директор»

Avoid introducing the optional side characters from older image sheets; only these six are in the game.

### Intro D — The lead (office background)

A short Huntflow notification: **«В архиве найдено резюме Геннадия Крылова. Пять лет опыта в IT, из них три года в системном администрировании. Он согласился на звонок 30 октября в 11:30.»**  
Maria's thought: **«Сначала проверю опыт, ожидания и условия. Если всё совпадёт — приглашу его к Павлу.»**

Button: **«Начать интервью»**.

## 6. Story structure and interaction rules

Implement **12 decisions** across the three phases. Each scene includes:
- location/background and timestamp;
- speaker portrait, speaker name, narration/dialogue;
- a question that the player (Maria) must decide how to handle;
- exactly **three** large answer buttons, identified **А**, **Б**, and **В**;
- hidden until selection: a short, specific learning explanation plus a believable reaction of the other character;
- **«Продолжить»** for the correct choice, or **«Попробовать ещё раз»** for a weak/wrong/unsafe choice.

Do not reveal which option is correct before selection. Do not show points, colored score badges, grade summaries, or persistent win/loss bars. A subtle phase title is fine. Do not display a progress score. Choices are deterministic; no randomness or stateful character reputation is required.

Use the **exact question order, key facts, and correct-answer intent** below, and use `HR_Simulator_Srochnaya_Vakansiya.md` (included in the package as a reference) for the longer dialogue and explanatory context. Where source wording conflicts with this spec, **this spec takes precedence** (especially: no results page or scoring).

### Phase I — «Телефонное интервью»
**Friday, 30 October 2026 · 11:30 · office background · 5 choices**

**Decision 1 — Opening the call.** Gennady answers **«Алло, здравствуйте, слушаю.»**
- **А (wrong/partial):** «Здравствуйте! Вы у нас в базе кандидатов. Расскажите, что сейчас ищете». Feedback: No introduction/company and no check whether now is convenient.
- **Б (correct):** «Геннадий, добрый день! Мария, компания „СеверСофт“. Мы договаривались на 11:30. Вам сейчас удобно уделить 10–15 минут?» Feedback: Clear identity, context, duration, and consent. Gennady: **«Да, Мария, сейчас удобно.»**
- **В (wrong):** «Я по вакансии. Давайте быстро по вопросам, у меня следующая встреча». Feedback: Impolite and hurried, damages trust.

**Decision 2 — Verify actual work.** Resume lists Windows Server, AD and networks.
- **А (correct):** «Какую инфраструктуру вы обслуживаете и за какие задачи отвечаете лично?» Feedback: Open behavioral question distinguishes actual duties from buzzwords. Gennady describes **120 workstations, AD, VPN, backup; basic Linux**.
- **Б (wrong/partial):** «Пять лет опыта — значит, всё основное уже умеете?» Feedback: Leading question and years alone do not prove skill.
- **В (wrong):** «Умеете проектировать Kubernetes-кластеры, писать на Go и настраивать BGP?» Feedback: Unrelated to the advertised role.

**Decision 3 — Motivation and overtime.** Gennady says he is looking because of frequent evening calls.
- **А (wrong):** «Значит, вы не готовы работать под нагрузкой?» Feedback: Unsupported negative assumption.
- **Б (wrong):** «У нас переработок вообще не бывает». Feedback: Unverified promise.
- **В (correct):** «Что именно вас не устраивает: частота вызовов, отсутствие компенсации или непредсказуемость?» Feedback: Neutral clarification of motivation; Gennady wants clear rules and compensation, accepts occasional incidents.

**Decision 4 — Gross versus net pay.** Gennady requests at least **135,000 RUB net**. Standard range is **125,000–155,000 RUB gross**, exception up to **170,000 gross** requires approval.
- **А (wrong):** «135 тысяч на руки дадим, если пройдёте интервью». Feedback: Unauthorized salary promise.
- **Б (correct):** «У нас сумма указана до налогов. Стандартный максимум — 155 тысяч gross; при обычном НДФЛ 13% это около 134 850 на руки. Для сильного кандидата повышение можно отдельно согласовать, но пока не обещаю.» Feedback: Transparent math and no premature commitment. Gennady remains interested.
- **В (wrong):** «Деньги обсудим в самом конце». Feedback: Wastes time when expectations may not match.

**Decision 5 — Local AI and remote work.** Gennady asks whether he may use ChatGPT/Copilot and whether remote work is allowed.
- **А (correct):** «Для рабочих задач — только разрешённые локальные модели. Облачные AI-сервисы запрещены. Основную работу нужно уметь выполнять без них. После испытательного срока возможен один день удалённо.» Feedback: Accurate conditions without exaggeration.
- **Б (unsafe):** «Используйте что хотите, главное, чтобы никто не узнал». Feedback: Violates the closed-company policy and confidentiality.
- **В (wrong):** «У нас запрещён вообще любой AI, даже дома». Feedback: False, overbroad statement.

**Phase transition:** Brief confirmation: **«Телефонное интервью завершено. Геннадий заинтересован и приглашён на очную встречу 5 ноября в 15:00.»** Show a very short transition, not a score/results panel.

### Phase II — «Очное собеседование»
**Thursday, 5 November 2026 · 15:00 · meeting_room background · Maria, Pavel, Gennady portraits · 5 choices**

**Decision 6 — Select interview behavior.** At the start of the meeting:
- **А (wrong/partial):** Remain silent and let Pavel conduct absolutely everything. Feedback: HR should coordinate the meeting, confirm terms, and observe communication.
- **Б (correct):** Greet Gennady, introduce Pavel, explain agenda: experience, technical cases, Gennady's questions, next steps. Feedback: Structured, respectful and role-appropriate.
- **В (wrong):** Begin an aggressive stress interview. Feedback: Unnecessary stress distorts assessment.

**Decision 7 — Technical diagnosis.** Pavel asks why one PC cannot resolve an internal corporate site by name while the IP works. Gennady proposes checking DNS/`nslookup`, local settings and the actual error.
- **А (wrong):** Interrupt Pavel and claim the technical evaluation is finished. Feedback: HR oversteps technical evaluator.
- **Б (wrong):** Jump to unrelated deep Linux/Kubernetes questions. Feedback: Unrelated to vacancy requirements.
- **В (correct):** Let Pavel finish then ask Gennady to explain the fault to a nontechnical colleague. Feedback: Combines technical and communication evaluation. Gennady explains clearly.

**Decision 8 — Confidentiality incident.** Gennady offers to display a MikroTik configuration screenshot retained from a former employer.
- **А (correct):** Ask him not to share confidential configuration, but to describe his troubleshooting process without sensitive details. Feedback: Respect for former employer's confidential data.
- **Б (unsafe):** Ask him to email the screenshot to a personal inbox. Feedback: Serious confidentiality/security failure.
- **В (unsafe):** Ask to see it on his phone because it is not being saved. Feedback: Viewing unauthorized secrets is still inappropriate.

**Decision 9 — AI policy under pressure.** Pavel checks whether Gennady can use PowerShell and built-in Windows utilities without a model; he can. Gennady asks if he may use his personal ChatGPT with 'anonymized' work logs when local AI is offline.
- **А (unsafe):** Allow it as long as names and passwords are removed. Feedback: It still violates company policy; removing obvious identifiers does not always remove sensitive information.
- **Б (correct):** Prohibit unapproved external AI for work; allow normal documentation, colleagues and approved local tools; require human verification of scripts. Feedback: Correct security and independent-working approach.
- **В (wrong):** Say the company opposes anyone using AI even in personal life. Feedback: Misrepresents company policy.

**Decision 10 — Difficult question about overtime.** Gennady asks whether there are evening incidents and whether they are compensated. Pavel acknowledges exceptional after-hours work.
- **А (wrong):** Promise there is never any overtime. Feedback: Contradicts reality and undermines trust.
- **Б (wrong):** Claim every IT worker must be on call 24/7 as part of the salary. Feedback: Not in job terms; unacceptable unsupported claim.
- **В (correct):** Clarify emergency frequency and the actual compensation procedure with Pavel; state there are no regular 24/7 on-call shifts and promise to confirm the precise policy in writing. Feedback: Honest, collaborative, does not invent terms. Pavel says exceptional incidents are rare and handled formally.

**Phase transition:** **«Павел считает Геннадия подходящим кандидатом. Геннадию понравились команда и задачи. Осталось согласовать зарплату и направить предложение.»** This is part of the narrative, **not** an assessment-results screen.

### Phase III — «Согласование и оффер»
**Friday, 6 November 2026 · office background, then victory background · 2 choices**

**Decision 11 — Approve 160,000 RUB gross.** Pavel recommends Gennady; Gennady would accept **160,000 RUB gross**, above the usual 155,000 cap but below the possible 170,000 exception.
- **А (correct):** Document Pavel's assessment and request approval from Elena, Darya and Oleg before making an offer. Feedback: Correct financial authority and documentation. All three approve the exception.
- **Б (unsafe):** Send the 160,000 offer immediately without approval. Feedback: An unauthorized compensation promise.
- **В (wrong):** Reject Gennady because the demand exceeds 155,000. Feedback: Ignores the approved exception path for a strong candidate.

**Decision 12 — Send written offer.** Salary approved and candidate interested.
- **А (wrong):** Tell Gennady by phone he is definitely hired and should resign immediately. Feedback: Conditions are not yet documented; do not prompt resignation prematurely.
- **Б (correct):** Send a written offer with job title, **160,000 RUB gross/month**, work hours, location, probation, benefits, AI rules, tentative start date and reply deadline; request written acceptance. Feedback: Clear and respectful next steps.
- **В (wrong):** Send a terse message '160 thousand, answer by lunchtime'. Feedback: Omits terms and pressures the candidate.

**Show the actual offer card in Russian** after the correct choice:
- «Должность: IT-специалист»
- «Оклад: 160 000 ₽ до вычета налогов»
- «График: 5/2, 09:30–18:30»
- «Формат: офис; один удалённый день в неделю после испытательного срока»
- «Испытательный срок: 3 месяца»
- «Предполагаемый выход: 1 декабря 2026 года»
- «ДМС после испытательного срока»
- «Для рабочих задач — только согласованные локальные AI-инструменты»
- «Ответ на предложение — до 10 ноября»

Offer issuance is not itself an employment contract; do not falsely imply the employee has already joined.

## 7. Narrative ending — NOT a results screen

Switch to `backgrounds/victory.png`. Display the date **«9 ноября 2026 года»**. A short incoming message from Gennady:

> **Геннадий:** «Мария, добрый день! Спасибо за предложение. Я всё обдумал и готов его принять. Условия подходят, команда понравилась. Предполагаю, что смогу выйти 1 декабря. Сегодня обсужу увольнение с текущим работодателем и окончательно подтвержу дату.»

Then show a warm, simple celebratory closing overlay:

**«Оффер принят!»**  
**«Геннадий согласился присоединиться к „СеверСофт“. Ты успешно провела подбор — от первого звонка до предложения о работе.»**

**Only one final action:** **«Начать заново»**. Do not show a result breakdown, grade, number of correct answers, money saved, performance appraisal, or another dashboard. The vacancy is closed **at the accepted-offer stage**, not at the actual first workday.

## 8. UI and interaction behavior

- Desktop: full-bleed 16:9 background; character image/scene illustration in the middle or to one side; cream pixel-bordered dialogue panel across the lower portion. Choices inside the panel or immediately above it.
- Mobile: background remains visible but crop responsibly; cards stack; choices are full width and sufficiently tall (≥44px). Ensure the screen remains usable without horizontal scrolling.
- One active scene and one active question at a time. Users cannot select another choice while feedback is open.
- Show **a single stateful feedback panel** after a choice, with concise educational text: **«Почему это хороший выбор»**, **«Что можно улучшить»**, or **«Почему это рискованно»**. Use the situation-specific descriptions above; do not reuse generic feedback.
- Correct choice: display Gennady's/Pavel's immediate narrative reaction (as provided), plus feedback and **«Продолжить»**.
- Noncorrect choice: show a believable brief reaction and feedback, with **«Попробовать ещё раз»**, reopening the same question. Do not punish the player or display a negative score.
- Optional subtle crossfade or slide transition (120–250ms); no unnecessary animations, huge preloads, confetti, or intrusive modals.
- No saving is required; reloading may restart the story. An in-memory scene index is sufficient.
- The intro cast roster should be clearly readable, use all six unique assets, and not exceed a few clicks.

## 9. Suggested data model and state machine

Store story content separately from rendering code, e.g. in `game-data.js` as a globally accessible constant:

```js
const GAME_DATA = {
  characters: {
    maria: { name: 'Мария Орлова', role: 'HR-специалист', image: 'assets/characters/maria.png' },
    gennady: { name: 'Геннадий Крылов', role: 'Кандидат', image: 'assets/characters/gennady.png' }
    // ... other four characters
  },
  scenes: [
    {
      id: 'phone-01',
      phase: 'phone',
      background: 'assets/backgrounds/office.png',
      speaker: 'gennady',
      dateLabel: '30 октября · 11:30',
      dialogue: 'Алло, здравствуйте, слушаю.',
      prompt: 'Как начнёшь разговор?',
      choices: [
        { id: 'a', text: '...', correct: false, feedback: '...' },
        { id: 'b', text: '...', correct: true, feedback: '...' },
        { id: 'c', text: '...', correct: false, feedback: '...' }
      ],
      successReaction: 'Да, Мария, сейчас удобно.'
    }
  ]
};
```

Simple high-level flow:

`INTRO_COMPANY → INTRO_ROLE → INTRO_CAST → INTRO_LEAD → PHONE_01…05 → ONSITE_06…10 → OFFER_11…12 → ACCEPTED_END`

Use ordinary DOM events and a small explicit state controller such as `{ screen, sceneIndex, selectedChoice, feedbackOpen }`. Avoid storing any grade, points, or result calculations. Do not introduce a hidden scoring system that silently changes the ending; the agreed narrative has one successful ending.

## 10. Deliverables

Return a complete directory with at least:

```text
hr-simulator/
├── index.html
├── styles.css
├── game-data.js
├── game.js
├── assets/
│   ├── backgrounds/
│   │   ├── company.png
│   │   ├── office.png
│   │   ├── meeting_room.png
│   │   └── victory.png
│   ├── characters/
│   │   ├── maria.png
│   │   ├── gennady.png
│   │   ├── pavel.png
│   │   ├── elena.png
│   │   ├── oleg.png
│   │   └── darya.png
│   ├── ui/
│   │   └── dialogue_reference.png
│   └── Pixelify_Sans/
│       ├── OFL.txt
│       ├── PixelifySans-VariableFont_wght.ttf
│       └── static/PixelifySans-{Regular,Medium,SemiBold,Bold}.ttf
└── README.md
```

`README.md` should explain how to run the game by opening `index.html`, note the offline asset/fallback font approach, and summarize the screens. Do not include install instructions requiring npm or a dev server.

## 11. Acceptance checklist

- [ ] Opening `index.html` locally immediately displays the company exterior intro.
- [ ] No screen requests the user's name; the player is always Maria.
- [ ] All six characters appear by name and individually on screen during the introduction.
- [ ] All four supplied backgrounds are used in the correct story locations.
- [ ] Twelve distinct decision scenes exist, grouped 5 / 5 / 2 by phase.
- [ ] Every decision has exactly three options; one best option unlocks progression.
- [ ] Each option provides a situation-specific explanation after selection; incorrect options permit retry.
- [ ] Phone interview, onsite interview, company AI restrictions, salary negotiations, offer approval, and written offer are all portrayed.
- [ ] Gennady accepts the offer in a final narrative scene; the only end action is restart.
- [ ] No name entry, grading, points, results, stats, leaderboard, or results screen exist.
- [ ] All player-visible text is in Russian and displays Cyrillic properly.
- [ ] Images and scripts load from local paths and work without network access.
- [ ] Desktop, phone, keyboard navigation, and reduced-motion modes work without clipping or unreadable text.

**Priority order:** story correctness → smooth interaction → legible Russian text → cohesive pixel-art visuals → tasteful transitions. Keep the finished experience short and focused.
