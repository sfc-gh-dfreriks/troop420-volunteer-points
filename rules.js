// Troop 420 Adult Volunteer Points System - rules engine.
// Source of truth: Troop_420_Adult_Volunteer_Points_System.docx (revised proposal).
(function () {
  const LADDER = [100, 60, 40, 25, 15, 10, 5];
  const BANDS = {
    100: "Executive", 60: "Senior chair / week-long field", 40: "Year-long coordinator",
    25: "Event lead / overnight adult", 15: "Half-day support", 10: "Task", 5: "Micro-task", 0: "Prerequisite"
  };

  // kind: post = year-long post (claimed once), each = per occurrence.
  // cap: shared cap group. reg: registered adult required.
  const R = (id, group, name, pts, kind, extra = {}) => ({ id, group, name, pts, kind, ...extra });
  const CATALOG = [
    R("committee_chair", "Executive posts", "Committee Chair", 100, "post", { chair: true }),
    R("scoutmaster", "Executive posts", "Scoutmaster", 100, "post", { reg: true }),

    R("treasurer", "Senior chairs", "Treasurer", 60, "post"),
    R("advancement_chair", "Senior chairs", "Advancement Chair", 60, "post", { covers: ["board_of_review", "committee_meeting"] }),
    R("program_outdoor_chair", "Senior chairs", "Programme & Outdoor Chair", 60, "post"),
    R("membership_chair", "Senior chairs", "Membership & Recruitment Chair", 60, "post", { covers: ["recruiting_night"] }),
    R("fundraising_chair", "Senior chairs", "Fundraising Chair", 60, "post", { covers: ["fundraiser_lead", "fundraiser_shift"] }),
    R("equipment_chair", "Senior chairs", "Equipment & Quartermaster Chair", 60, "post", { covers: ["gear_session"] }),
    R("asm_active", "Senior chairs", "Assistant Scoutmaster (active)", 60, "post", { reg: true }),
    R("high_adventure_lead", "Senior chairs", "High Adventure contingent lead", 60, "each", { reg: true, covers: ["high_adventure_adult"] }),
    R("high_adventure_adult", "Senior chairs", "High Adventure trek, adult in the field (full trek)", 60, "each", { reg: true }),
    R("summer_camp_week", "Senior chairs", "Summer camp week, adult in residence", 60, "each", { reg: true }),

    R("secretary", "Year-long coordinators", "Secretary", 40, "post"),
    R("training_coord", "Year-long coordinators", "Training Coordinator", 40, "post"),
    R("communications", "Year-long coordinators", "Communications / Webmaster", 40, "post"),
    R("recharter_coord", "Year-long coordinators", "Recharter Coordinator", 40, "post"),
    R("summer_camp_coord", "Year-long coordinators", "Summer Camp Coordinator", 40, "post"),
    R("eagle_coach", "Year-long coordinators", "Eagle Project Coach", 40, "post"),
    R("mbc_coord", "Year-long coordinators", "Merit Badge Counsellor Coordinator", 25, "post"),
    R("scoutbook", "Year-long coordinators", "Scoutbook / records", 25, "post"),
    R("medical_forms", "Year-long coordinators", "Medical Forms & Records", 25, "post"),
    R("chaplain", "Year-long coordinators", "Chaplain / Duty to God", 25, "post"),
    R("outdoor_ethics", "Year-long coordinators", "Outdoor Ethics Coordinator", 25, "post"),
    R("onboarding", "Year-long coordinators", "New Family Onboarding", 25, "post"),
    R("gear_swap", "Year-long coordinators", "Gear Swap Coordinator", 25, "post"),

    R("overnight", "Field and event work", "Overnight adult on a campout (per trip)", 25, "each", { reg: true }),
    R("service_lead", "Field and event work", "Service project lead", 25, "each"),
    R("fundraiser_lead", "Field and event work", "Fundraiser event lead", 25, "each"),
    R("trailer_tow", "Field and event work", "Trailer tow to site and back (per trip)", 15, "each"),
    R("grubmaster", "Field and event work", "Grubmaster for a trip", 15, "each"),
    R("mb_counselling", "Field and event work", "Merit badge counselling (per Scout completed)", 15, "each", { reg: true, cap: "mbc" }),
    R("coh_coord", "Field and event work", "Court of Honor coordination", 15, "each"),
    R("board_of_review", "Field and event work", "Board of review member (per board)", 10, "each", { reg: true }),
    R("driver_other", "Field and event work", "Driver for Scouts other than your own (per trip)", 10, "each"),
    R("day_campout", "Field and event work", "Day-only campout support (per trip)", 10, "each"),
    R("gear_session", "Field and event work", "Gear, shed or cupboard work session", 10, "each"),
    R("swim_test", "Field and event work", "Swim test support", 10, "each"),
    R("recruiting_night", "Field and event work", "Recruiting night volunteer", 10, "each"),
    R("fundraiser_shift", "Field and event work", "Fundraiser shift", 10, "each"),
    R("planning_conf", "Field and event work", "Annual programme planning conference", 10, "each"),
    R("service_volunteer", "Field and event work", "Service project volunteer", 10, "each"),
    R("coh_setup", "Field and event work", "Court of Honor refreshments or setup", 10, "each"),
    R("shopping", "Field and event work", "Shopping or printing for an event", 5, "each", { cap: "micro" }),
    R("committee_meeting", "Field and event work", "Committee meeting attendance", 5, "each", { cap: "micro", cap2: "meeting" }),

    R("wood_badge", "Training and recruitment", "Complete Wood Badge during the year", 40, "post"),
    R("ptc", "Training and recruitment", "Complete a Philmont Training Center (PTC) course", 40, "post"),
    R("iols", "Training and recruitment", "Complete Introduction to Outdoor Leader Skills", 25, "post"),
    R("recruit_family", "Training and recruitment", "Recruit a new family that registers and recharters", 25, "each"),
    R("position_training", "Training and recruitment", "Complete position-specific training for a post you hold", 15, "each"),
    R("register_mbc", "Training and recruitment", "Register as a merit badge counsellor", 15, "post"),
    R("recruit_mbc", "Training and recruitment", "Recruit a merit badge counsellor who registers", 15, "each"),
    R("ypt", "Training and recruitment", "Youth Protection Training (prerequisite)", 0, "post", { noClaim: true }),

    R("in_lieu", "Other", "Contribution in lieu (committee-set rate)", 0, "each", { adminOnly: true, variable: true })
  ];
  const BY_ID = Object.fromEntries(CATALOG.map(r => [r.id, r]));

  const CAPS = { micro: 30, meeting: 30, mbc: 60 };
  const TIERS = [
    { min: 300, name: "Platinum", note: "Troop Service Award" },
    { min: 200, name: "Gold", note: "Spring Court of Honor, with the troop's thanks" },
    { min: 150, name: "Silver", note: "Spring Court of Honor" },
    { min: 100, name: "Commitment met", note: "Acknowledged, not awarded" }
  ];

  function recognition(total) {
    return TIERS.find(t => total >= t.min) || null;
  }

  // Default target: 100; one registered adult -> 60; joined mid-year -> 25 per remaining quarter.
  // A committee override (hardship, in confidence) replaces it. Only the number is stored.
  function targetFor(family) {
    if (family.target_override != null && family.target_override !== "") return Number(family.target_override);
    let t = family.registered_adults === 1 ? 60 : 100;
    if (family.join_quarter && family.join_quarter > 1) t = Math.min(t, 25 * (5 - family.join_quarter));
    return t;
  }

  // Walk approved entries by date, applying caps, producing per-line counted points + running total.
  function ledger(entries) {
    const used = { micro: 0, meeting: 0, mbc: 0 };
    let run = 0;
    return entries
      .filter(e => e.status === "approved")
      .slice()
      .sort((a, b) => (a.work_date || "").localeCompare(b.work_date || "") || (a.id > b.id ? 1 : -1))
      .map(e => {
        const role = BY_ID[e.role_id] || {};
        let counted = Number(e.points) || 0;
        for (const g of [role.cap, role.cap2].filter(Boolean)) {
          counted = Math.max(0, Math.min(counted, CAPS[g] - used[g]));
        }
        for (const g of [role.cap, role.cap2].filter(Boolean)) used[g] += counted;
        run += counted;
        return { ...e, counted, capped: counted < (Number(e.points) || 0), running: run };
      });
  }

  function familySummary(family, entries) {
    const lines = ledger(entries);
    const total = lines.length ? lines[lines.length - 1].running : 0;
    const target = targetFor(family);
    return {
      ...family, target, total, lines,
      pct: target ? Math.min(100, Math.round((100 * total) / target)) : 100,
      met: total >= target, tier: recognition(total),
      pending: entries.filter(e => e.status === "pending").length
    };
  }

  // Audit flags shown to the committee before approving a claim.
  function flags(entry, ctx) {
    const out = [];
    const role = BY_ID[entry.role_id];
    const year = Number(entry.year);
    if (!role) out.push("Unknown role");
    // Per-occurrence roles may be claimed as a quantity (3 boards = 30), so whole multiples are fine.
    const pts = Number(entry.points), multiple = role && role.kind === "each" && role.pts > 0 && pts > 0 && pts % role.pts === 0;
    if (role && !role.variable && pts !== role.pts && !multiple) out.push(`Points ${entry.points} differ from points list (${role.pts})`);
    if (!LADDER.includes(pts) && !(role && role.variable) && pts !== 0 && !multiple) out.push("Points are off the ladder");
    if (entry.work_date) {
      if (Number(entry.work_date.slice(0, 4)) !== year) out.push("Date is outside the Scouting year");
      if (entry.work_date > new Date().toISOString().slice(0, 10)) out.push("Future date - points are earned when the work is done");
    }
    const adult = (ctx.adults || []).find(a => a.name === entry.adult_name);
    if (role && role.reg && adult && adult.registered === false) out.push("Role requires a registered adult");
    if (adult && adult.ypt_current === false) out.push("Youth Protection Training not current");
    if (!adult) out.push("Adult not on the imported roster");

    const theirs = (ctx.entries || []).filter(e => e.adult_name === entry.adult_name && e.id !== entry.id && e.status !== "rejected");
    if (role && role.kind === "post" && theirs.some(e => e.role_id === entry.role_id)) out.push("Post already claimed this year (one post, one claim)");
    theirs.filter(e => BY_ID[e.role_id] && (BY_ID[e.role_id].covers || []).includes(entry.role_id))
      .forEach(e => out.push(`May be inside a post they hold (${BY_ID[e.role_id].name}) - no double counting`));
    if (entry.role_id === "committee_meeting" && theirs.some(e => ["committee_chair", "treasurer", "secretary"].includes(e.role_id)))
      out.push("Meeting attendance is part of a committee post they hold");
    // Duplicate = same role, same day AND same event/description (two different boards on one evening are fine)
    if (theirs.some(e => e.role_id === entry.role_id && e.work_date === entry.work_date && BY_ID[e.role_id]?.kind === "each"
        && String(e.contribution || "").toLowerCase() === String(entry.contribution || "").toLowerCase()))
      out.push("Possible duplicate (same role, date and event)");
    if (theirs.some(e => e.role_id === "committee_chair")) out.push("Committee Chair's entry - a second committee member must sign");
    return out;
  }

  window.T420 = { LADDER, BANDS, CATALOG, BY_ID, CAPS, TIERS, recognition, targetFor, ledger, familySummary, flags };
})();
