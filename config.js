// Troop 420 Volunteer Points - site configuration.
// Leave SUPABASE_URL empty to run in DEMO mode (data lives only in this browser).
window.T420_CONFIG = {
  SUPABASE_URL: "",       // e.g. "https://abcd1234.supabase.co"
  SUPABASE_ANON_KEY: "",  // public anon key (safe to publish; RLS protects the data)

  DEMO_ADMIN_PASSPHRASE: "committee", // demo mode only - not security, just a gate

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
