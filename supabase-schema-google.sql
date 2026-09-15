-- Run this in Supabase SQL Editor AFTER the main schema, to support
-- two-way Google Calendar sync.

-- Stores the household's Google refresh token.
-- Note: no RLS policies are added on purpose — this means the app's
-- normal browser key (publishable key) CANNOT read this table at all.
-- Only the Supabase secret key, used by the server-side sync function,
-- can access it. This keeps the Google token out of browser reach.
create table if not exists google_tokens (
  id text primary key,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table google_tokens enable row level security;

-- Allow matching Google events to our local events table without duplicates
create unique index if not exists events_google_event_id_idx
  on events(google_event_id)
  where google_event_id is not null;
