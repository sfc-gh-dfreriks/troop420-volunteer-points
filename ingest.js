// TroopWebHost "Event Participation Annual Summary" (.XLS) -> roster + points entries.
// The export is per-person annual totals. Scout rows are used only to count Scouts
// per family surname; youth names are never stored or published.
(function () {
  const norm = s => String(s || "").trim();
  const num = v => (typeof v === "number" ? v : parseFloat(v)) || 0;

  function parseWorkbook(arrayBuffer) {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    const h = rows.findIndex(r => r.map(norm).includes("Year") && r.map(norm).includes("Name") && r.map(norm).includes("Type"));
    if (h < 0) throw new Error("Could not find the Year / Type / Name header row - is this the Event Participation Annual Summary export?");
    const head = rows[h].map(norm);
    const col = name => head.indexOf(name);
    const C = {
      year: col("Year"), type: col("Type"), name: col("Name"), nights: col("Camping Nights"),
      cabin: col("Cabin Camping"), service: col("Service Hours"), conservation: col("Conservation Hours"),
      gender: col("Registered Gender")
    };
    const people = [];
    for (const r of rows.slice(h + 1)) {
      const year = parseInt(r[C.year], 10);
      const name = norm(r[C.name]);
      if (!year || !name) continue;
      people.push({
        year, type: norm(r[C.type]), name,
        nights: num(r[C.nights]), cabin: C.cabin >= 0 ? num(r[C.cabin]) : 0,
        service: num(r[C.service]), conservation: C.conservation >= 0 ? num(r[C.conservation]) : 0
      });
    }
    return people;
  }

  const surname = name => norm(name.split(",")[0]);
  const display = name => {
    const [last, first] = name.split(",").map(norm);
    return first ? `${first} ${last}` : last;
  };

  // overrides: { "Jane Smith": "Jones" } moves an adult to another household.
  function buildYear(people, year, cfg, overrides = {}) {
    const inYear = people.filter(p => p.year === year);
    const adultsRaw = inYear.filter(p => /adult/i.test(p.type));
    const scoutCount = {};
    inYear.filter(p => /scout/i.test(p.type)).forEach(p => { scoutCount[surname(p.name)] = (scoutCount[surname(p.name)] || 0) + 1; });

    const adults = adultsRaw.map(p => ({
      year, name: display(p.name), family_name: overrides[display(p.name)] || surname(p.name),
      registered: true, ypt_current: null, _p: p
    }));

    const famNames = new Set([...adults.map(a => a.family_name), ...Object.keys(scoutCount)]);
    const families = [...famNames].sort().map(name => ({
      year, name, scouts: scoutCount[name] || 0,
      registered_adults: adults.filter(a => a.family_name === name && a.registered).length
    }));

    const today = new Date().toISOString().slice(0, 10);
    const asOf = String(year) === today.slice(0, 4) ? today : `${year}-12-31`;
    const entries = [];
    for (const a of adults) {
      const p = a._p;
      const nights = p.nights + (cfg.includeCabinNights ? p.cabin : 0);
      const trips = Math.floor(nights / cfg.campingNightsPerTrip);
      if (trips > 0) entries.push({
        year, family_name: a.family_name, adult_name: a.name, role_id: "overnight",
        contribution: `Overnight adult - ${trips} trip${trips > 1 ? "s" : ""} (${nights} camping nights in TroopWebHost)`,
        band: 25, points: 25 * trips, work_date: asOf, source: "twh", status: "approved", reviewed_by: "TroopWebHost import"
      });
      const hours = p.service + (cfg.includeConservationHours ? p.conservation : 0);
      const credits = Math.floor(hours / cfg.serviceHoursPerCredit);
      if (credits > 0) entries.push({
        year, family_name: a.family_name, adult_name: a.name, role_id: "service_volunteer",
        contribution: `Service - ${hours} hours in TroopWebHost (${credits} x ${cfg.serviceHoursPerCredit}h credits)`,
        band: 10, points: 10 * credits, work_date: asOf, source: "twh", status: "approved", reviewed_by: "TroopWebHost import"
      });
    }
    adults.forEach(a => delete a._p);
    return { year, families, adults, entries, years: [...new Set(people.map(p => p.year))].sort((a, b) => b - a) };
  }

  window.T420Ingest = { parseWorkbook, buildYear };
})();
