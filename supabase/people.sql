-- People (relationship manager). Run once in the Supabase SQL editor.
-- Safe to run again: every statement is "if not exists" or drop-then-create.
--
-- Who can use it: only accounts listed in people_access. The app shows the
-- People button to those accounts, and the policies below refuse everyone
-- else at the database, whatever the app shows.

-- 1. Who has the People screen ------------------------------------------------
create table if not exists public.people_access (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.people_access enable row level security;
-- An account can see its own row and nothing else; nobody can add rows from the app.
drop policy if exists "people_access: read own row" on public.people_access;
create policy "people_access: read own row" on public.people_access
  for select using (user_id = auth.uid());

-- >>> Put the Google address you sign in to tabs.day with here, then run. <<<
insert into public.people_access (user_id)
select id from auth.users where email = 'YOUR_GOOGLE_EMAIL_HERE'
on conflict do nothing;

-- 2. People -------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'personal' check (kind in ('personal', 'work', 'both')),
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  birthday_year smallint check (birthday_year between 1900 and 2100),
  spouse text check (char_length(spouse) <= 200),
  kids text check (char_length(kids) <= 500),
  employer text check (char_length(employer) <= 200),
  from_place text check (char_length(from_place) <= 200),
  sports_teams text check (char_length(sports_teams) <= 500),
  notes text check (char_length(notes) <= 5000),
  -- "Keep in touch every N months"; null = no reminder to reach out
  touch_months smallint check (touch_months between 1 and 24),
  created_at timestamptz not null default now()
);
create index if not exists people_user_idx on public.people (user_id);
alter table public.people enable row level security;
drop policy if exists "people: own rows, People access only" on public.people;
create policy "people: own rows, People access only" on public.people
  for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.people_access a where a.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.people_access a where a.user_id = auth.uid())
  );

-- 3. Dated updates on a person ("Oct 3: started a new job") --------------------
create table if not exists public.person_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  happened_on date not null default current_date,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists person_updates_person_idx on public.person_updates (person_id);
alter table public.person_updates enable row level security;
drop policy if exists "person_updates: own rows, People access only" on public.person_updates;
create policy "person_updates: own rows, People access only" on public.person_updates
  for all
  using (
    user_id = auth.uid()
    and exists (select 1 from public.people_access a where a.user_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.people_access a where a.user_id = auth.uid())
  );

-- 4. Tasks that belong to a person ---------------------------------------------
-- A reminder is an ordinary task with person_id set. Deleting a person keeps
-- their finished tasks and just unlinks them. person_tag = 'birthday' marks the
-- yearly birthday task the app keeps in step with the person's birthday.
alter table public.todos
  add column if not exists person_id uuid references public.people (id) on delete set null,
  add column if not exists person_tag text;
create index if not exists todos_person_idx on public.todos (person_id) where person_id is not null;

-- 5. Spouses are links between two profiles (added 2026-11-22) ------------------
-- The app keeps the link on both profiles. Deleting one clears it on the other.
-- The older free-text people.spouse column is no longer written to.
alter table public.people
  add column if not exists spouse_id uuid references public.people (id) on delete set null;
