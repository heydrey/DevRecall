# FSRS and Random Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed review intervals with FSRS 5.4.1 and add flexible random study sessions, repeat-mistakes flow, progress migration, and useful scheduling statistics.

**Architecture:** A framework-independent scheduler adapter owns `ts-fsrs`, a versioned migration layer converts current local data, and a pure session builder creates planned and random queues. Pinia coordinates these services while Vue views remain responsible only for user interaction and rendering.

**Tech Stack:** Vue 3, TypeScript 5.9, Pinia, Vue Router, Vite, Zod, localStorage, `ts-fsrs` 5.4.1.

**Spec:** `docs/superpowers/specs/2026-08-18-fsrs-random-study-design.md`

## Global Constraints

- Preserve all existing card IDs, categories, favorites, counters, history, and settings.
- Do not add typed answers, gamification, accounts, backend work, or Telegram integration.
- Random practice ratings update FSRS; merely selecting a random card does not.
- Persist UTC timestamps as ISO strings and keep the version 1 source until version 2 migration succeeds.
- Do not run the automated Vitest suite because the user explicitly requested no test runs.
- Verification uses type checking, production build, data-validation scripts, and manual browser checks.

---

### Task 1: Install FSRS and create the scheduler adapter

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/scheduling/fsrsScheduler.ts`

**Interfaces:**
- Produces: `FsrsCardData`, `FsrsReviewResult`, `createNewFsrsCard(now)`, `scheduleFsrsReview(card, rating, now)`, and `fsrsDueAt(card)`.
- Consumes: `ReviewRating` from `src/features/progress/types.ts`.

- [ ] **Step 1: Install the exact dependency**

Run:

```powershell
npm install ts-fsrs@5.4.1 --save-exact
```

Expected: `package.json` and `package-lock.json` record exactly `5.4.1`.

- [ ] **Step 2: Add the application-owned scheduler adapter**

Create `src/features/scheduling/fsrsScheduler.ts` with these public types and functions:

```ts
import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as LibraryCard,
  type CardInput,
} from 'ts-fsrs'
import type { ReviewRating } from '../progress/types'

export const DESIRED_RETENTION = 0.9

export interface FsrsCardData {
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: State
  lastReview?: string
}

export interface FsrsReviewResult {
  card: FsrsCardData
  previousScheduledDays: number
  nextScheduledDays: number
}

const scheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION }))

const ratingMap: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

function serialize(card: LibraryCard): FsrsCardData {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.toISOString(),
  }
}

function deserialize(card: FsrsCardData): CardInput {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.lastReview,
  }
}

export function createNewFsrsCard(now = new Date()): FsrsCardData {
  return serialize(createEmptyCard(now))
}

export function scheduleFsrsReview(
  current: FsrsCardData,
  rating: ReviewRating,
  now = new Date(),
): FsrsReviewResult {
  const next = scheduler.next(deserialize(current), now, ratingMap[rating]).card
  return {
    card: serialize(next),
    previousScheduledDays: current.scheduledDays,
    nextScheduledDays: next.scheduled_days,
  }
}

export function fsrsDueAt(card?: FsrsCardData): string | undefined {
  return card?.state === State.New ? undefined : card?.due
}
```

- [ ] **Step 3: Verify the adapter compiles**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

---

### Task 2: Define version 2 progress data and migration

**Files:**
- Modify: `src/features/progress/types.ts`
- Create: `src/features/progress/migrateProgress.ts`

**Interfaces:**
- Consumes: `FsrsCardData`, `createNewFsrsCard`, and `scheduleFsrsReview`.
- Produces: `ProgressSnapshotV1`, `ProgressSnapshotV2`, `ProgressSnapshot`, `MigrationResult`, and `migrateProgressSnapshot(value, now)`.

- [ ] **Step 1: Add versioned persistence types**

Keep the existing version 1 shape as `ProgressSnapshotV1`. Extend `CardProgress` with optional `fsrs?: FsrsCardData`. Add `sessionMinutes: 5 | 10 | 20 | 0` to settings. Define:

```ts
export interface ProgressSnapshotV2 {
  version: 2
  progress: Record<string, CardProgress>
  reviewEvents: ReviewEvent[]
  settings: UserSettings
}

export type ProgressSnapshot = ProgressSnapshotV2

export interface MigrationResult {
  snapshot: ProgressSnapshotV2
  migrated: boolean
  sourceBackup?: string
}
```

- [ ] **Step 2: Implement deterministic version 1 conversion**

Create `migrateProgress.ts`. For each old reviewed card:

1. Start with `createNewFsrsCard(lastReviewedAt ?? now)`.
2. Replay one rating using `lastRating ?? 'good'` at `lastReviewedAt ?? now`.
3. Preserve the old next due date by replacing the resulting `due` with `nextReviewAt` when present.
4. Preserve `repetitions`, `correctCount`, `wrongCount`, `favorite`, and display status.

Unreviewed favorite cards remain without FSRS scheduling state. The function must reject non-object input, return an empty version 2 snapshot for missing input, return version 2 unchanged after merging default settings, and serialize the exact source version 1 JSON into `sourceBackup` only when migration occurs.

- [ ] **Step 3: Add a read-only migration probe**

Run a temporary `tsx -e` command that imports `migrateProgressSnapshot`, passes one reviewed version 1 card, and prints `version`, `favorite`, `fsrs.due`, and `migrated`.

Expected: `version=2`, favorite preserved, due is an ISO timestamp, and `migrated=true`.

---

### Task 3: Upgrade the progress store to FSRS and safe persistence

**Files:**
- Modify: `src/features/progress/progressStore.ts`
- Modify: `src/features/settings/SettingsView.vue`

**Interfaces:**
- Consumes: `migrateProgressSnapshot`, `createNewFsrsCard`, `scheduleFsrsReview`, and `fsrsDueAt`.
- Produces: existing progress-store API plus `persistenceWarning`, `clearPersistenceWarning`, `dueTomorrowCount(cards)`, and FSRS-backed `recordReview`.

- [ ] **Step 1: Replace the storage bootstrap**

Use these keys:

```ts
const STORAGE_KEY = 'devrecall:v2'
const LEGACY_STORAGE_KEY = 'devrecall:v1'
const LEGACY_BACKUP_KEY = 'devrecall:v1:backup'
```

Loading order is version 2, then version 1 migration, then empty version 2. Save `sourceBackup` before writing version 2. Do not delete `devrecall:v1` during this feature.

- [ ] **Step 2: Replace fixed interval scheduling**

Remove `nextInterval` and `addDays`. In `recordReview`, create an FSRS card for unseen progress or use the existing one, call `scheduleFsrsReview`, derive `nextReviewAt` from the returned due time, and retain the existing understandable counters and status fields. `ReviewEvent.previousIntervalDays` and `nextIntervalDays` receive FSRS scheduled-day values.

- [ ] **Step 3: Make persistence failures non-destructive**

Wrap localStorage writes in `try/catch`. On failure set `persistenceWarning` to `Не удалось сохранить прогресс на устройстве. Текущая сессия продолжает работать.` and keep in-memory state unchanged.

- [ ] **Step 4: Extend settings UI**

Add a select labelled `Обычная длительность` with values `5`, `10`, `20`, and `0`, where `0` renders as `Без ограничения`. This value becomes the default on the random-study setup screen.

- [ ] **Step 5: Verify migration and persistence manually**

In the browser, seed a copy of existing `devrecall:v1`, remove only `devrecall:v2`, reload, and verify favorites and learned counts remain visible. Confirm both `devrecall:v1:backup` and `devrecall:v2` exist afterward.

---

### Task 4: Extract pure session construction

**Files:**
- Create: `src/features/study/sessionBuilder.ts`
- Modify: `src/features/study/studyStore.ts`

**Interfaces:**
- Produces: `RandomPool`, `RandomSessionOptions`, `SESSION_CARD_LIMITS`, `buildPlannedSession`, `buildRandomSession`, and `shuffleCards`.
- Consumes: `Card[]`, progress lookup functions, daily limits, and random filters.

- [ ] **Step 1: Implement session-builder types**

```ts
export type RandomPool = 'all' | 'difficult' | 'favorites' | 'unseen'
export type SessionMinutes = 5 | 10 | 20 | 0

export interface RandomSessionOptions {
  topicId: string | 'all'
  pool: RandomPool
  minutes: SessionMinutes
}

export const SESSION_CARD_LIMITS: Record<SessionMinutes, number> = {
  5: 8,
  10: 16,
  20: 32,
  0: Number.POSITIVE_INFINITY,
}
```

- [ ] **Step 2: Implement Fisher-Yates and filters**

`shuffleCards(cards, random = Math.random)` returns a new array and never mutates repository data. `buildRandomSession` filters by topic and pool, shuffles, then slices to the duration limit. `buildPlannedSession` sorts due cards by due timestamp and appends shuffled unseen cards up to the daily new limit; it never adds future cards as filler.

- [ ] **Step 3: Extend study modes and restart data**

Change `StudyMode` to:

```ts
export type StudyMode = 'today' | 'topic' | 'favorites' | 'difficult' | 'random' | 'mistakes'
```

Store `randomOptions`, `sessionCardIds`, and `mistakeCardIds`. Add `startRandom(options)`, `repeatMistakes()`, and `restartSession()`. `again` and `hard` add the current card ID to mistakes. `restartSession` rebuilds random mode with a new shuffle and preserves normal behavior for other modes.

- [ ] **Step 4: Run a read-only queue probe**

Use `tsx -e` with ten sample cards and a deterministic random function. Verify the source array order is unchanged, a 5-minute session contains at most 8 cards, and unseen filtering excludes reviewed cards.

---

### Task 5: Add the random-study setup route and home entry points

**Files:**
- Create: `src/features/study/RandomStudyView.vue`
- Modify: `src/app/router.ts`
- Modify: `src/features/home/HomeView.vue`
- Modify: `src/shared/styles/base.css`

**Interfaces:**
- Consumes: topics from `StaticCardRepository`, default duration from progress settings, and `RandomSessionOptions` query values.
- Produces: route `/study/random` and navigation to `/study?mode=random&topicId=...&pool=...&minutes=...`.

- [ ] **Step 1: Create the setup view**

Render four duration buttons, a topic select containing `Все темы`, and four pool cards labelled `Все карточки`, `Сложные`, `Избранные`, and `Ещё не изученные`. Keep the start button disabled only while content loads. Invalid query values fall back to `all`, `all`, and the saved default duration.

- [ ] **Step 2: Register the route**

Add `/study/random` before `/study` in `router.ts`. It uses the normal application shell; only the active study route hides navigation.

- [ ] **Step 3: Replace the single home action with two clear actions**

The primary button is `Повторить по плану`. The secondary button is `Случайная тренировка`. When no cards are due and no unseen cards remain under the daily limit, the plan card says `На сегодня всё готово` and visually emphasizes random practice.

- [ ] **Step 4: Check responsive layout manually**

Inspect the setup page at approximately 390 px and 1024 px widths. Confirm all controls remain readable, duration buttons do not overflow, and the start action remains reachable without horizontal scrolling.

---

### Task 6: Upgrade the study screen and session summary

**Files:**
- Modify: `src/features/study/StudyView.vue`

**Interfaces:**
- Consumes: query configuration, `studyStore.startRandom`, `studyStore.repeatMistakes`, `studyStore.restartSession`, and `mistakeCardIds`.
- Produces: mode-aware empty states and completion actions.

- [ ] **Step 1: Parse random query settings**

When `mode=random`, normalize `topicId`, `pool`, and `minutes`, then call `startRandom`. For other modes keep the existing `start` entry point.

- [ ] **Step 2: Remove hard-coded interval hints**

Change rating hints to descriptions that remain correct under FSRS:

```ts
[
  { value: 'again', label: 'Не знаю', hint: 'показать раньше' },
  { value: 'hard', label: 'Сложно', hint: 'короткий интервал' },
  { value: 'good', label: 'Нормально', hint: 'обычный интервал' },
  { value: 'easy', label: 'Легко', hint: 'длинный интервал' },
]
```

- [ ] **Step 3: Add mistake and restart actions**

At completion, show `Повторить ошибки` only when mistake IDs exist. `Ещё одна случайная тренировка` calls `restartSession` in random mode. Empty random pools mention the selected filter and link back to `/study/random`.

- [ ] **Step 4: Verify the full study flow manually**

Run one 5-minute all-topic session, rate at least one card with each rating, repeat mistakes, finish, reload the app, and confirm the rated cards retain progress and due dates.

---

### Task 7: Add scheduling and weak-topic statistics

**Files:**
- Modify: `src/features/statistics/StatisticsView.vue`

**Interfaces:**
- Consumes: all cards, `progress`, `reviewEvents`, FSRS due timestamps, and topic IDs.
- Produces: due-today count, due-tomorrow count, 7/30-day success rates, learning/mature counts, weak topics, and seven-day forecast.

- [ ] **Step 1: Add derived statistics**

Success means `good` or `easy`. A mature card has FSRS stability of at least 21 days. Weak-topic score for the last 30 days is `again * 2 + hard`; show up to five topics with scores above zero. The forecast groups scheduled due timestamps into the next seven local calendar days.

- [ ] **Step 2: Render compact mobile-first sections**

Add summary cards for due today, due tomorrow, learning, and mature. Add 7/30-day percentages, a simple seven-column forecast using existing CSS patterns, and a weak-topics list with links to the topic pages.

- [ ] **Step 3: Verify empty and populated states manually**

Check statistics with cleared data and after a mixed-rating session. Empty statistics must show zeros without `NaN`; populated statistics must show topic titles rather than raw topic IDs.

---

### Task 8: Update expectations and perform final verification

**Files:**
- Modify: `src/features/content/StaticCardRepository.test.ts` only if dependency or type changes require formatting updates; do not run it.
- Modify: `README.md` if it contains current study-mode instructions.

**Interfaces:**
- Verifies all preceding tasks as one working application.

- [ ] **Step 1: Run content and persistence validation**

Run a PowerShell read-only script that parses every card JSON file, confirms unique card IDs and questions, confirms valid topic/section references, and imports a version 1 migration fixture through `tsx`.

Expected: 498 cards, zero duplicate IDs, zero duplicate questions, zero invalid sections, and a version 2 migration result.

- [ ] **Step 2: Run type checking and production build**

Run:

```powershell
npm run build
```

Expected: `vue-tsc --build` and Vite complete with exit code 0. The existing large-chunk warning is acceptable.

- [ ] **Step 3: Verify the live application**

Check in the browser:

- home shows planned and random actions;
- planned mode does not show future cards as filler;
- random setup supports every duration and pool;
- random study updates progress only after rating;
- repeat mistakes contains only `again` and `hard` cards;
- migration preserves favorites and counters after reload;
- statistics show valid numbers and topic names;
- the application remains usable at iPhone-width and desktop-width layouts.

- [ ] **Step 4: Review the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only task-related files changed in addition to the user's existing uncommitted content files.
