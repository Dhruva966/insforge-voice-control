-- voice_calls: one row per Twilio call
-- NOTE: "calls" table exists from prior project (cadence-schema) — using voice_calls to avoid conflict
create table if not exists voice_calls (
  id           uuid primary key default gen_random_uuid(),
  call_sid     text unique not null,
  caller_phone text,
  started_at   timestamptz default now(),
  ended_at     timestamptz,
  duration_s   int,
  action_count int default 0,
  status       text default 'active' check (status in ('active', 'completed', 'error'))
);

-- events: all realtime events for replay/audit
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid references voice_calls(id) on delete cascade,
  call_sid   text not null,
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz default now()
);

-- indexes
create index if not exists events_call_id_idx on events(call_id);
create index if not exists events_created_at_idx on events(created_at desc);

-- RLS
alter table voice_calls enable row level security;
alter table events enable row level security;

-- service role can do everything (backend uses admin key)
create policy service_write_voice_calls on voice_calls for all using (true);
create policy service_write_events on events for all using (true);
