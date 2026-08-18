# DevRecall FSRS and Random Study Design

## Goal

Make DevRecall easier to use during irregular short breaks while improving long-term retention. Replace the fixed interval multipliers with FSRS and add a configurable random-practice flow without introducing typed answers, gamification, accounts, or backend work.

## User experience

The home page offers two primary learning actions:

1. **Повторить по плану** opens the FSRS daily queue. Due cards are shown first, followed by new cards up to the configured limits.
2. **Случайная тренировка** opens a compact setup screen before starting.

Random practice settings:

- duration: 5, 10, 20 minutes, or unlimited;
- topic: all topics or one existing topic;
- pool: all cards, difficult cards, favorites, or unseen cards.

Time presets map to fixed session sizes so the session remains deterministic and works offline: 8 cards for 5 minutes, 16 for 10 minutes, and 32 for 20 minutes. Unlimited mode uses every matching card. Cards are shuffled with a Fisher-Yates shuffle. The same card is included only once in the initial queue.

The study screen keeps the existing recall flow: read the question, formulate an answer mentally or aloud, reveal the answer, then select **Не знаю**, **Сложно**, **Нормально**, or **Легко**. Typed-answer input is explicitly excluded because it adds friction on mobile and in transit.

At session completion the user sees:

- cards completed and elapsed time;
- counts for all four ratings;
- the topics with the most **Не знаю** and **Сложно** responses;
- an action to repeat mistakes from this session;
- an action to return home.

## Scheduling architecture

Use `ts-fsrs` version `5.4.1` behind a small application-owned adapter. Vue components and Pinia stores must not call the package directly. The adapter accepts DevRecall ratings and returns the next FSRS card state and review log fields.

Rating mapping:

- `again` → FSRS Again;
- `hard` → FSRS Hard;
- `good` → FSRS Good;
- `easy` → FSRS Easy.

The adapter uses the library's default parameters initially. The desired retention value is stored as a single exported constant so it can be tuned later without changing persisted data or UI code.

Every rated card updates FSRS, including cards studied in random mode. A random session is real recall practice, so ignoring it would cause the daily scheduler to show a card again too soon. Random selection itself does not alter scheduling; only submitting a rating does.

The current same-session behavior remains: selecting **Не знаю** inserts the card approximately five positions later when possible. FSRS also schedules its future review independently.

## Progress model and migration

The local snapshot moves from version 1 to version 2. Existing favorites, counters, history, settings, last rating, and timestamps are preserved.

Each `CardProgress` gains an FSRS scheduling payload containing:

- due timestamp;
- stability;
- difficulty;
- elapsed days;
- scheduled days;
- learning steps;
- repetitions;
- lapses;
- FSRS state;
- last review timestamp.

The application continues exposing its simple derived statuses (`new`, `learning`, `review`, and `mastered`) to existing views. `mastered` is derived for presentation and is not used as a scheduling input.

On first load of version 1 data:

1. Preserve the raw version 1 JSON under a one-time backup key.
2. Convert each reviewed card to the nearest valid FSRS state using its repetition count, previous interval, next review date, last review date, and last rating.
3. Preserve unseen cards without creating scheduled state.
4. Write the converted snapshot under `devrecall:v2` only after the entire migration succeeds.
5. Continue reading version 1 data if conversion fails, and show a recoverable notice instead of silently resetting progress.

New installations create version 2 directly. The data model remains JSON-serializable and uses ISO UTC timestamps so it can later be synchronized through the planned Telegram backend.

## Session construction

Session construction is moved to framework-independent functions.

The planned daily queue is ordered as follows:

1. overdue and due cards, oldest due first;
2. learning cards due now;
3. unseen cards, shuffled within the daily new-card limit.

Cards scheduled in the future are not used as fallback content for the planned queue. When nothing is due, the home page says that the plan is complete and offers random practice.

Random-practice filtering is applied before shuffling. Empty results explain the selected filter and provide actions to change it or return home. A random session stores its configuration so **Пройти ещё раз** repeats the same filters with a newly shuffled queue.

The existing topic, favorites, and difficult modes continue working. Difficult cards are derived primarily from FSRS difficulty and lapses, with the existing recent `again` or `hard` signal retained for understandable behavior during migration.

## Statistics

The statistics page keeps the existing activity summary and adds:

- cards due today and tomorrow;
- recall success rate for the last 7 and 30 days;
- count of learning and mature cards;
- five weakest topics based on recent `again` and `hard` ratings;
- forecast of scheduled reviews for the next seven days.

Statistics are calculated from stored review events and FSRS due dates. They must remain understandable: the UI does not expose raw stability or difficulty numbers unless a future advanced-details view is added.

## Files and boundaries

- `src/features/scheduling/fsrsScheduler.ts` owns all `ts-fsrs` translation.
- `src/features/progress/migrateProgress.ts` owns version 1 to version 2 conversion.
- `src/features/progress/types.ts` defines version 2 persistence types.
- `src/features/progress/progressStore.ts` loads, migrates, persists, and records reviews through the scheduler adapter.
- `src/features/study/sessionBuilder.ts` constructs planned and random queues without Vue dependencies.
- `src/features/study/studyStore.ts` manages an active session and its summary.
- `src/features/study/RandomStudyView.vue` provides random-session setup.
- `src/features/study/StudyView.vue`, `src/features/home/HomeView.vue`, `src/features/statistics/StatisticsView.vue`, and the router receive focused UI changes.

No content files, card IDs, categories, Markdown rendering, or Telegram integration are changed by this feature.

## Error handling

- Invalid version 2 data does not overwrite the last readable snapshot.
- A migration failure preserves the version 1 source and reports that progress could not be upgraded.
- Unknown card IDs in historical events are ignored in topic statistics but retained in raw history.
- Invalid random-session query values fall back to safe defaults: all topics, all cards, and 10 minutes.
- Local storage write failures keep the in-memory session usable and show a non-blocking warning.

## Verification

Automated tests are not run during this implementation at the user's request. Existing test expectations are updated to match the new model, but verification uses:

- TypeScript type checking and the production build;
- a read-only validation script for persisted-shape fixtures and unique review-event IDs;
- manual browser checks for planned study, every random filter, empty states, repeat-mistakes, migration with sample version 1 data, statistics, responsive mobile layout, and persistence after reload.

## Completion criteria

The feature is complete when the user can select a short random session, study a shuffled matching queue, rate cards with the existing four controls, repeat mistakes, return later to an FSRS-generated daily plan, retain all previous progress and favorites, and see useful scheduling and weak-topic statistics after reload.
