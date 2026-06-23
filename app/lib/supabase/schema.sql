-- SpinChain Database Schema
-- Run this in Supabase SQL Editor after creating a project.
--
-- Tables:
--   rider_profiles        — biometric + preference data per wallet
--   ride_summaries        — structured ride results (telemetry stays in Walrus)
--   homework_assignments  — instructor-assigned practice rides
--   progress_snapshots    — daily aggregates for trend tracking
--   auth_nonces           — one-time nonces for wallet sign-in
--   gyms                  — gym registry with calibration profiles
--   bike_calibrations     — per-bike power/HR calibration offsets

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- Auth Nonces (wallet-based sign-in)
-- ============================================================================
create table if not exists auth_nonces (
  nonce text primary key,
  address text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_auth_nonces_address on auth_nonces(address);
create index if not exists idx_auth_nonces_expires on auth_nonces(expires_at);

-- Auto-expire nonces after 5 minutes
-- (cleanup can be done via a scheduled function or app-level check)

-- ============================================================================
-- Rider Profiles
-- ============================================================================
create table if not exists rider_profiles (
  address text primary key,
  goal text,
  experience text,
  frequency text,
  motivation text,
  coach_personality text,
  display_name text,
  -- Biometric fields (Phase 1)
  ftp integer,
  max_hr integer,
  resting_hr integer,
  weight_kg numeric(5,1),
  height_cm integer,
  injuries jsonb default '[]',
  training_zones jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- Ride Summaries
-- ============================================================================
create table if not exists ride_summaries (
  id text primary key,
  idempotency_key text unique,
  rider_address text references rider_profiles(address),
  class_id text,
  class_name text,
  instructor text,
  completed_at timestamptz,
  elapsed_time integer,
  avg_effort integer,
  avg_heart_rate integer,
  avg_power integer,
  effort_tier text,
  zones jsonb,
  walrus_blob_id text,
  sync_status text default 'synced',
  created_at timestamptz default now()
);

create index if not exists idx_ride_summaries_rider on ride_summaries(rider_address);
create index if not exists idx_ride_summaries_completed on ride_summaries(completed_at desc);
create index if not exists idx_ride_summaries_class on ride_summaries(class_id);
create index if not exists idx_ride_summaries_instructor on ride_summaries(instructor);

-- ============================================================================
-- Homework Assignments
-- ============================================================================
create table if not exists homework_assignments (
  id uuid primary key default gen_random_uuid(),
  instructor_address text,
  rider_address text references rider_profiles(address),
  class_id text,
  assigned_at timestamptz default now(),
  due_at timestamptz,
  workout_config jsonb,
  status text default 'assigned',
  completed_at timestamptz,
  ride_id text references ride_summaries(id)
);

create index if not exists idx_homework_rider on homework_assignments(rider_address);
create index if not exists idx_homework_instructor on homework_assignments(instructor_address);
create index if not exists idx_homework_status on homework_assignments(status);

-- ============================================================================
-- Progress Snapshots (daily aggregates)
-- ============================================================================
create table if not exists progress_snapshots (
  rider_address text,
  snapshot_date date,
  avg_power_7d integer,
  avg_effort_7d integer,
  total_rides_7d integer,
  streak_days integer,
  ftp_estimate integer,
  primary key (rider_address, snapshot_date)
);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table rider_profiles enable row level security;
alter table ride_summaries enable row level security;
alter table homework_assignments enable row level security;
alter table progress_snapshots enable row level security;
alter table auth_nonces enable row level security;

-- Rider profiles: riders can read/update own; instructors can read their roster's
create policy "Riders can read own profile"
  on rider_profiles for select
  using (auth.jwt() ->> 'address' = address);

create policy "Riders can insert own profile"
  on rider_profiles for insert
  with check (auth.jwt() ->> 'address' = address);

create policy "Riders can update own profile"
  on rider_profiles for update
  using (auth.jwt() ->> 'address' = address);

-- Ride summaries: riders can read/write own; instructors can read their students'
create policy "Riders can read own rides"
  on ride_summaries for select
  using (auth.jwt() ->> 'address' = rider_address);

create policy "Riders can insert own rides"
  on ride_summaries for insert
  with check (auth.jwt() ->> 'address' = rider_address);

create policy "Riders can update own rides"
  on ride_summaries for update
  using (auth.jwt() ->> 'address' = rider_address);

-- Homework: riders read their own; instructors read/insert their assigned
create policy "Riders can read own homework"
  on homework_assignments for select
  using (auth.jwt() ->> 'address' = rider_address);

create policy "Instructors can read assigned homework"
  on homework_assignments for select
  using (auth.jwt() ->> 'address' = instructor_address);

create policy "Instructors can assign homework"
  on homework_assignments for insert
  with check (auth.jwt() ->> 'address' = instructor_address);

create policy "Instructors can update homework"
  on homework_assignments for update
  using (auth.jwt() ->> 'address' = instructor_address);

-- Progress: riders read own only
create policy "Riders can read own progress"
  on progress_snapshots for select
  using (auth.jwt() ->> 'address' = rider_address);

-- Auth nonces: no RLS needed (managed via service role only)
-- Service role bypasses RLS, so nonce generation/verification is server-side

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists rider_profiles_updated_at
  before update on rider_profiles
  for each row execute function update_updated_at();

-- ============================================================================
-- Gyms (registry for cross-gym support)
-- ============================================================================
create table if not exists gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  brand text not null default 'generic',
  -- Default calibration offsets for this gym's bike model
  power_offset integer default 0,
  power_scale real default 1.0,
  hr_offset integer default 0,
  hr_scale real default 1.0,
  -- Metadata
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_gyms_name on gyms(name);

-- ============================================================================
-- Bike Calibrations (per-bike within a gym)
-- ============================================================================
create table if not exists bike_calibrations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms(id) on delete cascade,
  bike_id text not null,
  -- Calibration offsets specific to this bike
  power_offset integer default 0,
  power_scale real default 1.0,
  hr_offset integer default 0,
  hr_scale real default 1.0,
  -- Last calibration date
  calibrated_at timestamptz default now(),
  -- Unique bike within gym
  unique (gym_id, bike_id)
);

create index if not exists idx_bike_calibrations_gym on bike_calibrations(gym_id);

-- RLS for gyms: anyone can read, only creator/admin can write
alter table gyms enable row level security;
create policy "Anyone can read gyms"
  on gyms for select
  using (true);
create policy "Creators can manage own gyms"
  on gyms for all
  using (auth.jwt() ->> 'address' = created_by or created_by is null);

-- RLS for bike calibrations: anyone can read, gym creator can write
alter table bike_calibrations enable row level security;
create policy "Anyone can read bike calibrations"
  on bike_calibrations for select
  using (true);
create policy "Gym creators can manage bike calibrations"
  on bike_calibrations for all
  using (
    exists (
      select 1 from gyms
      where gyms.id = gym_id
      and (gyms.created_by = auth.jwt() ->> 'address' or gyms.created_by is null)
    )
  );
