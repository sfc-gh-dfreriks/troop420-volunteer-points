---
name: troopwebhost-export
description: Export, preview and import TroopWebHost "Event Participation Annual Summary" XLS files into the Troop 420 Adult Volunteer Points tracker (GitHub Pages, sfc-gh-dfreriks/troop420-volunteer-points). Use when a new TroopWebHost export arrives, when refreshing volunteer points, previewing family totals, changing the nights/hours-to-points conversion, or troubleshooting an import. Triggers: troopwebhost, TroopWebHost export, Event Participation Annual Summary, import XLS to volunteer points, refresh troop points, troop 420 points, volunteer points import.
---

# TroopWebHost export → Troop 420 Volunteer Points

Project: `~/Documents/GitHub/troop420-volunteer-points` → https://sfc-gh-dfreriks.github.io/troop420-volunteer-points/
Rules source: `~/Downloads/Troop_420_Adult_Volunteer_Points_System.docx` (encoded in `rules.js`).

## 1. Get the export (user does this in TroopWebHost)
Reports → **Event Participation Annual Summary** → export to Excel. File name looks like
`Event Participation Annual Summary YYYYMMDDHHMMSS.XLS` (usually in `~/Downloads`).

## 2. Know the file format
- Binary `.XLS` (CDFV2). Title in row 0, header in row 2 (located by name, not position):
  `Year, Type (Scout|Adult), Name ("Last, First"), Camping Nights, Cabin Camping, Service Hours,
  Conservation Hours, '', Hiking/Backpacking/Cycling/Paddling/Motorboating Miles, Water Hours, Horseback/Skating Miles, Registered Gender`.
- **Per-person annual totals, every year in history** (2008→current) — NOT event rows.
- Only `Type=Adult` rows produce points. Scout rows only count Scouts per surname; youth names are never stored.
- The `read_tabular` tool does NOT work on local files; use the preview tool (SheetJS) or `pip3 install xlrd`.

## 3. Preview before importing (always)
```
cd ~/Documents/GitHub/troop420-volunteer-points
node tools/twh-preview.js "<path to export>.XLS" [YEAR] [--csv /tmp/twh.csv]
```
Uses the exact same `ingest.js` + `rules.js` as the site. Report to the user: years in file, families,
adults, lines, points, families meeting target, and families with Scouts but no adult row
(likely different-surname households to fix on the Adults tab).
Baseline (2026-10-10 export, year 2026): 48 families, 37 adults, 29 lines, 885 pts, 4 met.

## 4. Conversion rules (committee policy, `config.js → twh`)
- (camping nights + cabin nights) ÷ `campingNightsPerTrip` (2) → overnight-adult trips × 25.
- (service + conservation hours) ÷ `serviceHoursPerCredit` (3) → service credits × 10.
- Families grouped by surname; household moves saved in settings.familyOverrides and reapplied on re-import.
If the user changes a ratio: edit `config.js`, re-run the preview, commit, push.

## 5. Import
Import happens in the browser (file never leaves the machine or enters git):
site → **Committee** → sign in → **Import TroopWebHost** → choose file → pick year → **Import**.
Re-import replaces only that year's `source='twh'` lines; claims, targets, YPT/registration and household moves persist.
- Demo mode (no Supabase in `config.js`): data is browser-local only, passphrase `committee`.
- Live mode: Supabase, schema in `supabase/schema.sql`; admins in the `admins` table.

## 6. Guardrails
- NEVER commit `.XLS/.xlsx/.csv` exports (blocked by `.gitignore`) — they contain real names incl. youth.
- Don't paste real roster names into the repo, README or demo seed data.
- After code changes: run the preview + `python3 /tmp/t420ui.py`-style Playwright smoke (claim → admin approve → import), then `git push`; Pages rebuilds in ~1 min.
