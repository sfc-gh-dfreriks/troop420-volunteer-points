(function () {
  const cfg = window.T420_CONFIG, S = window.T420Store, $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const LOGGED = { twh: "TroopWebHost", claim: "Self-reported", admin: "Committee" };
  const st = { year: cfg.defaultYear, me: null, data: null, fams: [], adminTab: "queue", parsed: null, flash: null };

  const isAdmin = () => st.me && !st.me.notAdmin;

  async function load() {
    st.data = await S.yearData(st.year, isAdmin());
    const { families, adults, entries } = st.data;
    st.fams = families.map(f => T420.familySummary(
      { ...f, registered_adults: adults.filter(a => a.family_name === f.name && a.registered !== false).length },
      entries.filter(e => e.family_name === f.name)
    )).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  function tierPill(f) {
    if (!f.tier && f.met) return `<span class="pill met">Target met</span>`;
    if (!f.tier) return `<span class="mute small">${f.total} of ${f.target}${f.total >= f.target / 2 ? " · halfway" : ""}</span>`;
    return `<span class="pill ${f.tier.name === "Commitment met" ? "met" : esc(f.tier.name)}">${esc(f.tier.name)}</span>`;
  }
  const bar = f => `<div class="bar"><i class="${f.met ? "met" : ""}" style="width:${f.pct}%"></i></div>`;

  // ---------------- Views ----------------
  function vStandings() {
    const F = st.fams, met = F.filter(f => f.met).length, tot = F.reduce((s, f) => s + f.total, 0), need = F.reduce((s, f) => s + f.target, 0);
    const pub = st.data.settings?.published_through;
    return `
      <div class="grid">
        <div class="kpi"><b>${F.length}</b><span>families</span></div>
        <div class="kpi"><b>${met}</b><span>commitment met</span></div>
        <div class="kpi"><b>${tot.toLocaleString()}</b><span>points earned of ${need.toLocaleString()} expected</span></div>
        <div class="kpi"><b>${F.filter(f => f.tier && f.tier.min >= 150).length}</b><span>Silver or above</span></div>
      </div>
      <div class="card"><h2>${st.year} family standings</h2>
        <p class="mute small">Every family sees every family's total. Targets shown are the published target only. ${pub ? `Published through ${esc(pub)}.` : ""} Click a family for its tracker.</p>
        <table><thead><tr><th>Family</th><th class="n">Points</th><th class="n">Target</th><th>Progress</th><th>Recognition</th></tr></thead><tbody>
        ${F.map(f => `<tr class="click" data-fam="${esc(f.name)}"><td><b>${esc(f.name)}</b></td><td class="n">${f.total}</td><td class="n">${f.target}</td><td>${bar(f)}</td><td>${tierPill(f)}</td></tr>`).join("")
          || `<tr><td colspan="5" class="mute">No families for ${st.year} yet. A committee member imports the TroopWebHost export.</td></tr>`}
        </tbody></table></div>`;
  }

  function trackerRows(f) {
    return f.lines.map(l => {
      const role = T420.BY_ID[l.role_id] || {};
      return { Family: f.name, Adult: l.adult_name, Contribution: l.contribution, Date: l.work_date,
        Band: `${l.band} - ${T420.BANDS[l.band] || role.group || ""}`, Points: l.counted + (l.capped ? ` (capped from ${l.points})` : ""),
        "Running total": l.running, Target: f.target, "Logged by": LOGGED[l.source] || l.source,
        Audit: l.reviewed_by ? `${l.reviewed_by}${l.reviewed_at ? " · " + l.reviewed_at.slice(0, 10) : ""}` : "" };
    });
  }

  function vFamily(name) {
    const f = st.fams.find(x => x.name === name);
    if (!f) return `<div class="card">Family not found. <a href="#standings">Back</a></div>`;
    const rows = trackerRows(f);
    const pend = isAdmin() ? st.data.entries.filter(e => e.family_name === name && e.status === "pending") : [];
    return `<div class="card"><a href="#standings" class="small">← All families</a>
      <h2>${esc(f.name)} family · ${st.year}</h2>
      <div class="grid"><div class="kpi"><b>${f.total}</b><span>points counted</span></div><div class="kpi"><b>${f.target}</b><span>target</span></div>
      <div class="kpi"><b>${Math.max(0, f.target - f.total)}</b><span>to go</span></div><div class="kpi"><b>${f.tier ? esc(f.tier.name) : "-"}</b><span>${f.tier ? esc(f.tier.note) : "recognition starts at 100"}</span></div></div>
      ${bar(f)}
      <h3>Tracker</h3>
      <table class="small"><thead><tr>${["Adult", "Contribution", "Date", "Band", "Points", "Running total", "Logged by", "Audit"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.Adult)}</td><td>${esc(r.Contribution)}</td><td>${fmtDate(r.Date)}</td><td>${esc(r.Band)}</td><td class="n">${esc(r.Points)}</td><td class="n">${r["Running total"]}</td><td>${esc(r["Logged by"])}</td><td class="mute">${esc(r.Audit)}</td></tr>`).join("")
        || `<tr><td colspan="8" class="mute">Nothing logged yet.</td></tr>`}</tbody></table>
      ${pend.length ? `<p class="flag">${pend.length} claim(s) awaiting committee review.</p>` : ""}
      <p><a href="#claim" data-prefill="${esc(f.name)}">Missing something? Log it →</a></p></div>`;
  }

  function roleOptions(includeAdmin) {
    const groups = {};
    T420.CATALOG.filter(r => !r.noClaim && (includeAdmin || !r.adminOnly)).forEach(r => (groups[r.group] = groups[r.group] || []).push(r));
    return Object.entries(groups).map(([g, rs]) => `<optgroup label="${esc(g)}">${rs.map(r =>
      `<option value="${r.id}">${esc(r.name)} — ${r.variable ? "rate set by committee" : r.pts + " pts"}${r.reg ? " · registered adult" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  function vClaim() {
    const adults = st.data.adults.slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="card"><h2>Log credit you didn't get</h2>
      <p class="mute">TroopWebHost records camping nights and service hours. Committee posts, boards of review, driving other Scouts, grubmaster and the rest of the points list need logging here.
      Your claim goes to the volunteer committee for verification and appears on the standings once approved.</p>
      ${st.flash ? `<div class="msg ${st.flash.ok ? "ok" : "err"}">${esc(st.flash.text)}</div>` : ""}
      <form id="claimForm">
        <div class="row">
          <label>Your name<input name="adult_name" list="adultList" required placeholder="First Last" autocomplete="name"></label>
          <label>Family<input name="family_name" list="famList" required placeholder="Family surname"></label>
          <label>Email (committee only, for questions)<input name="submitter_email" type="email" placeholder="optional"></label>
        </div>
        <datalist id="adultList">${adults.map(a => `<option value="${esc(a.name)}">`).join("")}</datalist>
        <datalist id="famList">${st.fams.map(f => `<option value="${esc(f.name)}">`).join("")}</datalist>
        <div class="row">
          <label>What you did<select name="role_id" required>${roleOptions(false)}</select></label>
          <label>Date the work was done<input name="work_date" type="date" required min="${st.year}-01-01" max="${new Date().toISOString().slice(0, 10)}"></label>
          <label>How many (trips, boards, Scouts…)<input name="qty" type="number" min="1" max="20" value="1"></label>
        </div>
        <label>Event and detail<textarea name="notes" required placeholder="e.g. Oct campout at Camp Wente, overnight both nights; drove the Smith and Lee boys"></textarea></label>
        <p class="small mute">Not claimable: driving only your own Scout, work inside a post you hold, or work not yet done. Micro-tasks and meetings cap at 30, merit badge counselling at 60.</p>
        <button>Submit for verification</button>
      </form></div>`;
  }

  function vPoints() {
    const groups = {};
    T420.CATALOG.filter(r => !r.adminOnly).forEach(r => (groups[r.group] = groups[r.group] || []).push(r));
    return `<div class="card"><h2>Points list</h2><p class="mute">Seven values on the ladder: ${T420.LADDER.join(", ")}. Nothing else appears anywhere.</p>
      ${Object.entries(groups).map(([g, rs]) => `<h3>${esc(g)}</h3><table class="price"><tbody>${rs.map(r =>
        `<tr><td>${esc(r.name)}${r.reg ? ' <span class="pill">registered adult</span>' : ""}${r.cap ? ` <span class="pill pending">cap ${r.cap === "mbc" ? 60 : 30}/yr</span>` : ""}${r.kind === "post" ? ' <span class="mute small">· once per year</span>' : ""}</td><td class="n"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table>`).join("")}</div>`;
  }

  function vRules() {
    return `<div class="card"><h2>How it works</h2>
      <h3>The expectation</h3><ul>
        <li><b>100 points per family</b> per Scouting year (1 Jan – 31 Dec, closing with recharter). One target per family, not per Scout.</li>
        <li><b>Single registered adult household: 60.</b> <b>Joining mid-year:</b> 25 per remaining quarter.</li>
        <li><b>Hardship:</b> a quiet word with the Committee Chair adjusts the target. Only the target is published, never the reason.</li>
        <li><b>Contribution in lieu</b> at a rate the committee sets annually${st.data.settings?.in_lieu_rate ? ` (${esc(st.data.settings.in_lieu_rate)} this year)` : ""}.</li></ul>
      <h3>Before any points</h3><p>Current Youth Protection Training for every registered adult (0 points, it's the entry condition). Two-deep leadership always.</p>
      <h3>Rules that keep it honest</h3><ul>
        <li>No double counting inside a role you hold. One post, one claim.</li><li>Your own Scout's transport is not service.</li>
        <li>Micro-tasks (incl. committee meetings) cap at 30; merit badge counselling at 60.</li><li>Points are earned when the work is done.</li></ul>
      <h3>Recognition</h3><table><tbody>${T420.TIERS.slice().reverse().map(t => `<tr><td><b>${esc(t.name)}</b></td><td class="n">${t.min}${t.min === 300 ? "+" : ""}</td><td class="mute">${esc(t.note)}</td></tr>`).join("")}</tbody></table>
      <h3>Where points come from</h3><p>Camping nights and service hours are imported from TroopWebHost's annual summary
        (${cfg.twh.campingNightsPerTrip} nights = one overnight-adult trip at 25; every ${cfg.twh.serviceHoursPerCredit} service hours = one 10-point service credit).
        Everything else is self-reported here and verified by the volunteer committee. The Chair spot-audits but never verifies their own line; disputes go to the committee.</p></div>`;
  }

  // ---------------- Admin ----------------
  function vLogin() {
    const nameField = `<label>Your name (blocks approving your own lines)<input name="adult" list="adultList2"></label><datalist id="adultList2">${st.data.adults.map(a => `<option value="${esc(a.name)}">`).join("")}</datalist>`;
    if (cfg.TEST_MODE) return `<div class="card" style="max-width:460px"><h2>Committee console (test mode)</h2>
      <p class="small mute">No login while testing. Pick who you are acting as, or leave it blank. Turn <code>TEST_MODE</code> off before going live.</p>
      <form id="loginForm">${nameField}<p><button>Open console</button></p></form></div>`;
    return `<div class="card" style="max-width:460px"><h2>Committee sign-in</h2>
      ${S.mode === "demo" ? `<p class="small mute">Demo mode: passphrase is set in <code>config.js</code>. Approvals stay in this browser.</p>` : ""}
      ${st.me?.notAdmin ? `<div class="msg err">${esc(st.me.email)} is signed in but is not on the committee admin list.</div>` : ""}
      ${st.flash && !st.flash.ok ? `<div class="msg err">${esc(st.flash.text)}</div>` : ""}
      <form id="loginForm">
        ${S.mode === "live" ? `<label>Email<input name="email" type="email" required></label>` : `<label>Your name (blocks approving your own lines)<input name="adult" list="adultList2"></label><datalist id="adultList2">${st.data.adults.map(a => `<option value="${esc(a.name)}">`).join("")}</datalist>`}
        <label>${S.mode === "live" ? "Password" : "Passphrase"}<input name="password" type="password" required></label><p><button>Sign in</button></p></form></div>`;
  }

  function vAdmin() {
    if (!isAdmin()) return vLogin();
    const tabs = [["queue", "Approval queue"], ["add", "Add entry"], ["import", "Import TroopWebHost"], ["families", "Families & targets"], ["adults", "Adults"], ["settings", "Settings & export"]];
    const pending = st.data.entries.filter(e => e.status === "pending").length;
    return `<div class="tabs2">${tabs.map(([k, l]) => `<button data-atab="${k}" class="${st.adminTab === k ? "on" : ""}">${l}${k === "queue" && pending ? ` (${pending})` : ""}</button>`).join("")}
      <span style="margin-left:auto" class="small mute">Signed in as ${esc(st.me.adult_name || st.me.email)} <button class="ghost sm" id="logout">Sign out</button></span></div>
      ${st.flash ? `<div class="msg ${st.flash.ok ? "ok" : "err"}">${esc(st.flash.text)}</div>` : ""}
      ${({ queue: aQueue, add: aAdd, import: aImport, families: aFamilies, adults: aAdults, settings: aSettings })[st.adminTab]()}`;
  }

  function aQueue() {
    const ctx = { adults: st.data.adults, entries: st.data.entries };
    const rows = st.data.entries.filter(e => e.status !== "approved" || e.source === "claim").sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const bulk = rows.filter(e => e.status === "pending" && e.source === "twh" && !(st.me.adult_name && st.me.adult_name === e.adult_name) && !T420.flags(e, ctx).length);
    return `<div class="card"><h2>Claims</h2>
      ${bulk.length ? `<p><button class="ok" id="bulkTwh">Approve ${bulk.length} TroopWebHost suggestions with no flags</button>
        <span class="small mute">Leaves flagged lines and your own lines for individual review.</span></p>` : ""}<table class="small"><thead><tr><th>Status</th><th>Adult / family</th><th>Contribution</th><th>Date</th><th class="n">Pts</th><th>Checks</th><th></th></tr></thead><tbody>
      ${rows.map(e => {
        const fl = T420.flags(e, ctx), self = st.me.adult_name && st.me.adult_name === e.adult_name;
        return `<tr><td><span class="pill ${e.status}">${e.status}</span></td><td><b>${esc(e.adult_name)}</b><br><span class="mute">${esc(e.family_name)}${e.submitter_email ? " · " + esc(e.submitter_email) : ""}</span></td>
          <td>${esc(e.contribution)}${e.notes && !e.notes.startsWith("twh:") ? `<br><span class="mute">${esc(e.notes)}</span>` : ""}${e.source === "twh" ? ' <span class="pill twh">TroopWebHost suggestion</span>' : ""}${e.review_note ? `<br><i>Committee: ${esc(e.review_note)}</i>` : ""}</td>
          <td>${fmtDate(e.work_date)}</td><td class="n">${e.points}</td><td>${fl.map(x => `<div class="flag">⚑ ${esc(x)}</div>`).join("") || '<span class="mute">none</span>'}</td>
          <td>${e.status === "pending" ? (self ? `<span class="mute">Your own line – another member must sign</span>` :
            `<button class="ok sm" data-approve="${e.id}">Approve</button> <button class="red sm" data-reject="${e.id}">Reject</button>`) :
            `<button class="ghost sm" data-reopen="${e.id}">Reopen</button>`} <button class="ghost sm" data-del="${e.id}">Delete</button></td></tr>`;
      }).join("") || `<tr><td colspan="7" class="mute">No claims.</td></tr>`}</tbody></table></div>`;
  }

  function aAdd() {
    return `<div class="card"><h2>Add an entry</h2><p class="mute small">For committee posts, contributions in lieu, or work logged by the Secretary. Entries for yourself are saved as pending for a second member.</p>
      <form id="addForm"><div class="row">
        <label>Adult<input name="adult_name" list="adultList3" required></label><label>Family<select name="family_name">${st.fams.map(f => `<option>${esc(f.name)}</option>`).join("")}</select></label>
        <label>Date<input name="work_date" type="date" required></label></div>
        <datalist id="adultList3">${st.data.adults.map(a => `<option value="${esc(a.name)}">`).join("")}</datalist>
        <div class="row"><label>Role<select name="role_id">${roleOptions(true)}</select></label><label>Quantity<input name="qty" type="number" min="1" value="1"></label>
        <label>Points override (in lieu / partial year)<input name="points" type="number" min="0" placeholder="leave blank for points list"></label></div>
        <label>Detail<input name="notes"></label><p><button>Add approved entry</button></p></form></div>`;
  }

  function aImport() {
    const p = st.parsed;
    return `<div class="card"><h2>Import TroopWebHost export</h2>
      <p class="mute small">Reports → <i>Event Participation Annual Summary</i> → export as XLS. The file is read in your browser; only Adult rows become points, and Scout rows only count Scouts per family.
      Re-importing a year replaces that year's TroopWebHost lines and keeps approved claims, targets and household moves.</p>
      <p class="small"><b>Choose one or more files</b> – each is recognised automatically:</p>
      <ul class="small"><li><b>Event Participation Annual Summary</b> (XLS) – camping nights and service hours (auto-approved)</li>
        <li><b>Adult Leaders By Position</b> (54040) – posts such as Assistant Scoutmaster, Treasurer, Committee Chair</li>
        <li><b>Export Events To Excel</b> (53104) – event leaders, e.g. who led the food drive</li>
        <li><b>Export Event Participation To Excel</b> (45935) – who attended High Adventure, summer camp, Wood Badge, PTC and other adult training</li>
        <li><b>Adult Involvement</b> (57107) – which adults share a Scout, to join households with different surnames</li></ul>
      ${st.households ? `<h3>Households from TroopWebHost (adults who share a Scout)</h3>
        ${st.households.length ? `<table class="small"><thead><tr><th></th><th>Family name</th><th>Combines</th><th>Adults</th></tr></thead><tbody>
        ${st.households.map((h, i) => `<tr><td><input type="checkbox" data-hh="${i}" ${h.checked ? "checked" : ""}></td><td><input data-hh-name="${i}" value="${esc(h.name)}" style="width:190px"></td>
          <td>${esc(h.families.join(" + "))}${h.note ? `<div class="flag">⚑ ${esc(h.note)}</div>` : ""}</td><td>${esc(h.adults.join(", "))}</td></tr>`).join("")}</tbody></table>
        <p><button id="doHouseholds">Merge ticked households</button> <span class="small mute">Lines and Scout counts move to the new family name, and the merge is remembered on re-import.</span></p>`
        : `<p class="mute">Every household with a shared Scout is already one family.</p>`}` : ""}
      <p class="small mute">Positions and event leaders become <b>pending suggestions</b> in the Approval queue for the committee to confirm. Import the annual summary first so leaders can be matched to adults.</p>
      <input type="file" id="xls" accept=".xls,.xlsx,.csv" multiple>
      ${st.roles ? (() => { const r = st.roles.result; const by = {}; r.entries.forEach(e => { by[e.role_id] = (by[e.role_id] || 0) + 1; });
        return `<h3>Leadership & event leads – ${st.year}</h3>
        <p>${r.entries.length} suggestions (${r.entries.reduce((a, e) => a + e.points, 0)} pts) from ${st.roles.files.join(" + ")}.
        ${r.newAdults.length ? `${r.newAdults.length} adults (post-holders and event participants) not in the annual summary will be added to the roster.` : ""}
        ${r.unmatched ? `${r.unmatched} leader names did not match an adult (usually Scouts) and are ignored.` : ""}</p>
        ${r.unmappedPositions.length || r.unmappedTypes.length ? `<p class="flag">Not mapped in config.js (no points): ${esc([...r.unmappedPositions, ...r.unmappedTypes].join(", "))}</p>` : ""}
        <table class="small"><thead><tr><th>Role</th><th class="n">Lines</th></tr></thead><tbody>${Object.entries(by).map(([k, n]) => `<tr><td>${esc(T420.BY_ID[k]?.name || k)}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table>
        ${r.coveredNights && Object.keys(r.coveredNights).length ? `<p class="small">${Object.keys(r.coveredNights).length} adults have week-long or training nights (${Object.values(r.coveredNights).reduce((a, b) => a + b, 0)} nights). These come out of their annual overnight credit, so no night is counted twice.</p>` : ""}
        <button id="doRoles">Add ${r.entries.length} suggestions to the approval queue</button>`; })() : ""}
      ${p ? `<h3>Preview – ${p.year}</h3>
        <p>${p.built.families.length} families · ${p.built.adults.length} adults · ${p.built.entries.length} point lines (${p.built.entries.reduce((s, e) => s + e.points, 0)} pts).
        Years in file: <select id="impYear">${p.built.years.map(y => `<option ${y === p.year ? "selected" : ""}>${y}</option>`).join("")}</select></p>
        <table class="small"><thead><tr><th>Adult</th><th>Family</th><th>Line</th><th class="n">Pts</th></tr></thead><tbody>
        ${p.built.entries.slice(0, 15).map(e => `<tr><td>${esc(e.adult_name)}</td><td>${esc(e.family_name)}</td><td>${esc(e.contribution)}</td><td class="n">${e.points}</td></tr>`).join("")}</tbody></table>
        ${p.built.entries.length > 15 ? `<p class="mute small">…and ${p.built.entries.length - 15} more.</p>` : ""}
        <p class="small">Families are grouped by surname. Move adults in blended or different-surname households on the <b>Adults</b> tab after import.</p>
        <button id="doImport">Import ${p.year}</button>` : ""}</div>`;
  }

  function aFamilies() {
    return `<div class="card"><h2>Families & targets</h2><p class="mute small">Leave override blank to use the rule (100; 60 single registered adult; 25 × remaining quarters if joined mid-year). Overrides publish only the number.</p>
      <table class="small"><thead><tr><th>Family</th><th class="n">Scouts</th><th class="n">Reg. adults</th><th>Joined in quarter</th><th>Target override</th><th class="n">Published target</th><th class="n">Points</th><th>Merge into</th></tr></thead><tbody>
      ${st.fams.map(f => `<tr><td><b>${esc(f.name)}</b></td><td class="n">${f.scouts ?? ""}</td><td class="n">${f.registered_adults}</td>
        <td><select data-fam-q="${esc(f.name)}"><option value="">Full year</option>${[2, 3, 4].map(q => `<option ${f.join_quarter == q ? "selected" : ""} value="${q}">Q${q}</option>`).join("")}</select></td>
        <td><input type="number" min="0" style="width:90px" data-fam-t="${esc(f.name)}" value="${f.target_override ?? ""}"></td><td class="n">${f.target}</td><td class="n">${f.total}</td>
        <td><select data-fam-merge="${esc(f.name)}"><option value="">—</option>${st.fams.filter(o => o.name !== f.name).map(o => `<option value="${esc(o.name)}">${esc(o.name)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>
      <p class="small mute">Merge combines two households (e.g. a Scout listed under "Gurney" and a parent under "Gurney Greene"). Adults, Scouts count and every line move across, and the merge is remembered on TroopWebHost re-import.</p></div>`;
  }

  function aAdults() {
    return `<div class="card"><h2>Adults</h2><p class="mute small">Registration and YPT drive the claim checks. Changing a household moves the adult's lines and is remembered on re-import.</p>
      <table class="small"><thead><tr><th>Adult</th><th>Household</th><th>Registered</th><th>YPT current</th></tr></thead><tbody>
      ${st.data.adults.slice().sort((a, b) => a.name.localeCompare(b.name)).map(a => `<tr><td>${esc(a.name)}</td>
        <td><input list="famList2" data-ad-fam="${esc(a.name)}" value="${esc(a.family_name)}" style="width:170px"></td>
        <td><input type="checkbox" data-ad-reg="${esc(a.name)}" ${a.registered !== false ? "checked" : ""}></td>
        <td><select data-ad-ypt="${esc(a.name)}">${[["", "unknown"], ["true", "yes"], ["false", "no"]].map(([v, l]) => `<option value="${v}" ${String(a.ypt_current ?? "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table><datalist id="famList2">${st.fams.map(f => `<option value="${esc(f.name)}">`).join("")}</datalist></div>`;
  }

  function aSettings() {
    const s = st.data.settings || {};
    return `<div class="card"><h2>Settings & export</h2><form id="setForm"><div class="row">
      <label>Contribution-in-lieu rate (published)<input name="in_lieu_rate" value="${esc(s.in_lieu_rate || "")}" placeholder="e.g. $10 per point"></label>
      <label>Published through<select name="published_through">${["", "Q1", "Q2", "Q3", "Q4"].map(q => `<option ${s.published_through === q ? "selected" : ""}>${q}</option>`).join("")}</select></label></div>
      <button>Save</button></form>
      <h3>Export</h3><p><button class="ghost" id="csv">Download tracker CSV (${st.year})</button></p>
      ${S.mode === "demo" ? `<h3>Demo data</h3><p><button class="red" id="reset">Reset demo data</button></p>` : ""}</div>`;
  }

  // ---------------- Render + events ----------------
  async function render() {
    const [tab, arg] = (location.hash.slice(1) || "standings").split("/");
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("on", a.dataset.tab === (tab === "family" ? "standings" : tab)));
    const v = $("#view");
    try {
      v.innerHTML = ({ standings: vStandings, family: () => vFamily(decodeURIComponent(arg || "")), claim: vClaim, points: vPoints, rules: vRules, admin: vAdmin }[tab] || vStandings)();
    } catch (e) { v.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
    st.flash = null;
  }
  const refresh = async () => { await load(); await render(); };
  const say = (text, ok = true) => { st.flash = { text, ok }; };

  function csv() {
    const rows = st.fams.flatMap(trackerRows);
    const head = ["Family", "Adult", "Contribution", "Date", "Band", "Points", "Running total", "Target", "Logged by", "Audit"];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob([[head.join(","), ...rows.map(r => head.map(h => q(r[h])).join(","))].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `troop420-volunteer-points-${st.year}.csv` }); a.click();
  }

  function entryFrom(fd, admin) {
    const role = T420.BY_ID[fd.get("role_id")], qty = Math.max(1, parseInt(fd.get("qty") || "1", 10));
    const override = admin && fd.get("points") !== "" && fd.get("points") != null ? parseInt(fd.get("points"), 10) : null;
    const pts = override ?? role.pts * (role.kind === "post" ? 1 : qty);
    return { year: st.year, adult_name: fd.get("adult_name").trim(), family_name: fd.get("family_name").trim(), role_id: role.id,
      contribution: role.kind === "post" || qty === 1 ? role.name : `${role.name} × ${qty}`, band: role.pts, points: pts,
      work_date: fd.get("work_date"), notes: (fd.get("notes") || "").trim() || null };
  }

  document.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target, fd = new FormData(f);
    try {
      if (f.id === "claimForm") {
        const e = entryFrom(fd, false);
        if (Number(e.work_date.slice(0, 4)) !== st.year) throw new Error(`Date must fall in the ${st.year} Scouting year.`);
        await S.submitClaim({ ...e, submitter_email: fd.get("submitter_email") || null });
        say(`Thanks – your claim (${e.points} pts) is with the committee for verification.`);
      } else if (f.id === "loginForm") {
        await S.login(fd.get("email"), fd.get("password"), fd.get("adult")); st.me = await S.me();
        if (st.me?.notAdmin) say("Signed in, but not on the admin list.", false);
      } else if (f.id === "addForm") {
        const e = entryFrom(fd, true), self = st.me.adult_name && st.me.adult_name === e.adult_name;
        await S.addEntry({ ...e, source: "admin", status: self ? "pending" : "approved", reviewed_by: self ? null : (st.me.adult_name || st.me.email), reviewed_at: self ? null : new Date().toISOString() });
        say(self ? "Saved as pending – a second committee member must sign your own line." : "Entry added.");
      } else if (f.id === "setForm") {
        await S.saveSettings(st.year, { ...st.data.settings, in_lieu_rate: fd.get("in_lieu_rate"), published_through: fd.get("published_through") }); say("Settings saved.");
      }
    } catch (e) { say(e.message, false); }
    await refresh();
  });

  document.addEventListener("click", async ev => {
    const t = ev.target.closest("[data-fam],[data-atab],[data-approve],[data-reject],[data-reopen],[data-del],#logout,#doImport,#doRoles,#bulkTwh,#doHouseholds,#csv,#reset,[data-prefill]");
    if (!t) return;
    const who = () => st.me.adult_name || st.me.email;
    try {
      if (t.dataset.fam) { location.hash = `family/${encodeURIComponent(t.dataset.fam)}`; return; }
      if (t.dataset.prefill) { setTimeout(() => { const i = document.querySelector("[name=family_name]"); if (i) i.value = t.dataset.prefill; }, 50); return; }
      if (t.dataset.atab) st.adminTab = t.dataset.atab;
      else if (t.dataset.approve) { await S.review(+t.dataset.approve, "approved", who()); say("Approved."); }
      else if (t.dataset.reject) { const n = prompt("Reason for the claimant (optional):") ?? ""; await S.review(+t.dataset.reject, "rejected", who(), n); say("Rejected."); }
      else if (t.dataset.reopen) { await S.review(+t.dataset.reopen, "pending", null); say("Reopened."); }
      else if (t.dataset.del) { if (!confirm("Delete this entry permanently?")) return; await S.deleteEntry(+t.dataset.del); say("Deleted."); }
      else if (t.id === "logout") { await S.logout(); st.me = null; }
      else if (t.id === "csv") { csv(); return; }
      else if (t.id === "reset") { if (!confirm("Reset all demo data in this browser?")) return; await S.reset(); }
      else if (t.id === "doRoles") {
        const r = st.roles.result, n = await S.importRoles(st.year, r);
        let adjusted = 0;
        if (r.coveredNights && Object.keys(r.coveredNights).length) {
          // Week-long events / training are credited at their own rate: take their nights out of the
          // annual-summary overnight line so no night is counted twice. Remembered for annual re-imports.
          const ov = { ...(st.data.settings.familyOverrides || {}), __coveredNights: r.coveredNights };
          await S.saveSettings(st.year, { ...st.data.settings, familyOverrides: ov });
          for (const e of st.data.entries.filter(x => x.source === "twh" && !x.notes && x.role_id === "overnight" && r.coveredNights[x.adult_name])) {
            const all = parseFloat((e.contribution.match(/\((\d+(?:\.\d+)?) camping nights/) || [])[1]);
            if (!all) continue;
            const covered = Math.min(all, r.coveredNights[e.adult_name]);
            const trips = Math.floor((all - covered) / cfg.twh.campingNightsPerTrip);
            if (trips > 0 && 25 * trips === Number(e.points)) continue;   // already adjusted
            if (trips <= 0) await S.deleteEntry(e.id);
            else await S.updateEntry(e.id, { points: 25 * trips,
              contribution: `Overnight adult - ${trips} trip${trips > 1 ? "s" : ""} (${all} camping nights in TroopWebHost; ${covered} credited as week-long events/training)` });
            adjusted++;
          }
        }
        st.roles = null; st.adminTab = "queue";
        say(`${n} new TroopWebHost suggestions added to the approval queue.${adjusted ? ` ${adjusted} overnight lines adjusted so week-long nights are not counted twice.` : ""}`);
      }
      else if (t.id === "doHouseholds") {
        const picks = st.households.map((h, i) => ({ ...h, name: (document.querySelector(`[data-hh-name="${i}"]`)?.value || h.name).trim(),
          on: document.querySelector(`[data-hh="${i}"]`)?.checked })).filter(h => h.on && h.name);
        if (!picks.length || !confirm(`Merge ${picks.length} households?`)) return;
        const ov = { ...(st.data.settings.familyOverrides || {}) }, alias = { ...(ov.__familyAlias || {}) };
        for (const h of picks) for (const f of h.families) {
          if (f === h.name) continue;
          await S.mergeFamily(st.year, f, h.name);
          Object.keys(alias).forEach(k => { if (alias[k] === f) alias[k] = h.name; });
          alias[f] = h.name;
        }
        ov.__familyAlias = alias; await S.saveSettings(st.year, { ...st.data.settings, familyOverrides: ov });
        st.households = null; st.adminTab = "families";
        say(`Merged ${picks.length} households: ${picks.map(h => h.name).join(", ")}.`);
      }
      else if (t.id === "bulkTwh") {
        const ctx = { adults: st.data.adults, entries: st.data.entries };
        const ids = st.data.entries.filter(e => e.status === "pending" && e.source === "twh" && !(st.me.adult_name && st.me.adult_name === e.adult_name) && !T420.flags(e, ctx).length).map(e => e.id);
        if (!confirm(`Approve ${ids.length} TroopWebHost suggestions?`)) return;
        await S.reviewMany(ids, "approved", who());
        say(`Approved ${ids.length} suggestions.`);
      }
      else if (t.id === "doImport") {
        const p = st.parsed; await S.importYear(p.built);
        const sd = (await S.yearData(p.year, true)).settings;
        await S.saveSettings(p.year, { ...sd, familyOverrides: { ...(sd.familyOverrides || {}), __annualAdults: p.built.adults.map(a => a.name) } });
        st.parsed = null; st.year = p.year; await fillYears();
        say(`Imported ${p.year}: ${p.built.adults.length} adults, ${p.built.entries.length} TroopWebHost lines.`);
      }
    } catch (e) { say(e.message, false); }
    await refresh();
  });

  document.addEventListener("change", async ev => {
    const t = ev.target, d = t.dataset;
    try {
      if (t.id === "year") { st.year = +t.value; return refresh(); }
      if (t.id === "xls" && t.files.length) {
        let annual = null, positions = null, events = null, participation = null; const names = [], unknown = [];
        for (const f of t.files) {
          const buf = await f.arrayBuffer(), k = T420Ingest.sniff(buf);
          if (!k) unknown.push(f.name);
          else if (k.kind === "annual") annual = buf;
          else if (k.kind === "positions") { positions = k.rows; names.push("positions"); }
          else if (k.kind === "events") { events = k.rows; names.push("event leaders"); }
          else if (k.kind === "participation") { participation = k.rows; names.push("event participation"); }
          else if (k.kind === "involvement") st.households = T420Ingest.households(k.rows, st.data.adults);
        }
        if (!annual && !positions && !events && !participation && st.households) return render();
        if (unknown.length) say(`Not a recognised TroopWebHost export: ${unknown.join(", ")}`, false);
        st.roles = positions || events || participation ? { files: names, result: T420Ingest.buildRoles(positions, events, { year: st.year, roster: st.data.adults, cfg, alias: (st.data.settings.familyOverrides || {}).__familyAlias,
            annualAdults: (st.data.settings.familyOverrides || {}).__annualAdults
              || [...new Set(st.data.entries.filter(e => e.source === "twh" && !e.notes).map(e => e.adult_name))] }, participation) } : null;
        if (!annual) { st.parsed = null; return render(); }
        const people = T420Ingest.parseWorkbook(annual);
        const years = [...new Set(people.map(p => p.year))].sort((a, b) => b - a);
        const year = years.includes(st.year) ? st.year : years[0];
        st.parsed = { people, year, built: T420Ingest.buildYear(people, year, cfg.twh, (await S.yearData(year, true)).settings.familyOverrides || {}) };
        return render();
      }
      if (t.id === "impYear") {
        const y = +t.value; st.parsed.year = y;
        st.parsed.built = T420Ingest.buildYear(st.parsed.people, y, cfg.twh, (await S.yearData(y, true)).settings.familyOverrides || {});
        return render();
      }
      if (d.famT !== undefined) { await S.updateFamily(st.year, d.famT, { target_override: t.value === "" ? null : +t.value }); say("Target saved."); }
      else if (d.famMerge !== undefined && t.value) {
        const from = d.famMerge, to = t.value;
        if (!confirm(`Merge the ${from} family into ${to}? All adults, Scouts and lines move to ${to}.`)) { t.value = ""; return; }
        await S.mergeFamily(st.year, from, to);
        const ov = { ...(st.data.settings.familyOverrides || {}) };
        const alias = { ...(ov.__familyAlias || {}) };
        Object.keys(alias).forEach(k => { if (alias[k] === from) alias[k] = to; });   // keep chains flat
        alias[from] = to; ov.__familyAlias = alias;
        await S.saveSettings(st.year, { ...st.data.settings, familyOverrides: ov });
        say(`Merged ${from} into ${to}.`);
      }
      else if (d.famQ !== undefined) { await S.updateFamily(st.year, d.famQ, { join_quarter: t.value ? +t.value : null }); say("Saved."); }
      else if (d.adReg !== undefined) { await S.updateAdult(st.year, d.adReg, { registered: t.checked }); say("Saved."); }
      else if (d.adYpt !== undefined) { await S.updateAdult(st.year, d.adYpt, { ypt_current: t.value === "" ? null : t.value === "true" }); say("Saved."); }
      else if (d.adFam !== undefined) {
        const fam = t.value.trim(); if (!fam) return;
        await S.reassign(st.year, d.adFam, fam);
        await S.saveSettings(st.year, { ...st.data.settings, familyOverrides: { ...(st.data.settings.familyOverrides || {}), [d.adFam]: fam } });
        say(`${d.adFam} moved to ${fam}.`);
      } else return;
    } catch (e) { say(e.message, false); }
    await refresh();
  });

  async function fillYears() {
    const ys = await S.years(); if (!ys.includes(st.year)) ys.unshift(st.year);
    $("#year").innerHTML = ys.map(y => `<option ${y === st.year ? "selected" : ""}>${y}</option>`).join("");
  }

  (async function boot() {
    await S.init();
    if (S.mode === "demo") $("#modeBanner").innerHTML = `<div class="banner demo"><b>Demo mode${cfg.TEST_MODE ? " · test mode (no login)" : ""}.</b> Sample families, and claims are stored only in this browser. Connect Supabase in <code>config.js</code> to make claims and approvals shared.</div>`;
    if (cfg.TEST_MODE && S.mode === "live") $("#modeBanner").innerHTML = `<div class="banner test"><b>Test mode.</b> Shared Supabase data, but the Committee console has no login. Anyone with this link can approve or delete. Not for real use yet.</div>`;
    st.me = await S.me(); await fillYears(); await refresh();
    window.addEventListener("hashchange", render);
  })();
})();
