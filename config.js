// Troop 420 Volunteer Points - site configuration.
// Leave SUPABASE_URL empty to run in DEMO mode (data lives only in this browser).
window.T420_CONFIG = {
  SUPABASE_URL: "https://svaguavmztvtuswlhdle.supabase.co",       // e.g. "https://abcd1234.supabase.co"
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
  },

  // Leadership + event-lead credit from two more TroopWebHost exports (troop420-tools):
  //   54040 Membership > Troop Directories > Adult Leaders By Position  (Troop, Position, Adult, Start)
  //   53104 Calendar > Export Events To Excel                          (Type, Event, Start, Leaders, ...)
  // These become PENDING suggestions in the approval queue - the committee confirms each one.
  // Values are role ids from rules.js; null = no points. Unknown positions/types are listed in the preview.
  twhPositions: {
    "Scoutmaster": "scoutmaster",
    "Committee Chairman": "committee_chair", "Committee Chair": "committee_chair",
    "Assistant Scoutmaster": "asm_active",           // committee checks "active" (attends most outings)
    "Treasurer": "treasurer",
    "Advancement Coordinator": "advancement_chair", "Advancement Chair": "advancement_chair",
    "Fund Raising Coordinator": "fundraising_chair",
    "Membership Coordinator": "membership_chair",
    "Secretary": "secretary",
    "Webmaster": "communications",
    "Medical Forms Coordinator": "medical_forms",
    "Training Coordinator": "training_coord",
    "Outdoor Activities Coordinator": "program_outdoor_chair",
    "Quartermaster": "equipment_chair", "Equipment Coordinator": "equipment_chair",
    "Chaplain": "chaplain",
    "Merit Badge Counselor": "register_mbc",         // only if registered during the year
    "IOLS Trained": "iols",                          // only if completed during the year
    "Committee Member": null, "Chartered organization representative": null, "Unit Commissioner": null,
    "Unit College Scout Reserve": null, "BUMC Secretary": null,
    "Board of Review Coordinator": null              // no line in the points system; boards are claimed per board
  },
  twhOnlyIfStartedInYear: ["register_mbc", "iols"],

  // Attendance credit from 45935 Calendar > Export Event Participation To Excel (one row per person per event).
  // Rules are tried in order; first match wins. Adults only, events in the year that have already happened.
  // coversNights: the event's camping nights are taken OUT of the annual-summary overnight credit,
  // because a week in the field is priced at 60, not 25 per two nights (no double counting).
  twhAttendance: [
    { role: "high_adventure_adult", eventType: "High Adventure Trek", minNights: 4, coversNights: true },
    { role: "summer_camp_week", name: "summer camp", minNights: 4, coversNights: true },
    { role: "wood_badge", name: "wood ?badge", coversNights: true },
    { role: "ptc", name: "philmont training center|\\bPTC\\b", coversNights: true },
    { role: "iols", name: "IOLS|outdoor leader skills", coversNights: true },
    { role: "position_training", eventType: "Training", name: "adult training|wilderness first aid|training conference|basic leader|SYT|ILST trainer", coversNights: false }
  ],
  twhEventLeadTypes: {
    "Community Service": "service_lead",
    "Conservation-related Service Project": "service_lead",
    "Troop Service Day": "service_lead",
    "Fundraiser": "fundraiser_lead",
    "Tree Lot Fundraiser": "fundraiser_shift",
    "Court of Honor": "coh_coord", "Eagle Court of Honor": "coh_coord",
    "Merit Badge Clinic": "mb_counselling", "MB Day / Weekend": "mb_counselling",
    "Recruiting Event": "recruiting_night",
    "Board of Review": "board_of_review",
    "Hike": "day_campout", "Outing / Field Trip": "day_campout", "Cycling": "day_campout",
    // Campouts / treks: no lead line - nights already earn overnight credit (no double counting).
    "Campout": null, "High Adventure Trek": null, "Training / Campout": null, "Trek Training": null,
    // Meetings, conferences, training and calendar markers: no lead points.
    "Troop Meeting": null, "Patrol Meeting": null, "Committee Meeting": null, "SM Conference": null,
    "SPL/ASPL Biweekly Meeting": null, "OA": null, "Training": null, "Holiday": null, "Other": null,
    "Trail to Eagle": null, "Advancement Deadline": null, "Medical Forms Review": null,
    "Setup / Teardown": null, "Tree recycle": null
  }
};
