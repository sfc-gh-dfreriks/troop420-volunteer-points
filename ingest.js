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
    const alias = overrides.__familyAlias || {};
    const fam = n => alias[n] || n;
    const inYear = people.filter(p => p.year === year);
    const adultsRaw = inYear.filter(p => /adult/i.test(p.type));
    const scoutCount = {};
    inYear.filter(p => /scout/i.test(p.type)).forEach(p => { const f = fam(surname(p.name)); scoutCount[f] = (scoutCount[f] || 0) + 1; });

    const adults = adultsRaw.map(p => ({
      year, name: display(p.name), family_name: overrides[display(p.name)] || fam(surname(p.name)),
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
      const allNights = p.nights + (cfg.includeCabinNights ? p.cabin : 0);
      const covered = Math.min(allNights, (overrides.__coveredNights || {})[a.name] || 0);
      const nights = allNights - covered;
      const trips = Math.floor(nights / cfg.campingNightsPerTrip);
      if (trips > 0) entries.push({
        year, family_name: a.family_name, adult_name: a.name, role_id: "overnight",
        contribution: `Overnight adult - ${trips} trip${trips > 1 ? "s" : ""} (${allNights} camping nights in TroopWebHost${covered ? `; ${covered} credited as week-long events/training` : ""})`,
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

  // ---------- Leadership positions (54040) + event leaders (53104) ----------
  function readRows(arrayBuffer) {
    // TroopWebHost CSV exports are UTF-8 (with BOM); binary XLS/XLSX start with an OLE/zip signature.
    const b = new Uint8Array(arrayBuffer.slice(0, 4));
    const binary = (b[0] === 0xd0 && b[1] === 0xcf) || (b[0] === 0x50 && b[1] === 0x4b);
    const wb = binary ? XLSX.read(arrayBuffer, { type: "array" })
      : XLSX.read(new TextDecoder("utf-8").decode(arrayBuffer).replace(/^\uFEFF/, ""), { type: "string", FS: "," });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  }

  // Which TroopWebHost export is this? Returns {kind, rows(objects)} or null.
  function sniff(arrayBuffer) {
    const rows = readRows(arrayBuffer);
    const h = rows.findIndex(r => ["Name", "Adult", "Event", "Participant"].some(k => r.map(c => norm(c).replace(/^\uFEFF/, "")).includes(k)));
    if (h < 0) return null;
    const head = rows[h].map(c => norm(c).replace(/^\uFEFF/, ""));
    const objs = rows.slice(h + 1).map(r => Object.fromEntries(head.map((k, i) => [k, norm(r[i])])));
    if (head.includes("Participant") && head.includes("Adult?")) return { kind: "participation", rows: objs };
    if (head.includes("Name") && head.includes("Scouts") && head.includes("Leadership")) return { kind: "involvement", rows: objs };
    if (head.includes("Position") && head.includes("Adult")) return { kind: "positions", rows: objs };
    if (head.includes("Leaders") && head.includes("Event") && head.includes("Type")) return { kind: "events", rows: objs };
    if (head.includes("Year") && head.includes("Type") && head.includes("Name")) return { kind: "annual" };
    return null;
  }

  // MM/DD/YY[ HH:MM AM] or MM/DD/YYYY -> YYYY-MM-DD
  function isoDate(s) {
    const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  // Match "Matt Shafer", "Shafer, Matt", "Christy Lynn Freriks" to roster names ("Matthew Shafer").
  function makeMatcher(rosterNames) {
    const roster = rosterNames.map(n => {
      const parts = n.toLowerCase().split(/\s+/);
      return { name: n, first: parts[0], last: parts[parts.length - 1] };
    });
    const firstOk = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
    return raw => {
      let s = norm(raw);
      if (s.includes(",")) { const [l, f] = s.split(",").map(norm); s = `${f} ${l}`; }
      const parts = s.toLowerCase().replace(/[^a-z\s'-]/g, "").split(/\s+/).filter(Boolean);
      if (parts.length < 2) return null;
      const first = parts[0], last = parts[parts.length - 1];
      const hits = roster.filter(r => r.last === last && firstOk(r.first, first));
      return hits.length === 1 ? hits[0].name : null;
    };
  }

  // "Matthew ShaferJudy Donnelly" -> ["Matthew Shafer", "Judy Donnelly"]
  const splitLeaders = s => norm(s).split(/(?<=[a-z])(?=[A-Z][a-z]+\s)|\s*[;,\n]\s*/).map(norm).filter(Boolean);

  // ctx: { year, roster: [{name, family_name}], cfg, today }
  function buildRoles(positions, events, ctx, participation) {
    const { year, cfg } = ctx;
    const today = ctx.today || new Date().toISOString().slice(0, 10);
    let match = makeMatcher(ctx.roster.map(a => a.name));
    const famOf = Object.fromEntries(ctx.roster.map(a => [a.name, a.family_name]));
    const fam = n => (ctx.alias || {})[n] || n;   // committee household merges
    const yearEnd = `${year}-12-31`, yearStart = `${year}-01-01`;
    const out = [], unmatched = new Set(), unmappedPositions = new Set(), unmappedTypes = new Set(), newAdults = [];
    const seen = new Set();
    const push = (e, key) => { if (seen.has(key)) return; seen.add(key); out.push({ ...e, notes: key }); };

    for (const r of positions || []) {
      const pos = r.Position; if (!pos) continue;
      if (!(pos in cfg.twhPositions)) { unmappedPositions.add(pos); continue; }
      const roleId = cfg.twhPositions[pos]; if (!roleId) continue;
      const role = T420.BY_ID[roleId]; if (!role) { unmappedPositions.add(pos); continue; }
      let adult = match(r.Adult);
      if (!adult) {
        // The positions report is an authoritative adult list: post-holders who logged no
        // event participation are added to the roster (family = surname, movable later).
        const [last, first] = r.Adult.split(",").map(norm);
        if (!last || !first) { unmatched.add(r.Adult); continue; }
        adult = `${first} ${last}`;
        if (!famOf[adult]) { famOf[adult] = fam(last); newAdults.push({ year, name: adult, family_name: fam(last), registered: true }); }
      }
      const start = isoDate(r.Start) || yearStart;
      if (start > yearEnd) continue;
      if (cfg.twhOnlyIfStartedInYear.includes(roleId) && start < yearStart) continue;
      push({
        year, family_name: famOf[adult], adult_name: adult, role_id: roleId,
        contribution: `${role.name} - TroopWebHost position "${pos}" since ${r.Start || "n/a"}`,
        band: role.pts, points: role.pts, work_date: start < yearStart ? yearStart : start,
        source: "twh", status: "pending"
      }, `twh:pos:${year}:${adult}:${roleId}`);
    }

    // Adults who took part in this year's events (Adult? = Y) are an authoritative adult list too.
    for (const r of participation || []) {
      if (!/^y/i.test(r["Adult?"] || "")) continue;
      const d = isoDate(r.Date); if (!d || d.slice(0, 4) !== String(year)) continue;
      const [last, first] = String(r.Participant || "").split(",").map(norm);
      if (!last || !first) continue;
      const known = makeMatcher([...ctx.roster.map(a => a.name), ...newAdults.map(a => a.name)])(r.Participant);
      if (known) continue;
      const name = `${first} ${last}`;
      famOf[name] = fam(last); newAdults.push({ year, name, family_name: fam(last), registered: true });
    }
    // post-holders / participants added above can also be event leaders - match them on the first import
    if (newAdults.length) match = makeMatcher([...ctx.roster.map(a => a.name), ...newAdults.map(a => a.name)]);
    for (const r of events || []) {
      const date = isoDate(r.Start);
      if (!date || date.slice(0, 4) !== String(year) || date > today || !r.Leaders) continue;
      if (!(r.Type in cfg.twhEventLeadTypes)) { if (r.Type) unmappedTypes.add(r.Type); continue; }
      if (!cfg.twhEventLeadTypes[r.Type]) continue;
      const role = T420.BY_ID[cfg.twhEventLeadTypes[r.Type]];
      for (const who of splitLeaders(r.Leaders)) {
        const adult = match(who); if (!adult) { unmatched.add(who); continue; }   // youth leaders land here, never stored
        push({
          year, family_name: famOf[adult], adult_name: adult, role_id: role.id,
          contribution: `${role.name} - led "${r.Event}" (${r.Type}, TroopWebHost)`,
          band: role.pts, points: role.pts, work_date: date, source: "twh", status: "pending"
        }, `twh:lead:${date}:${r.Event}:${adult}:${role.id}`);
      }
    }
    // Attendance credit (45935): High Adventure, summer camp, Wood Badge, PTC, IOLS, adult training.
    const coveredNights = {};
    const rules = (cfg.twhAttendance || []).map(r => ({ ...r, rx: r.name ? new RegExp(r.name, "i") : null }));
    const byEvent = {};
    for (const r of participation || []) (byEvent[`${r.Event}|${r.Date}`] = byEvent[`${r.Event}|${r.Date}`] || []).push(r);
    for (const r of participation || []) {
      if (!/^y/i.test(r["Adult?"] || "")) continue;
      const date = isoDate(r.Date);
      if (!date || date.slice(0, 4) !== String(year) || date > today) continue;
      const nights = (parseFloat(r["Camping Nights"]) || 0) + (parseFloat(r["Cabin Camping"]) || 0);
      const adult = match(r.Participant); if (!adult) { unmatched.add(r.Participant); continue; }
      if (/^y/i.test(r["Driver?"] || "") && cfg.twhDrivers) {
        const last = String(r.Participant).split(",")[0].trim().toLowerCase();
        const scouts = (byEvent[`${r.Event}|${r.Date}`] || []).filter(y => !/^y/i.test(y["Adult?"] || ""));
        const others = scouts.filter(y => String(y.Participant).split(",")[0].trim().toLowerCase() !== last).length;
        const drv = T420.BY_ID[cfg.twhDrivers.role];
        if (drv && (!cfg.twhDrivers.requireOtherFamiliesScouts || others > 0)) push({
          year, family_name: famOf[adult], adult_name: adult, role_id: drv.id,
          contribution: `${drv.name} - drove for "${r.Event}" (${r["Event Type"] || ""}, ${others} Scouts from other families attended, TroopWebHost)`.replace("(, ", "("),
          band: drv.pts, points: drv.pts, work_date: date, source: "twh", status: "pending"
        }, `twh:drv:${date}:${r.Event}:${adult}`);
      }
      const rule = rules.find(x => (!x.eventType || x.eventType === r["Event Type"]) && (!x.rx || x.rx.test(r.Event))
        && nights >= (x.minNights || 0) && (x.maxNights == null || nights <= x.maxNights));
      if (!rule) continue;
      const role = T420.BY_ID[rule.role]; if (!role) continue;
      if (seen.has(`twh:lead:${date}:${r.Event}:${adult}:${role.id}`)) continue;   // already credited as the leader
      if (rule.coversNights && nights) coveredNights[adult] = (coveredNights[adult] || 0) + nights;
      const key = role.kind === "post" ? `twh:att:${year}:${adult}:${role.id}` : `twh:att:${date}:${r.Event}:${adult}:${role.id}`;
      push({
        year, family_name: famOf[adult], adult_name: adult, role_id: role.id,
        contribution: `${role.name} - attended "${r.Event}"${nights ? ` (${nights} nights)` : ""} (${r["Event Type"]}, TroopWebHost)`,
        band: role.pts, points: role.pts, work_date: date, source: "twh", status: "pending"
      }, key);
    }
    // Adults missing from the annual summary still earn their nights / service hours, from the per-event rows.
    const annualAdults = new Set(ctx.annualAdults || ctx.roster.map(a => a.name));
    const tot = {};
    for (const r of participation || []) {
      if (!/^y/i.test(r["Adult?"] || "")) continue;
      const date = isoDate(r.Date); if (!date || date.slice(0, 4) !== String(year) || date > today) continue;
      const adult = match(r.Participant); if (!adult || annualAdults.has(adult)) continue;
      const t = tot[adult] = tot[adult] || { nights: 0, hours: 0 };
      t.nights += (parseFloat(r["Camping Nights"]) || 0) + (cfg.twh.includeCabinNights ? parseFloat(r["Cabin Camping"]) || 0 : 0);
      t.hours += (parseFloat(r["Service Hours"]) || 0) + (cfg.twh.includeConservationHours ? parseFloat(r["Conservation Hours"]) || 0 : 0);
    }
    for (const [adult, t] of Object.entries(tot)) {
      const nights = Math.max(0, t.nights - (coveredNights[adult] || 0)), trips = Math.floor(nights / cfg.twh.campingNightsPerTrip);
      if (trips > 0) push({ year, family_name: famOf[adult], adult_name: adult, role_id: "overnight",
        contribution: `Overnight adult - ${trips} trip${trips > 1 ? "s" : ""} (${nights} camping nights from TroopWebHost event participation)`,
        band: 25, points: 25 * trips, work_date: today > yearEnd ? yearEnd : today, source: "twh", status: "pending" }, `twh:hrs:${year}:${adult}:overnight`);
      const credits = Math.floor(t.hours / cfg.twh.serviceHoursPerCredit);
      if (credits > 0) push({ year, family_name: famOf[adult], adult_name: adult, role_id: "service_volunteer",
        contribution: `Service - ${t.hours} hours from TroopWebHost event participation (${credits} x ${cfg.twh.serviceHoursPerCredit}h credits)`,
        band: 10, points: 10 * credits, work_date: today > yearEnd ? yearEnd : today, source: "twh", status: "pending" }, `twh:hrs:${year}:${adult}:service`);
    }
    return { entries: out, newAdults, coveredNights, unmatched: [...unmatched].length, unmappedPositions: [...unmappedPositions], unmappedTypes: [...unmappedTypes] };
  }

  // 57107 Adult Involvement: adults who share a Scout are one household, whatever their surnames.
  // Returns proposed merges [{ name, families, adults, checked, note }]. Scout names stay in memory only.
  function households(rows, roster) {
    const match = makeMatcher(roster.map(a => a.name));
    const famOf = Object.fromEntries(roster.map(a => [a.name, a.family_name]));
    const parent = {}, find = x => (parent[x] === x ? x : (parent[x] = find(parent[x]))), join = (a, b) => { parent[find(a)] = find(b); };
    const scoutsOf = {}, adultsOf = {};
    for (const r of rows || []) {
      const adult = match(r.Name) || (() => { const [l, f] = String(r.Name).split(",").map(norm); return f ? `${f} ${l}` : null; })();
      if (!adult) continue;
      parent[adult] = parent[adult] || adult;
      for (const sc of String(r.Scouts || "").split(/[;,]/).map(x => norm(x.replace(/"[^"]*"/g, ""))).filter(Boolean)) {
        (adultsOf[sc] = adultsOf[sc] || []).push(adult); (scoutsOf[adult] = scoutsOf[adult] || []).push(sc);
      }
    }
    Object.values(adultsOf).forEach(as => as.slice(1).forEach(a => join(a, as[0])));
    const groups = {};
    Object.keys(parent).forEach(a => (groups[find(a)] = groups[find(a)] || []).push(a));
    const out = [];
    for (const adults of Object.values(groups)) {
      if (adults.length < 2) continue;
      const fams = [...new Set(adults.map(a => famOf[a] || a.split(" ").pop()))];
      if (fams.length < 2) continue;
      const scoutSurnames = [...new Set(adults.flatMap(a => scoutsOf[a] || []).map(s => s.split(" ").pop()))];
      // drop surnames contained in another ("Gurney" inside "Gurney Greene")
      const keep = fams.filter(f => !fams.some(g => g !== f && g.toLowerCase().split(/[\s-]+/).includes(f.toLowerCase())));
      keep.sort((a, b) => (scoutSurnames.some(s => a.includes(s)) ? -1 : 0) - (scoutSurnames.some(s => b.includes(s)) ? -1 : 0) || a.localeCompare(b));
      const name = keep.join("-");
      out.push({ name, families: fams, adults: adults.sort(), checked: keep.length <= 2,
        note: keep.length > 2 ? "Three or more surnames linked through more than one Scout - check before merging" : "" });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  window.T420Ingest = { households, parseWorkbook, buildYear, sniff, buildRoles, splitLeaders, isoDate };
})();
