# Telegram Sync Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare DevRecall for one Telegram identity shared by Desktop and iPhone through repository-backed progress, an offline outbox, a local profile, backups, typed sync contracts, and a Supabase-ready schema.

**Architecture:** Progress persistence moves behind a repository while Pinia keeps the same UI-facing state. Every local mutation receives a UUID and is appended to a durable outbox; network synchronization remains disabled until a backend URL and verified Telegram init data exist. Profile, backup, and sync modules remain independent of study views.

**Tech Stack:** Vue 3, TypeScript 5.9, Pinia, Vue Router, Zod, localStorage, FSRS, PostgreSQL/Supabase SQL.

**Spec:** `docs/superpowers/specs/2026-08-18-telegram-sync-foundation-design.md`

## Global Constraints

- Telegram is the only future production identity; do not add email or passwords.
- Never trust `initDataUnsafe` as authentication and never put bot or service-role secrets in Vite variables.
- Keep current progress, favorites, FSRS scheduling, settings, and review history compatible.
- Local learning must work when sync is disabled or offline.
- Do not send network requests when `VITE_API_BASE_URL` is empty.
- Do not run automated tests because the user explicitly requested no test runs.
- Verify with type checking, production build, deterministic probes, SQL inspection, and browser flows.

---

### Task 1: Extract local progress persistence

**Files:**
- Create: `src/features/progress/ProgressRepository.ts`
- Create: `src/features/progress/LocalProgressRepository.ts`
- Modify: `src/features/progress/progressStore.ts`

**Interfaces:**
- Produces: `ProgressRepository`, `ProgressBackupPayload`, and `LocalProgressRepository`.
- Consumes: `ProgressSnapshot`, `migrateProgressSnapshot`, and current storage keys.

- [ ] **Step 1: Define the repository contract**

```ts
export interface ProgressBackupPayload {
  snapshot: ProgressSnapshot
  rawLegacyBackup?: string
}

export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>
  save(snapshot: ProgressSnapshot): Promise<void>
  exportBackup(): Promise<ProgressBackupPayload>
  importBackup(value: unknown): Promise<ProgressSnapshot>
  clear(): Promise<void>
}
```

- [ ] **Step 2: Move localStorage ownership into LocalProgressRepository**

Move `devrecall:v2`, `devrecall:v1`, and `devrecall:v1:backup` handling from the store. `load()` tries v2, then migrates v1 and saves the backup, then returns an empty v2 snapshot. `save()` throws a descriptive error without modifying in-memory state. `importBackup()` accepts either a snapshot or a wrapper containing `snapshot`, runs `migrateProgressSnapshot`, saves only after full conversion, and returns the saved snapshot.

- [ ] **Step 3: Inject the repository into the store**

Create one `LocalProgressRepository` instance at module scope. Load it before initializing refs by using its synchronous internal methods exposed through async-compatible methods plus a `loadSync()` helper specific to the local implementation. Keep the public repository interface asynchronous for the future remote implementation. The store must expose `exportProgressBackup()` and `importProgressBackup(value)`.

- [ ] **Step 4: Verify repository round-trip with a tsx probe**

Use a small in-memory Storage implementation, save a snapshot with one favorite and one FSRS card, load it again, and print preserved counts. Expected: version 2, favorite true, one review event.

---

### Task 2: Add durable sync mutations and outbox

**Files:**
- Create: `src/features/sync/types.ts`
- Create: `src/features/sync/LocalOutboxRepository.ts`

**Interfaces:**
- Produces: `SyncMutation`, `ReviewSyncMutation`, `FavoriteSyncMutation`, `SettingsSyncMutation`, `SyncRequest`, `SyncResponse`, and `LocalOutboxRepository`.

- [ ] **Step 1: Define mutation contracts**

Review mutation contains mutation UUID, card ID, rating, and reviewed timestamp. Favorite mutation contains the absolute boolean value. Settings mutation contains a partial settings patch. Every mutation contains `createdAt` and a discriminated `type`.

- [ ] **Step 2: Implement local outbox storage**

Use key `devrecall:sync-outbox:v1`. Implement `list()`, `append(mutation)`, `appendMany(mutations)`, `acknowledge(ids)`, `replace(mutations)`, and `clear()`. Deduplicate by mutation ID while preserving creation order. Invalid stored JSON returns an empty list without overwriting the raw value.

- [ ] **Step 3: Add deterministic outbox probe**

Append the same ID twice and another ID once, acknowledge the first ID, and print queue sizes `2` then `1`.

---

### Task 3: Connect local actions to the outbox

**Files:**
- Modify: `src/features/progress/progressStore.ts`
- Modify: `src/features/progress/types.ts`

**Interfaces:**
- Consumes: `LocalOutboxRepository` and sync mutation types.
- Produces: `pendingSyncCount`, `outboxWarning`, and `clearOutboxWarning`.

- [ ] **Step 1: Give review events caller-created IDs**

Generate one UUID at the start of `recordReview`. Use it as both `ReviewEvent.id` and `ReviewSyncMutation.id`. Include the exact same rating and timestamp in both objects.

- [ ] **Step 2: Queue favorite and settings mutations**

After local state changes, append absolute `favorite.changed` and `settings.updated` mutations. Reset clears both progress repository and outbox.

- [ ] **Step 3: Keep progress successful if queue persistence fails**

Wrap only the outbox append in `try/catch`. Local state and progress save remain valid. Set `outboxWarning` to `Прогресс сохранён, но изменение пока не добавлено в очередь синхронизации.`

- [ ] **Step 4: Expose reactive pending count**

Maintain `pendingSyncCount` from the current outbox list and refresh it after append, acknowledge, import, or reset.

- [ ] **Step 5: Run type checking**

Run `npm run typecheck`. Expected: exit code 0.

---

### Task 4: Add identity, sync client, and stores

**Files:**
- Create: `src/features/profile/types.ts`
- Create: `src/features/profile/LocalIdentityProvider.ts`
- Create: `src/features/profile/profileStore.ts`
- Create: `src/features/sync/SyncClient.ts`
- Create: `src/features/sync/DisabledSyncClient.ts`
- Create: `src/features/sync/HttpSyncClient.ts`
- Create: `src/features/sync/syncStore.ts`
- Modify: `src/env.d.ts`

**Interfaces:**
- Produces: `AppUser`, `UserIdentityProvider`, `SyncClient`, `DisabledSyncClient`, `HttpSyncClient`, `useProfileStore`, and `useSyncStore`.

- [ ] **Step 1: Implement stable local identity**

Store a UUID under `devrecall:local-user-id:v1`. Return `{ id, displayName: 'Локальный профиль', mode: 'local' }`. `getTelegramInitData()` returns null.

- [ ] **Step 2: Implement sync clients**

`DisabledSyncClient.sync()` throws a typed `SyncDisabledError`. `HttpSyncClient` accepts a base URL, uses a 15-second AbortController timeout, POSTs JSON to `/api/sync`, sends raw Telegram init data through `Authorization: tma <initData>`, rejects non-2xx responses, and validates required response fields before returning. It is instantiated only when a non-empty base URL exists.

- [ ] **Step 3: Implement profile store**

Load the local identity once and expose `user`, `loading`, and `error`.

- [ ] **Step 4: Implement local-only sync store**

Expose status union `local | syncing | synced | offline | error`, pending count, last synced timestamp, last error, device ID, and `retry()`. Without API URL or Telegram init data, `retry()` sets status to `local` and performs no fetch. Listen to online/offline events only as hints.

- [ ] **Step 5: Add Vite environment types**

Declare `VITE_API_BASE_URL?: string` and `VITE_TELEGRAM_MODE?: 'auto' | 'disabled'`.

---

### Task 5: Add validated backup export and import

**Files:**
- Create: `src/features/backup/backupSchema.ts`
- Create: `src/features/backup/backupService.ts`

**Interfaces:**
- Produces: `DevRecallBackup`, `createBackup`, `downloadBackup`, `parseBackupFile`, and `importBackup`.
- Consumes: progress repository, outbox repository, Zod, and local `AppUser` metadata.

- [ ] **Step 1: Define the backup schema**

Require `format: 'devrecall-backup'`, `version: 1`, ISO `exportedAt`, a progress snapshot object, an outbox array, and optional local profile fields. Explicitly omit Telegram init data.

- [ ] **Step 2: Implement export**

Serialize pretty JSON, create a Blob, generate a temporary object URL, trigger download named `devrecall-backup-YYYY-MM-DD.json`, then revoke the URL.

- [ ] **Step 3: Implement safe import**

Read file text, parse JSON, validate with Zod, export the current state as a recovery download, import progress through the repository, merge outbox mutations by ID, and return the new snapshot. Do not modify current state until parsing and validation succeed.

- [ ] **Step 4: Probe validation**

Parse one valid in-memory backup and one object with the wrong format. Expected: valid succeeds and invalid returns a Russian validation error.

---

### Task 6: Build the profile page

**Files:**
- Create: `src/features/profile/ProfileView.vue`
- Modify: `src/app/router.ts`
- Modify: `src/features/home/HomeView.vue`

**Interfaces:**
- Consumes: profile store, sync store, progress store, backup service, and hidden file input.
- Produces: route `/profile`.

- [ ] **Step 1: Create profile header and sync card**

Show initials avatar for the local profile, display name, `Локальный режим`, sync status label, queued-change count, last success time, and a retry button only for offline/error states. Explain that Telegram Desktop and iPhone will share one account after backend activation.

- [ ] **Step 2: Add profile statistics**

Show learned cards, total reviews, favorites, and current streak using existing progress data.

- [ ] **Step 3: Add backup and settings actions**

Provide `Скачать резервную копию`, `Восстановить из файла`, `Настройки обучения`, and reset navigation. Import uses a hidden `.json` input and displays success or validation error without leaving the page.

- [ ] **Step 4: Add navigation**

Change the home top-right account action to `/profile` with a user icon. Keep Settings accessible from the profile page.

- [ ] **Step 5: Verify local-only browser flow**

Open profile, check status, export backup, reject a malformed file, reload, and confirm the same local user ID and progress counts remain.

---

### Task 7: Prepare environment, API documentation, and SQL schema

**Files:**
- Create: `.env.example`
- Create: `docs/telegram-sync-api.md`
- Create: `supabase/migrations/202608180001_telegram_sync_foundation.sql`

**Interfaces:**
- Documents future `/api/auth/telegram`, `/api/sync`, and `/api/health` routes.
- Produces database tables for users, devices, progress, events, settings, and sync cursors.

- [ ] **Step 1: Add public environment template**

Only include blank `VITE_API_BASE_URL` and `VITE_TELEGRAM_MODE=auto`. Document that bot token and Supabase service role belong only to server configuration.

- [ ] **Step 2: Write API contract**

Include request/response JSON examples, Telegram signature validation requirement, idempotency rules, payload limits, server-authoritative FSRS recalculation, cursor semantics, and distinct 401/409/422/429/500 behavior.

- [ ] **Step 3: Create SQL migration**

Use `pgcrypto` for UUIDs. Create:

- `users(id uuid primary key, telegram_id bigint unique not null, display_name text not null, photo_url text, created_at timestamptz, updated_at timestamptz)`;
- `devices(id uuid primary key, user_id uuid references users on delete cascade, client_device_id uuid not null, platform text, last_seen_at timestamptz, unique(user_id, client_device_id))`;
- `card_progress(user_id uuid, card_id text, fsrs jsonb not null default '{}', counters, favorite boolean, updated_at timestamptz, primary key(user_id, card_id))`;
- `review_events(id uuid primary key, user_id uuid, device_id uuid, card_id text, rating text check, reviewed_at timestamptz, created_at timestamptz)`;
- `user_settings(user_id uuid primary key, settings jsonb, field_updated_at jsonb, updated_at timestamptz)`;
- `sync_changes(sequence bigint generated always as identity primary key, user_id uuid, entity_type text, entity_key text, changed_at timestamptz)`.

Add user/time and due-expression indexes where PostgreSQL permits immutable expressions. Enable RLS on every user-data table and create no public access policies.

- [ ] **Step 4: Inspect SQL**

Search for all required tables, RLS statements, unique constraints, and rating check values. Confirm no secret literals exist.

---

### Task 8: Final integration and verification

**Files:**
- Modify: documentation only if browser verification reveals a mismatch.

**Interfaces:**
- Verifies that the preparation layer does not break study behavior.

- [ ] **Step 1: Run deterministic validation probes**

Verify progress repository round-trip, duplicate outbox suppression, acknowledgement, backup validation, and disabled sync making zero fetch calls.

- [ ] **Step 2: Run production build**

Run `npm run build`. Expected: type checking and Vite exit 0; the existing large-chunk warning is acceptable.

- [ ] **Step 3: Verify browser behavior**

Check home, profile, profile statistics, local sync status, settings link, backup export button, import validation message, random study setup, one study card reveal, and statistics. Do not leave test review progress behind.

- [ ] **Step 4: Review repository state**

Run `git diff --check` and `git status --short`. Expected: no whitespace errors and only feature-related files plus the user's existing content changes.
