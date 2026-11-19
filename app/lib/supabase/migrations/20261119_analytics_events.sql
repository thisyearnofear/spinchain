-- Analytics events — durable store for the /api/analytics/sync endpoint.
-- Server-side inserts only (secret key bypasses RLS); no read policies, so
-- rows are invisible to the publishable key. Query via dashboard or the
-- sync route's admin-token GET.

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text,
  payload jsonb not null default '{}'::jsonb,
  session_id text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_occurred on analytics_events(occurred_at desc);
create index if not exists idx_analytics_events_name on analytics_events(name);
create index if not exists idx_analytics_events_session on analytics_events(session_id);

alter table analytics_events enable row level security;
-- No policies: writes/reads only via the secret-key server client.
