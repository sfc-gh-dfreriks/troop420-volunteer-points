// Troop 420 Volunteer Points - site configuration.
// Leave SUPABASE_URL empty to run in DEMO mode (data lives only in this browser).
window.T420_CONFIG = {
  SUPABASE_URL: "https://svaguavmztvtuswlhdle.supabase.co/rest/v1/",       // e.g. "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_1OMuXYKPjsiHzbM-mTgFlQ_tWcx3S3p",  // public anon key (safe to publish; RLS protects the data)

  DEMO_ADMIN_PASSPHRASE: "committee", // demo mode only - not security, just a gate

  // TEST_MODE: Supabase connected, but the Committee console opens with just a name -
  // no Supabase logins or admins rows needed. Pair with supabase/test_mode_on.sql.
  // Turn OFF (and run supabase/test_mode_off.sql) before real families use the site.
  TEST_MODE: true,

  defaultYear: 2026,
  troopName: "Troop 420",

  // How TroopWebHost annual totals become points. The export holds per-person
  // totals, not events, so these are conversion assumptions the committee owns.
  twh: {
    campingNightsPerTrip: 2,        // 2 camping nights = one overnight-adult trip (25)
    includeCabinNights: true,       // cabin camping nights count toward trips
    serviceHoursPerCredit: 3,       // every 3 service hours = one service volunteer credit (10)
    includeConservationHours: true, // conservation hours add to service hours
    overnightRequiresRegistration: true
  }
};
