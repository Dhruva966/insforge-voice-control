-- calls: one row per Twilio call
create table calls (
  id           uuid primary key default gen_random_uuid(),
  call_sid     text unique not null,
  started_at   timestamptz default now(),
  ended_at     timestamptz,
  duration_s   int,
  action_count int default 0,
  status       text default 'active' check (status in ('active', 'completed', 'error'))
);

-- events: all realtime events for replay/audit
create table events (
  id         uuid primary key default gen_random_uuid(),
  call_id    uuid references calls(id) on delete cascade,
  call_sid   text not null,
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz default now()
);

-- indexes
create index events_call_id_idx on events(call_id);
create index events_created_at_idx on events(created_at desc);

-- RLS
alter table calls enable row level security;
alter table events enable row level security;

-- service role can do everything (backend uses service key)
create policy "service_write_calls"  on calls  for all using (true);
create policy "service_write_events" on events for all using (true);
