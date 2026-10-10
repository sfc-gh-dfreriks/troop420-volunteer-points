// Storage layer: DEMO (localStorage, this browser only) or SUPABASE (shared, real admin login).
(function () {
  const cfg = window.T420_CONFIG;
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  // ---------------- DEMO ----------------
  const KEY = "t420_demo_v1";
  const load = () => JSON.parse(localStorage.getItem(KEY) || "null");
  const save = db => localStorage.setItem(KEY, JSON.stringify(db));

  function seed() {
    // Fictional families so the public site renders before a real import.
    const y = cfg.defaultYear, d = (m, day) => `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const fam = [["Rainwater", 2, 2], ["Okafor", 1, 1], ["Lindqvist", 2, 2], ["Marchetti", 1, 2], ["Halvorsen", 3, 2], ["Nakamura", 1, 1]];
    const adults = [["Hannah Rainwater", "Rainwater"], ["Sam Rainwater", "Rainwater"], ["Grace Okafor", "Okafor"],
      ["Erik Lindqvist", "Lindqvist"], ["Maja Lindqvist", "Lindqvist"], ["Paolo Marchetti", "Marchetti"], ["Lucia Marchetti", "Marchetti"],
      ["Anders Halvorsen", "Halvorsen"], ["Ingrid Halvorsen", "Halvorsen"], ["Kenji Nakamura", "Nakamura"]];
    let id = 1;
    const E = (adult, fam, role, date, extra = {}) => {
      const r = T420.BY_ID[role];
      return { id: id++, year: y, adult_name: adult, family_name: fam, role_id: role, contribution: r.name, band: r.pts, points: r.pts,
        work_date: date, source: "admin", status: "approved", reviewed_by: "Demo", ...extra };
    };
    const entries = [
      E("Hannah Rainwater", "Rainwater", "treasurer", d(1, 15)), E("Hannah Rainwater", "Rainwater", "position_training", d(2, 3)),
      E("Sam Rainwater", "Rainwater", "board_of_review", d(3, 12)), E("Sam Rainwater", "Rainwater", "board_of_review", d(5, 14)),
      E("Grace Okafor", "Okafor", "board_of_review", d(3, 12)), E("Grace Okafor", "Okafor", "service_volunteer", d(4, 20)),
      E("Grace Okafor", "Okafor", "grubmaster", d(6, 6)), E("Grace Okafor", "Okafor", "shopping", d(6, 1)), E("Grace Okafor", "Okafor", "shopping", d(9, 1)),
      E("Erik Lindqvist", "Lindqvist", "overnight", d(2, 21)), E("Erik Lindqvist", "Lindqvist", "overnight", d(4, 11)), E("Maja Lindqvist", "Lindqvist", "overnight", d(9, 19)),
      E("Erik Lindqvist", "Lindqvist", "trailer_tow", d(4, 11)), E("Maja Lindqvist", "Lindqvist", "grubmaster", d(9, 19)),
      E("Paolo Marchetti", "Marchetti", "scoutbook", d(1, 10)), E("Lucia Marchetti", "Marchetti", "medical_forms", d(1, 10)),
      ...[1, 2, 3, 4, 5, 6, 7].map(m => E("Lucia Marchetti", "Marchetti", "committee_meeting", d(m, 8))),
      E("Anders Halvorsen", "Halvorsen", "committee_chair", d(1, 5)), E("Ingrid Halvorsen", "Halvorsen", "summer_camp_week", d(7, 12)),
      E("Ingrid Halvorsen", "Halvorsen", "wood_badge", d(8, 30)), E("Kenji Nakamura", "Nakamura", "mb_counselling", d(5, 2)),
      E("Kenji Nakamura", "Nakamura", "overnight", d(9, 26), { status: "pending", source: "claim", reviewed_by: null, notes: "Fall campout - not in TroopWebHost" }),
      E("Sam Rainwater", "Rainwater", "driver_other", d(9, 26), { status: "pending", source: "claim", reviewed_by: null, notes: "Drove 3 Scouts to Camp Wente" })
    ];
    return {
      families: fam.map(([name, scouts]) => ({ year: y, name, scouts, target_override: null, join_quarter: null })),
      adults: adults.map(([name, family_name]) => ({ year: y, name, family_name, registered: true, ypt_current: true })),
      entries, settings: { [y]: { in_lieu_rate: "", published_through: "Q3", familyOverrides: {} } }, nextId: id
    };
  }

  const demo = {
    mode: "demo",
    db() { let db = load(); if (!db) { db = seed(); save(db); } return db; },
    async init() { this.db(); },
    async me() { return sessionStorage.getItem("t420_admin") ? { email: "demo@local", adult_name: sessionStorage.getItem("t420_admin_name") || "", is_chair: false } : null; },
    async login(_email, pass, adultName) {
      if (!cfg.TEST_MODE && pass !== cfg.DEMO_ADMIN_PASSPHRASE) throw new Error("Wrong passphrase");
      sessionStorage.setItem("t420_admin", "1"); sessionStorage.setItem("t420_admin_name", adultName || "");
    },
    async logout() { sessionStorage.removeItem("t420_admin"); sessionStorage.removeItem("t420_admin_name"); },
    async years() { const db = this.db(); return [...new Set([cfg.defaultYear, ...db.families.map(f => f.year)])].sort((a, b) => b - a); },
    async yearData(year, admin) {
      const db = this.db();
      return {
        families: db.families.filter(f => f.year === year), adults: db.adults.filter(a => a.year === year),
        entries: db.entries.filter(e => e.year === year && (admin || e.status === "approved")),
        settings: db.settings[year] || { familyOverrides: {} }
      };
    },
    async submitClaim(e) { const db = this.db(); db.entries.push({ ...e, id: db.nextId++, status: "pending", source: "claim", created_at: new Date().toISOString() }); save(db); },
    async addEntry(e) { const db = this.db(); db.entries.push({ ...e, id: db.nextId++, created_at: new Date().toISOString() }); save(db); },
    async review(id, status, reviewer, note) {
      const db = this.db(); const e = db.entries.find(x => x.id === id);
      Object.assign(e, { status, reviewed_by: reviewer, reviewed_at: new Date().toISOString(), review_note: note || null }); save(db);
    },
    async deleteEntry(id) { const db = this.db(); db.entries = db.entries.filter(e => e.id !== id); save(db); },
    async updateFamily(year, name, patch) { const db = this.db(); Object.assign(db.families.find(f => f.year === year && f.name === name), patch); save(db); },
    async updateAdult(year, name, patch) { const db = this.db(); Object.assign(db.adults.find(a => a.year === year && a.name === name), patch); save(db); },
    async reassign(year, adult, fam) {
      const db = this.db();
      if (!db.families.some(f => f.year === year && f.name === fam)) db.families.push({ year, name: fam, scouts: 0, target_override: null, join_quarter: null });
      db.adults.filter(a => a.year === year && a.name === adult).forEach(a => (a.family_name = fam));
      db.entries.filter(e => e.year === year && e.adult_name === adult).forEach(e => (e.family_name = fam));
      save(db);
    },
    async saveSettings(year, s) { const db = this.db(); db.settings[year] = { ...(db.settings[year] || {}), ...s }; save(db); },
    async importYear(b) {
      const db = this.db(), y = b.year;
      const oldF = Object.fromEntries(db.families.filter(f => f.year === y).map(f => [f.name, f]));
      const oldA = Object.fromEntries(db.adults.filter(a => a.year === y).map(a => [a.name, a]));
      const incoming = new Set(b.families.map(f => f.name));
      const keep = f => f.year !== y || (!incoming.has(f.name) && db.entries.some(e => e.year === y && e.family_name === f.name && e.source !== "twh"));
      db.families = db.families.filter(keep).concat(b.families.map(f => ({
        year: y, name: f.name, scouts: f.scouts, target_override: oldF[f.name]?.target_override ?? null, join_quarter: oldF[f.name]?.join_quarter ?? null })));
      db.adults = db.adults.filter(a => a.year !== y).concat(b.adults.map(a => ({
        ...a, registered: oldA[a.name]?.registered ?? true, ypt_current: oldA[a.name]?.ypt_current ?? null })));
      db.entries = db.entries.filter(e => !(e.year === y && e.source === "twh")).concat(b.entries.map(e => ({ ...e, id: db.nextId++ })));
      save(db);
    },
    async reset() { localStorage.removeItem(KEY); }
  };

  // ---------------- SUPABASE ----------------
  let sb;
  const chk = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  const testMe = () => sessionStorage.getItem("t420_test_admin") != null
    ? { email: "test-mode", adult_name: sessionStorage.getItem("t420_test_admin"), is_chair: false, test: true } : null;
  const supa = {
    mode: "live",
    async init() { sb = window.supabase.createClient(cfg.SUPABASE_URL.trim().replace(/\/(rest\/v1\/?)?$/, ""), cfg.SUPABASE_ANON_KEY.trim()); },
    async me() {
      if (cfg.TEST_MODE) return testMe();
      const { data } = await sb.auth.getSession(); const email = data.session?.user?.email;
      if (!email) return null;
      const rows = chk(await sb.from("admins").select("*").eq("email", email));
      return rows[0] ? { email, adult_name: rows[0].adult_name, is_chair: rows[0].is_chair } : { email, notAdmin: true };
    },
    async login(email, password, adultName) {
      if (cfg.TEST_MODE) { sessionStorage.setItem("t420_test_admin", adultName || ""); return; }
      chk(await sb.auth.signInWithPassword({ email, password }));
    },
    async logout() { sessionStorage.removeItem("t420_test_admin"); if (!cfg.TEST_MODE) await sb.auth.signOut(); },
    async years() { const r = chk(await sb.from("families").select("year")); return [...new Set([cfg.defaultYear, ...r.map(x => x.year)])].sort((a, b) => b - a); },
    async yearData(year, admin) {
      const [families, adults, entries, settings] = await Promise.all([
        sb.from("families").select("*").eq("year", year).then(chk),
        sb.from("adults").select("*").eq("year", year).then(chk),
        (admin ? sb.from("entries").select("*") : sb.from("public_entries").select("*")).eq("year", year).then(chk),
        sb.from("settings").select("*").eq("year", year).then(chk)
      ]);
      const s = settings[0] || {};
      return { families, adults, entries, settings: { in_lieu_rate: s.in_lieu_rate, published_through: s.published_through, familyOverrides: s.family_overrides || {} } };
    },
    async submitClaim(e) { chk(await sb.from("entries").insert({ ...e, status: "pending", source: "claim" })); },
    async addEntry(e) { chk(await sb.from("entries").insert(e)); },
    async review(id, status, reviewer, note) {
      chk(await sb.from("entries").update({ status, reviewed_by: reviewer, reviewed_at: new Date().toISOString(), review_note: note || null }).eq("id", id));
    },
    async deleteEntry(id) { chk(await sb.from("entries").delete().eq("id", id)); },
    async updateFamily(year, name, patch) { chk(await sb.from("families").update(patch).eq("year", year).eq("name", name)); },
    async updateAdult(year, name, patch) { chk(await sb.from("adults").update(patch).eq("year", year).eq("name", name)); },
    async reassign(year, adult, fam) {
      chk(await sb.from("families").upsert({ year, name: fam }, { onConflict: "year,name", ignoreDuplicates: true }));
      chk(await sb.from("adults").update({ family_name: fam }).eq("year", year).eq("name", adult));
      chk(await sb.from("entries").update({ family_name: fam }).eq("year", year).eq("adult_name", adult));
    },
    async saveSettings(year, s) {
      chk(await sb.from("settings").upsert({ year, in_lieu_rate: s.in_lieu_rate, published_through: s.published_through, family_overrides: s.familyOverrides }));
    },
    async importYear(b) {
      const y = b.year;
      chk(await sb.from("families").upsert(b.families.map(f => ({ year: y, name: f.name, scouts: f.scouts })), { onConflict: "year,name" }));
      chk(await sb.from("adults").upsert(b.adults.map(a => ({ year: y, name: a.name, family_name: a.family_name })), { onConflict: "year,name" }));
      chk(await sb.from("entries").delete().eq("year", y).eq("source", "twh"));
      if (b.entries.length) chk(await sb.from("entries").insert(b.entries));
    }
  };

  window.T420Store = live ? supa : demo;
})();
