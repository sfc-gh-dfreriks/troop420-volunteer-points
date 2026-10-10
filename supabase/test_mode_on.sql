-- TEST MODE ON - lets the anon (not-signed-in) role do everything an admin can,
-- so the committee console works without Supabase logins or admins rows.
-- Run AFTER schema.sql. Anyone with the site link can approve/delete while this is on.
-- Undo with test_mode_off.sql.

do $$ declare t text; begin
  foreach t in array array['families','adults','settings','entries'] loop
    execute format('drop policy if exists %1$s_test_anon on %1$s', t);
    execute format('create policy %1$s_test_anon on %1$s for all to anon, authenticated using (true) with check (true)', t);
  end loop; end $$;

-- the console reads full rows (incl. pending) straight from entries
grant select, insert, update, delete on families, adults, settings, entries to anon;

select 'TEST MODE ON' as status;
