# Telegram Sync Foundation Design

## Goal

Prepare DevRecall for one automatically recognized Telegram account whose learning progress is shared between Telegram Desktop and Telegram on iPhone. This phase builds the local architecture, profile UI, offline outbox, API contracts, and PostgreSQL schema without requiring a bot token, Supabase credentials, deployment, or a working backend.

## User experience

DevRecall gains a profile page reachable from the home-page account button. Before Telegram is connected it displays **Локальный профиль** and explains that data currently exists only on this device. When launched as a Telegram Mini App later, the same page will display the Telegram name and photo returned by the authenticated backend.

The profile page shows one of five synchronization states:

- **Только на устройстве** — no remote API is configured;
- **Синхронизация** — pending mutations are being sent;
- **Синхронизировано** — local data agrees with the server;
- **Нет сети** — local learning continues and mutations remain queued;
- **Ошибка синхронизации** — the last attempt failed and can be retried.

It also shows the number of locally queued changes, the last successful sync time, learned-card and review counts, an export action, an import action, settings access, and progress reset.

No email, password, username selection, or manual registration is added. Telegram identity is the only future production identity.

## Identity boundary

Frontend code uses a `UserIdentityProvider` interface rather than reading Telegram globals inside views or stores.

```ts
export interface AppUser {
  id: string
  telegramId?: string
  displayName: string
  photoUrl?: string
  mode: 'local' | 'telegram'
}

export interface UserIdentityProvider {
  getUser(): Promise<AppUser>
  getTelegramInitData(): string | null
}
```

The local provider returns a stable development identity stored on the device. The future Telegram provider may read raw `Telegram.WebApp.initData` only to send it to the backend. It must never treat `initDataUnsafe` or an unverified Telegram ID as authenticated identity.

The backend will validate the Telegram signature and freshness, look up the internal user by the verified Telegram ID, and return the canonical `AppUser`. Bot tokens and Supabase service credentials never enter frontend environment variables.

## Progress repository boundary

The current Pinia store directly reads and writes localStorage. This phase introduces a persistence boundary:

```ts
export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>
  save(snapshot: ProgressSnapshot): Promise<void>
  exportBackup(): Promise<ProgressBackup>
  importBackup(backup: unknown): Promise<ProgressSnapshot>
  clear(): Promise<void>
}
```

`LocalProgressRepository` owns the existing version 2 localStorage format and migration from version 1. The progress store uses the repository and no longer knows storage keys. This makes a future synchronized repository replaceable without changing study views or the FSRS adapter.

## Offline outbox

Every review receives a UUID before it changes local progress. The same UUID becomes its idempotency key. After the local FSRS update succeeds, a `SyncMutation` is appended to a persistent outbox.

```ts
export interface ReviewSyncMutation {
  id: string
  type: 'review.recorded'
  createdAt: string
  cardId: string
  rating: ReviewRating
  reviewedAt: string
}

export interface SettingsSyncMutation {
  id: string
  type: 'settings.updated'
  createdAt: string
  patch: Partial<UserSettings>
}

export type SyncMutation = ReviewSyncMutation | SettingsSyncMutation
```

Favorites use a dedicated absolute mutation containing `favorite: boolean`, not a toggle command, so replaying it is safe.

The outbox is stored separately from the progress snapshot under a versioned key. Local study never waits for a network request. A future sync worker sends mutations in creation order, removes only server-acknowledged IDs, and retries with bounded exponential backoff when online.

## Conflict and merge strategy

Review events are the source of truth for scheduling across devices. The client performs an optimistic FSRS update so the app remains fast and works offline. The server stores each review event once using its idempotency key, orders accepted events by `reviewedAt`, and calculates the canonical FSRS state for the card.

After upload, the server returns changed card-progress rows and the current server cursor. The client replaces local scheduling fields with the authoritative server result while preserving still-pending local mutations. This handles the case where the iPhone and Desktop both reviewed the same card while offline.

Merge rules:

- review events: append-only and deduplicated by mutation ID;
- card scheduling: server-authoritative result derived from review events;
- favorite: last-write-wins using mutation timestamp;
- settings: field-level last-write-wins using mutation timestamp;
- content: bundled card JSON remains read-only and is not synchronized;
- unknown or removed card IDs remain in history but do not break statistics.

The first Telegram connection does not delete local learning. The client uploads its outbox and local review history, then downloads and applies the merged server snapshot.

## Sync client boundary

This phase defines but does not activate the network client:

```ts
export interface SyncRequest {
  deviceId: string
  cursor?: string
  mutations: SyncMutation[]
}

export interface SyncResponse {
  acknowledgedMutationIds: string[]
  cursor: string
  user: AppUser
  changedProgress: Record<string, CardProgress>
  settings?: UserSettings
  serverTime: string
}

export interface SyncClient {
  sync(request: SyncRequest, telegramInitData: string): Promise<SyncResponse>
}
```

`DisabledSyncClient` reports local-only mode. `HttpSyncClient` is prepared behind the interface but remains inactive until `VITE_API_BASE_URL` is configured. No placeholder request is sent to the network when the URL is absent.

## Profile and sync stores

`profileStore` owns the current `AppUser` and identity loading state. `syncStore` owns status, device ID, outbox count, last success timestamp, last error, and manual retry. The study and progress stores only append mutations; they do not manage network state.

A stable random device ID is generated once per browser/WebView installation. It distinguishes Telegram Desktop and iPhone during diagnostics without becoming the user identity.

The online/offline browser events can update status, but `navigator.onLine` is only a hint. A sync is considered successful only after a valid server response.

## Backup export and import

Export downloads a UTF-8 JSON file with:

- format identifier `devrecall-backup`;
- backup version;
- export timestamp;
- progress snapshot;
- outbox;
- local profile metadata excluding Telegram init data and secrets.

Import validates the shape with Zod before changing state. The current data is automatically exported as a recovery backup before import. Imported review history is merged by event ID; settings and favorites are applied from the imported snapshot; outbox mutations are deduplicated by mutation ID.

Import never accepts executable content and never restores Telegram authentication data.

## Database schema

Add a Supabase-compatible SQL migration defining:

- `users`: internal UUID, unique Telegram ID, display name, photo URL, timestamps;
- `devices`: user ID, client device UUID, platform label, last-seen timestamp;
- `card_progress`: user ID plus stable card ID, counters, FSRS JSONB state, favorite state and timestamps;
- `review_events`: UUID idempotency key, user ID, device ID, card ID, rating, reviewed timestamp, created timestamp;
- `user_settings`: one row per user with daily limits, theme, session duration and per-field update timestamp data;
- `sync_cursors`: monotonically increasing server sequence or cursor metadata.

Constraints include unique `(user_id, card_id)` progress, primary review-event UUID, valid rating checks, and indexes for user review history and due-card lookup.

Direct anonymous table access is denied. Row Level Security is enabled with no permissive public policies in this phase because the planned serverless API uses server credentials after validating Telegram init data. The schema contains no frontend secrets.

## Prepared API contract

Document these future server routes:

- `POST /api/auth/telegram` — validate init data and return the canonical user;
- `POST /api/sync` — submit outbox mutations after Telegram validation and receive acknowledgements plus changed server state;
- `GET /api/health` — deployment health only, no user data.

The sync route requires raw Telegram init data in an authorization header or signed request header, limits payload size, validates every mutation, and uses a database transaction for event insertion and progress recalculation.

## Environment preparation

Add `.env.example` with public, non-secret settings only:

```dotenv
VITE_API_BASE_URL=
VITE_TELEGRAM_MODE=auto
```

Future server secrets are documented separately and are never prefixed with `VITE_`.

## Files and boundaries

- `src/features/profile/types.ts` — user and identity interfaces.
- `src/features/profile/LocalIdentityProvider.ts` — stable local profile.
- `src/features/profile/profileStore.ts` — active profile state.
- `src/features/profile/ProfileView.vue` — profile and backup UI.
- `src/features/progress/ProgressRepository.ts` — persistence interface.
- `src/features/progress/LocalProgressRepository.ts` — local snapshot implementation and existing migration ownership.
- `src/features/sync/types.ts` — mutations and request/response contracts.
- `src/features/sync/LocalOutboxRepository.ts` — persistent mutation queue.
- `src/features/sync/syncStore.ts` — local-only status now and future worker coordination.
- `src/features/sync/DisabledSyncClient.ts` — no-network default.
- `src/features/sync/HttpSyncClient.ts` — inactive prepared HTTP adapter.
- `src/features/backup/backupSchema.ts` — validation and merge helpers.
- `supabase/migrations/202608180001_telegram_sync_foundation.sql` — future database schema.
- `docs/telegram-sync-api.md` — backend contract and secret requirements.
- `.env.example` — public frontend configuration.

## Error handling

- A repository read failure falls back to an empty in-memory snapshot and reports a recoverable profile warning without overwriting unreadable data.
- An outbox write failure leaves the already-saved local progress intact and displays that synchronization preparation could not be queued.
- Invalid imports are rejected before current state changes.
- Network timeout, unauthorized Telegram data, validation failure, and server error map to distinct sync error messages.
- A failed sync never removes pending mutations.
- A malformed server response is treated as a failed sync and cannot replace local state.

## Verification

Automated tests are not run during implementation at the user's request. Verification uses TypeScript checking, production build, deterministic read-only probes for repository and outbox behavior, SQL syntax inspection, and browser checks for profile states, backup export/import validation, persistence after reload, and unchanged learning flow.

## Completion criteria

This preparation phase is complete when DevRecall has a usable local profile, repository-backed progress persistence, a durable idempotent outbox, export/import backup controls, local-only sync status, inactive typed HTTP contracts, and a Supabase-ready schema. The current application must remain fully usable without network configuration, and enabling real Telegram synchronization later must not require restructuring study views or card content.
