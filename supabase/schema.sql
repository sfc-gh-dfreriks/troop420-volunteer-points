-- Troop 420 Volunteer Points - Supabase schema + row-level security.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists families (
  year int not null, name text not null, scouts int default 0,
  target_override int,          -- committee-set (hardship / in-confidence). Number only, never a reason.
  join_quarter int check (join_quarter between 1 and 4),
  primary key (year, name)
);

create table if not exists adults (
  year int not null, name text not null, family_name text not null,
  registered boolean default true, ypt_current boolean,
  primary key (year, name)
);

create table if not exists entries (
  id bigint generated always as identity primary key,
  year int not null, family_name text not null, adult_name text not null,
  role_id text not null, contribution text not null,
  band int not null, points int not null check (points between 0 and 1000),
  work_date date not null,
  source text not null check (source in ('twh','claim','admin')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes text, submitter_email text,           -- contact for the committee only
  reviewed_by text, reviewed_at timestamptz, review_note text,
  created_at timestamptz default now()
);
create index if not exists entries_year on entries(year, status);

create table if not exists admins (
  email text primary key,
  adult_name text,               -- the admin's own name on the roster (blocks self-approval)
  is_chair boolean default false
);

create table if not exists settings (
  year int primary key, in_lieu_rate text, published_through text, family_overrides jsonb default '{}'
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

create or replace function my_adult_name() returns text
language sql stable security definer set search_path = public as $$
  select adult_name from admins where lower(email) = lower(auth.jwt() ->> 'email')
$$;

alter table families enable row level security;
alter table adults   enable row level security;
alter table entries  enable row level security;
alter table admins   enable row level security;
alter table settings enable row level security;

-- Public read of roster/targets/settings; admin write.
do $$ declare t text; begin
  foreach t in array array['families','adults','settings'] loop
    execute format('drop policy if exists %1$s_read on %1$s', t);
    execute format('create policy %1$s_read on %1$s for select using (true)', t);
    execute format('drop policy if exists %1$s_admin on %1$s', t);
    execute format('create policy %1$s_admin on %1$s for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop; end $$;

-- Admins table: an admin can see the list; managed from the Supabase dashboard.
drop policy if exists admins_read on admins;
create policy admins_read on admins for select to authenticated using (is_admin() or lower(email) = lower(auth.jwt() ->> 'email'));

-- Entries: full rows only for admins (contact emails stay private).
drop policy if exists entries_admin_read on entries;
create policy entries_admin_read on entries for select to authenticated using (is_admin());

-- Anyone may submit a claim - it lands as pending and unreviewed.
drop policy if exists entries_claim on entries;
create policy entries_claim on entries for insert to anon, authenticated
  with check (status = 'pending' and source = 'claim' and reviewed_by is null);

-- Admins add/import entries, but may never approve a line for themselves
-- (the Chair's own entry needs a second committee member).
drop policy if exists entries_admin_insert on entries;
create policy entries_admin_insert on entries for insert to authenticated
  with check (is_admin() and (status <> 'approved' or source = 'twh' or adult_name is distinct from my_adult_name()));

drop policy if exists entries_admin_update on entries;
create policy entries_admin_update on entries for update to authenticated
  using (is_admin())
  with check (is_admin() and (status <> 'approved' or adult_name is distinct from my_adult_name()));

drop policy if exists entries_admin_delete on entries;
create policy entries_admin_delete on entries for delete to authenticated using (is_admin());

-- Public view: approved lines only, no contact details.
create or replace view public_entries as
  select id, year, family_name, adult_name, role_id, contribution, band, points, work_date,
         source, status, reviewed_by, reviewed_at
  from entries where status = 'approved';
grant select on public_entries to anon, authenticated;

-- After running: Authentication -> Users -> Add user (email + password) for each
-- committee member, then:
--   insert into admins (email, adult_name, is_chair) values ('chair@example.org', 'Jane Doe', true);
