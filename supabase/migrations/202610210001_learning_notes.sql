create table if not exists public.learning_notes (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  links jsonb not null default '[]'::jsonb,
  is_done boolean not null default false,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists learning_notes_user_updated_idx
  on public.learning_notes (user_id, updated_at desc);

alter table public.learning_notes enable row level security;

revoke all on public.learning_notes from anon, authenticated;
grant select, insert, update, delete on public.learning_notes to service_role;

comment on table public.learning_notes is 'Private learning follow-ups. Access only through the Telegram-authenticated server API; deleted rows are retained as sync tombstones.';
