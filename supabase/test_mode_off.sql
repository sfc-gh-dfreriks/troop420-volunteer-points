-- TEST MODE OFF - removes the open test policies; schema.sql's real rules apply again.
-- Also set TEST_MODE: false in config.js. Optional: clear test data (last block).

do $$ declare t text; begin
  foreach t in array array['families','adults','settings','entries'] loop
    execute format('drop policy if exists %1$s_test_anon on %1$s', t);
  end loop; end $$;

select 'TEST MODE OFF' as status;

-- Optional: wipe everything entered during testing (uncomment to run)
-- delete from entries; delete from adults; delete from families; delete from settings;
