-- Granular rider consent (Phase 2). Additive; no existing data touched.
-- Consent-gated writes (cloud ride history, instructor live view) are denied
-- server-side until a granted row exists for the current policy version.
create table if not exists rider_consents (
  address text not null,
  scope text not null check (scope in ('cloud_history', 'ai_voice', 'instructor_live', 'public_export')),
  granted boolean not null default false,
  policy_version text not null,
  updated_at timestamptz not null default now(),
  primary key (address, scope)
);

alter table rider_consents enable row level security;
