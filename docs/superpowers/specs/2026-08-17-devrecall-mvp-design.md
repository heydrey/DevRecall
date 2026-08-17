# DevRecall MVP Design

## Goal

Build a personal interview-preparation trainer that becomes usable quickly in a browser and then works as a Telegram Mini App on iPhone and Telegram Desktop with synchronized progress.

The primary success criterion is a complete learning loop: select JavaScript material, recall an answer, reveal it, rate the result, receive the next card, and return later with progress preserved.

## Delivery strategy

Use a vertical-slice approach instead of completing every screen or infrastructure layer separately.

1. Build a polished mobile-first browser application with real JavaScript cards and local persistence.
2. Complete the study engine, favorites, and useful statistics.
3. Add server persistence, Telegram authentication, deployment, and cross-device synchronization.
4. Expand the content to Vue, SQL/PostgreSQL, PHP/Laravel, and resume-specific questions after the learning loop is stable.

This ordering produces a useful application early while preserving the final Telegram requirement.

## Scope

### First usable browser version

- Vue 3, TypeScript in strict mode, Vite, Vue Router, and Pinia.
- Mobile-first shell with desktop content constrained to a comfortable reading width.
- Home, Topics, Topic, Study, Favorites, Statistics, and Settings routes.
- Approximately 30 reviewed JavaScript cards divided into sections.
- Markdown answers with safe rendering and readable code blocks.
- Ratings: Again, Hard, Good, and Easy.
- A simple replaceable review algorithm and session queue.
- Favorites, difficult-card detection, session result, and basic statistics.
- Local persistence for progress, review history, settings, and unfinished sessions.

### Telegram MVP

- Supabase PostgreSQL for users, card progress, review events, and settings.
- Small TypeScript serverless API endpoints deployed with the frontend.
- Telegram Mini App initialization, theme, viewport, and safe-area support.
- Server-side validation of Telegram init data before accepting a user identity.
- Minimal Telegram bot with an Open DevRecall button.
- Deployment through Vercel and synchronized progress between iPhone and Telegram Desktop.

### Explicitly out of scope

- LLM answer evaluation, voice recognition, admin panel, social features, payments, achievements, microservices, WebSockets, Docker, Kubernetes, SSR, and a custom design system.
- Editing cards through the application.
- FSRS in the first version. The study service boundary must permit a later replacement.

## Architecture

### Presentation

Vue views compose small domain-oriented components. The standard shell contains bottom navigation; Study uses a focused full-screen layout. Pinia stores only shared application state such as the current study session, progress, settings, topics, and current user.

### Content

Topics, sections, and cards live in versioned JSON files outside Vue components. Stable card IDs are never derived from array position or display text.

A `CardRepository` interface isolates consumers from storage. `StaticCardRepository` reads bundled JSON. A future `SupabaseCardRepository` can replace it without changing views or the study engine.

A content-validation command runs before builds and checks schema validity, references, required fields, stable unique IDs, supported levels, and empty content.

### Progress

A `ProgressRepository` interface provides progress, favorites, settings, review history, and active-session persistence. `LocalProgressRepository` uses browser storage. `ApiProgressRepository` uses authenticated server endpoints.

Repository writes operate on complete review outcomes so card progress and its review event cannot diverge. API requests carry an idempotency key to prevent duplicate reviews after retries.

### Study engine

Framework-independent TypeScript services build sessions, schedule reviews, classify difficult cards, and calculate statistics.

The daily queue contains due cards before new cards and respects user limits. An Again card returns after several intervening cards rather than immediately. Review dates are stored as UTC timestamps; day and streak boundaries use the user's configured or detected time zone.

The initial interval rules remain intentionally understandable:

- Again: requeue in the current session and schedule the next main review around one day later.
- Hard: multiply the previous interval by about 1.5, with a one-day minimum.
- Good: multiply by about 2.5, with a three-day minimum.
- Easy: multiply by about 4, with a seven-day minimum.

Exact constants are centralized and covered by tests.

### Markdown security

Card answers support paragraphs, lists, emphasis, headings, inline code, code blocks, and small tables. Raw HTML is disabled. Generated HTML is sanitized before rendering, links use safe protocols, and long code lines scroll horizontally without widening the page.

### Telegram and backend

The browser version uses a development identity and local repository. Production Telegram mode sends signed init data to the backend. The backend validates the Telegram signature and freshness, resolves the user, and issues only authorized progress operations.

Bot tokens and Supabase service credentials exist only in server environment variables. The frontend never receives administrative secrets.

## Data model

Core content types are `Topic`, `Section`, and `Card`. User state uses `CardProgress`, `ReviewEvent`, `UserSettings`, and `StudySession`.

The initial server schema contains:

- `users`, keyed internally and unique by Telegram ID;
- `card_progress`, unique by user and stable card ID;
- `review_events`, append-only review attempts with an idempotency key;
- `user_settings`, one row per user.

Content remains in JSON during the MVP. Stable IDs allow a later JSON-to-PostgreSQL migration without losing progress.

## Error handling

- Invalid bundled content fails validation and blocks the build with a precise file and field error.
- Corrupt local data falls back safely while preserving a diagnostic message where possible.
- Failed review persistence retains the completed action locally and allows retry without duplicating the event.
- Telegram authentication fails closed and shows a recoverable launch message.
- Empty sessions explain whether there are no due cards, no cards in the selected filter, or a loading failure.

## Testing and verification

- Unit tests cover interval calculation, Again requeue placement, daily limits, difficult-card classification, progress classification, statistics, and time-zone day boundaries.
- Repository contract tests run against the local implementation and later the API implementation.
- Content validation is part of the normal build.
- Component tests cover answer reveal, rating availability, favorite toggling, and session completion.
- Every milestone must pass type checking, tests, production build, and manual responsive review.
- Telegram completion requires real-device checks in Telegram Desktop and on an iPhone, including synchronized progress.

## Milestones

1. Application foundation and polished responsive shell.
2. JavaScript content model, JSON repository, validator, and initial cards.
3. Complete local study flow and persistence.
4. Favorites, statistics, settings, and UX refinement.
5. Supabase schema and authenticated progress API.
6. Telegram Mini App, bot, deployment, and cross-device verification.

Each milestone is delivered as a small logical change with README updates and verification evidence.

## Definition of done

The MVP is complete when the user can open DevRecall from Telegram on iPhone and Telegram Desktop, study JavaScript cards, reveal and rate answers, use favorites, finish sessions, inspect useful progress statistics, close the app, return later, and continue with the same synchronized state on either device.
