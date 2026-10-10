#!/usr/bin/env node
// Preview a TroopWebHost "Event Participation Annual Summary" export exactly as the site
// will import it (same ingest.js + rules.js). Nothing is uploaded or written to the repo.
//   node tools/twh-preview.js "<export>.XLS" [year] [--csv out.csv] [--json out.json]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
global.window = global;
global.XLSX = require(path.join(root, "vendor/xlsx.full.min.js"));
for (const f of ["config.js", "rules.js", "ingest.js"]) vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--") && !/^\d{4}$/.test(a));
if (!file) { console.error('usage: node tools/twh-preview.js "<export>.XLS" [year] [--csv out.csv] [--json out.json]'); process.exit(1); }
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };

const buf = fs.readFileSync(file);
const people = T420Ingest.parseWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const years = [...new Set(people.map(p => p.year))].sort((a, b) => b - a);
const year = Number(args.find(a => /^\d{4}$/.test(a))) || years[0];
const b = T420Ingest.buildYear(people, year, T420_CONFIG.twh, {});

const fams = b.families.map(f => T420.familySummary(
  { ...f, registered_adults: b.adults.filter(a => a.family_name === f.name).length },
  b.entries.filter(e => e.family_name === f.name))).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));

console.log(`File years: ${years.join(", ")}   Importing: ${year}`);
console.log(`Families ${b.families.length} · adults ${b.adults.length} · TroopWebHost lines ${b.entries.length} · points ${b.entries.reduce((s, e) => s + e.points, 0)}`);
console.log(`Rules: ${T420_CONFIG.twh.campingNightsPerTrip} nights = 25-pt overnight trip; ${T420_CONFIG.twh.serviceHoursPerCredit} service hours = 10 pts\n`);
console.log("Family".padEnd(22) + "Pts".padStart(5) + "Target".padStart(8) + "  Status");
for (const f of fams) console.log(f.name.padEnd(22) + String(f.total).padStart(5) + String(f.target).padStart(8) + "  " + (f.tier ? f.tier.name : f.met ? "Target met" : `${f.pct}%`));
const noAdult = b.families.filter(f => !b.adults.some(a => a.family_name === f.name));
if (noAdult.length) console.log(`\n${noAdult.length} families have Scouts but no adult row (check different-surname households): ${noAdult.map(f => f.name).join(", ")}`);

const csvOut = opt("--csv");
if (csvOut) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["family_name", "adult_name", "role_id", "contribution", "points", "work_date", "source"];
  fs.writeFileSync(csvOut, [head.join(","), ...b.entries.map(e => head.map(h => q(e[h])).join(","))].join("\n"));
  console.log(`\nWrote ${csvOut}`);
}
const jsonOut = opt("--json");
if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(b, null, 2)); console.log(`Wrote ${jsonOut}`); }
