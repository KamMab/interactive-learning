-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- used in URLs, e.g. "mgmt-120b"
  code text not null,                   -- e.g. "MGMT 120B"
  title text not null,                  -- e.g. "Intermediate Accounting II"
  description text default '',
  instructions text default '',         -- course-wide context for Claude
  sort int default 0,
  published boolean default false,
  created_at timestamptz default now()
);

-- Who teaches the course. Each professor can have their own chapters (built from their notes and instructions).
create table if not exists professors (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  slug text not null,                   -- used in URLs, e.g. "smith"
  name text not null,                   -- e.g. "Prof. Smith"
  instructions text default '',         -- how this professor teaches and tests, for Claude
  sort int default 0,
  published boolean default true,
  created_at timestamptz default now(),
  unique (course_id, slug)
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  professor_id uuid references professors(id) on delete cascade,  -- null = shared by every professor
  number int not null,
  title text not null,
  instructions text default '',         -- chapter-specific context for Claude
  content jsonb not null default '{"terms":[],"questions":[],"entries":[]}',
  settings jsonb not null default '{}',
  published boolean default false,
  updated_at timestamptz default now()
);
-- Safe to re-run on a database made from an older version of this file:
alter table chapters add column if not exists professor_id uuid references professors(id) on delete cascade;
alter table chapters drop constraint if exists chapters_course_id_number_key;
create unique index if not exists chapters_course_prof_number
  on chapters (course_id, coalesce(professor_id, '00000000-0000-0000-0000-000000000000'::uuid), number);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  name text not null,
  path text not null,                   -- path inside the "notes" storage bucket
  mime text,
  size int,
  created_at timestamptz default now()
);

-- Future: per-user progress once Google sign-in is turned on.
create table if not exists progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, chapter_id)
);

alter table courses  enable row level security;
alter table chapters enable row level security;
alter table professors enable row level security;
alter table notes    enable row level security;
alter table progress enable row level security;

-- Anyone can read published content. All writes go through the server (service role).
drop policy if exists "public read courses" on courses;
create policy "public read courses" on courses for select using (published);
drop policy if exists "public read professors" on professors;
create policy "public read professors" on professors for select using (published);
drop policy if exists "public read chapters" on chapters;
create policy "public read chapters" on chapters for select using (published);

-- Signed-in users can read and write only their own progress.
drop policy if exists "own progress" on progress;
create policy "own progress" on progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for uploaded notes.
insert into storage.buckets (id, name, public)
values ('notes', 'notes', false)
on conflict (id) do nothing;

-- ============ Accounts and student uploads ============

-- Any email can sign in. (An earlier version only allowed UCLA addresses; these lines remove that rule.)
drop trigger if exists require_ucla_email on auth.users;
drop function if exists public.require_ucla_email();

-- A course with an owner is a student's private course built from their own uploaded notes.
alter table courses add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table courses add column if not exists owner_email text;

-- One row per upload, used for the daily limit and the admin "Student uploads" inbox.
create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  course_id uuid references courses(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  status text not null default 'processing',   -- processing | ready | failed
  error text,
  created_at timestamptz default now()
);
alter table uploads enable row level security;

-- Public reads cover official courses only; students' private courses are served by the server to their owner.
drop policy if exists "public read courses" on courses;
create policy "public read courses" on courses for select using (published and owner_id is null);
drop policy if exists "public read chapters" on chapters;
create policy "public read chapters" on chapters for select
  using (published and exists (select 1 from courses c where c.id = course_id and c.owner_id is null));

-- ============ Publishing, profiles, trending, leaderboard ============

-- The name a student publishes under (and shows on the leaderboard). handle is used in /u/<handle>.
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
drop policy if exists "public read profiles" on profiles;
create policy "public read profiles" on profiles for select using (true);

-- Student sets: 'class' (course notes) or 'fun' (anything: capitals, movie trivia...), shared or private.
alter table courses add column if not exists kind text not null default 'class';         -- class | fun
alter table courses add column if not exists visibility text not null default 'public';   -- public | private
alter table courses add column if not exists created_at timestamptz default now();

drop policy if exists "public read courses" on courses;
create policy "public read courses" on courses for select
  using (published and (owner_id is null or visibility = 'public'));
drop policy if exists "public read chapters" on chapters;
create policy "public read chapters" on chapters for select
  using (published and exists (select 1 from courses c where c.id = course_id and c.published and (c.owner_id is null or c.visibility = 'public')));

-- One row each time someone finishes a round; powers Trending.
create table if not exists play_events (
  id bigserial primary key,
  chapter_id uuid references chapters(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists play_events_recent on play_events (created_at desc);
alter table play_events enable row level security;
create or replace view trending_chapters as
  select chapter_id, count(*)::int as plays
  from play_events where created_at > now() - interval '7 days'
  group by chapter_id;

-- Study-time leaderboard. Everyone can read; each student writes only their own row.
create table if not exists leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  week_key text,
  week_seconds int not null default 0,
  total_seconds int not null default 0,
  updated_at timestamptz default now()
);
alter table leaderboard enable row level security;
drop policy if exists "read leaderboard" on leaderboard;
create policy "read leaderboard" on leaderboard for select using (true);
drop policy if exists "write own leaderboard" on leaderboard;
create policy "write own leaderboard" on leaderboard for insert with check (auth.uid() = user_id);
drop policy if exists "update own leaderboard" on leaderboard;
create policy "update own leaderboard" on leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
