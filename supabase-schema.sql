-- Home App database schema
-- Run this once in Supabase: Project > SQL Editor > New Query > paste > Run

-- Family members
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#FF8552',
  is_kid boolean not null default false,
  created_at timestamptz not null default now()
);

-- Chores (the task definitions)
create table if not exists chores (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assigned_to uuid references members(id) on delete set null,
  points integer not null default 5,
  repeat text not null default 'once', -- 'once', 'daily', 'weekly'
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Chore completion log (one row per time a chore is done)
create table if not exists chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid references chores(id) on delete cascade,
  completed_by uuid references members(id) on delete set null,
  completed_at timestamptz not null default now()
);

-- Calendar events (local events; Google Calendar sync handled separately)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  member_id uuid references members(id) on delete set null,
  notes text,
  source text not null default 'local', -- 'local' or 'google'
  google_event_id text,
  created_at timestamptz not null default now()
);

-- Meal plan (one row per date + meal slot)
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text not null default 'dinner', -- 'breakfast', 'lunch', 'dinner'
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (date, slot)
);

-- Household inventory
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric not null default 1,
  unit text default '',
  low_threshold numeric not null default 1,
  category text default 'other',
  updated_at timestamptz not null default now()
);

-- Shopping list (can be manually added or auto-added from low inventory)
create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity text default '',
  checked boolean not null default false,
  auto_added boolean not null default false,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Rewards ledger (points earned/spent per member)
create table if not exists reward_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on everything
alter table members enable row level security;
alter table chores enable row level security;
alter table chore_completions enable row level security;
alter table events enable row level security;
alter table meals enable row level security;
alter table inventory_items enable row level security;
alter table shopping_items enable row level security;
alter table reward_events enable row level security;

-- Simple policy: anyone with the app's shared password (see app login) can read/write.
-- This app uses a single shared household passcode rather than individual logins,
-- so access control happens at the app level. These policies allow the app's
-- Supabase key to read/write all rows.
create policy "household full access" on members for all using (true) with check (true);
create policy "household full access" on chores for all using (true) with check (true);
create policy "household full access" on chore_completions for all using (true) with check (true);
create policy "household full access" on events for all using (true) with check (true);
create policy "household full access" on meals for all using (true) with check (true);
create policy "household full access" on inventory_items for all using (true) with check (true);
create policy "household full access" on shopping_items for all using (true) with check (true);
create policy "household full access" on reward_events for all using (true) with check (true);
