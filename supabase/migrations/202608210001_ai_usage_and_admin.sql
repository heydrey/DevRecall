create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  model text not null,
  mode text not null check (mode in ('simple', 'deep')),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  rate_limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

grant select, insert, update, delete on table public.ai_usage_events to service_role;

comment on table public.ai_usage_events is 'Server-side usage log for AI explanations shown in the private admin dashboard.';
