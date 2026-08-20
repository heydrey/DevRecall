create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  display_name text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  client_device_id uuid not null,
  platform text,
  last_seen_at timestamptz not null default now(),
  unique (user_id, client_device_id)
);

create table if not exists public.card_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  card_id text not null,
  status text not null default 'new' check (status in ('new', 'learning', 'review', 'mastered')),
  repetitions integer not null default 0 check (repetitions >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  fsrs jsonb not null default '{}'::jsonb,
  favorite boolean not null default false,
  favorite_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.review_events (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  card_id text not null,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  field_updated_at jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_changes (
  sequence bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type text not null,
  entity_key text not null,
  changed_at timestamptz not null default now()
);

create index if not exists review_events_user_reviewed_idx
  on public.review_events (user_id, reviewed_at desc);

create index if not exists review_events_user_card_idx
  on public.review_events (user_id, card_id, reviewed_at, id);

create index if not exists card_progress_user_due_idx
  on public.card_progress (user_id, ((fsrs ->> 'due')));

create index if not exists sync_changes_user_sequence_idx
  on public.sync_changes (user_id, sequence);

alter table public.users enable row level security;
alter table public.devices enable row level security;
alter table public.card_progress enable row level security;
alter table public.review_events enable row level security;
alter table public.user_settings enable row level security;
alter table public.sync_changes enable row level security;

comment on table public.review_events is 'Append-only idempotent review events. The UUID is supplied by the client mutation.';
comment on table public.sync_changes is 'Monotonic per-user change feed consumed through the authenticated server API.';
