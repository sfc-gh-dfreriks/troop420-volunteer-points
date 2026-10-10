---
name: troopwebhost-export
description: Programmatically pull TroopWebHost report data (roster, calendar, advancement, any "Open in Excel" report, full XML database backup) as CSV using the user's own logged-in browser session, from a local script or another project. Includes a catalog of every export available to Troop 420 Bothell. Use when: accessing TroopWebHost data programmatically, exporting a TroopWebHost report, automating Troop 420 Bothell data, finding a Menu_Item_ID, listing what can be exported, building a tool on top of TroopWebHost data. Triggers: troopwebhost, TroopWebHost API, troop 420, Troop420Bothell, FormReport.aspx, Menu_Item_ID, export troop calendar, export troop roster, scout data export, troopwebhost backup, what can I export from troopwebhost.
---

# TroopWebHost report export

TroopWebHost has **no published API**. Any report with an "Open in Excel" link can be
downloaded as CSV once a browser session is logged in. This skill packages a working,
read-only method (verified 2026-10-10 against Troop 420 Bothell).

## Script

`scripts/twh_export.py` is a self-contained CLI and importable module (needs Python
Playwright + Chromium, which are already installed on this laptop). A working copy lives in the
private repo `sfc-gh-dfreriks/troop420-tools`, cloned at `~/Documents/Troop420`, which also holds
the user's browser profile and exports (both git-ignored).

```bash
python3 twh_export.py --login 46093 46012   # opens a window; user logs in; saves CSVs
python3 twh_export.py 46093                 # headless reuse (currently fails: see Session)
# --troop Troop420Bothell  --out <dir>  --profile <dir>
```

```python
import sys; sys.path.insert(0, "<skill dir>/scripts")
from twh_export import export_reports, SessionExpired, LoginTimeout
results = export_reports(["46093"], out_dir="exports", profile="~/Documents/Troop420/.browser-profile", login=True)
# [{"menu_id", "path", "header", "rows"}]
```

For another project, copy the script in or import it. Point `--profile` at
`~/Documents/Troop420/.browser-profile` to share one login, or use a separate profile per project.

## Export catalog (what exists)

Full catalog built 2026-10-10 from the user's logged-in menu plus the user guide:
`~/Documents/Troop420/docs/export-catalog.md` (human-readable) and `docs/excel_exports.json`
(ID, page, menu path, formats). Read it before guessing an ID.
- **Everything:** Administration > Database Backup, ID 45984, `BackupUserDatabase.aspx`. Whole
  troop database as XML, Site Administrator only (the user's login can see it). It can't be
  restored into TWH, excludes photos and documents, and large ones may time out.
- **118 reports with Open in Excel**: Membership (directories, medical, training), Advancement,
  Calendar/events, Inventory, Money (46004 = all transactions), and Administration security
  reports. Examples: 46012 Scout Directory, 46013 Adult Directory, 46017 Patrol Roster,
  46093 Upcoming Events Details, 45897 Export Roster to Excel, 53104 Export Events To Excel,
  45935 Export Event Participation. 18 of them use `FormReportMultiSection.aspx` instead of
  `FormReport.aspx`, which `twh_export.py` doesn't handle yet, and some per-scout ones need
  `Form_ID`/`FK` parameters.
- **Form-based downloads** (need the page's own form posted, not a plain GET): Sales orders 46111,
  Scoutbook Plus 53074, Troop Awards files 45954 / 45898, Download Photos 55647 (zip),
  Subscribe to Calendar 45908 (per-user calendar URL).
- **Not offered**: API, RSS, webhooks, vCard, e-mail lists, QuickBooks.

## How it works (the non-obvious parts)

- **Report URL is at the site root**:
  `https://www.troopwebhost.org/FormReport.aspx?Menu_Item_ID=<id>&Stack=1&ReportFormat=XLS`.
  `https://www.troopwebhost.org/Troop420Bothell/Index.htm` is only a frameset with the login
  form. `/Troop420Bothell/FormReport.aspx` returns **404**. The session cookies select the troop.
- **Response**: `text/plain` CSV with a UTF-8 BOM, despite `ReportFormat=XLS`. Decode with `utf-8-sig`.
- **Not logged in / no role**: a 302 to `http://www.TroopWebhost.com/index.htm`. Fetch with
  `max_redirects=0`, otherwise it looks like a 200 HTML page.
- **Login must be human**: the login page has a Google reCAPTCHA. Never automate credentials.
  Open a headed window and poll the report URL until it returns CSV.
- **Menu_Item_ID**: from the report's "Open in Excel" link, e.g.
  `javascript:LinkTo('FormReport.aspx?Menu_Item_ID=46093&Stack=1&ReportFormat=XLS','')`.
- **Menu discovery**: after login, the Index.htm frameset's second frame holds the whole nested
  menu (`toggleLower('mN')` divs, with `LinkTo('...')` links in PDF and XLS pairs). Save the
  frame's HTML and walk the DOM to rebuild the menu paths. Crawling outward from the public frame
  only reaches the photo gallery and help pages, and probing `Default.aspx`, `Welcome.aspx` etc. gives 404.
- **Cookies seen**: `User_Login_ID`, `Session_Key`, `Language_ID`, `ScreenWidth`.

## Session limitation (open problem)

A login does **not** survive closing the browser. A headless rerun gets the 302 and the script
exits with code 2. `Session_Key` is most likely a session cookie that Chromium drops on close
(unconfirmed). Also avoid reloading `Index.htm` on an existing session, because that appeared
to reset it. Untested next step for unattended runs: save `ctx.storage_state()` / the cookies
after a successful export and re-add them with `ctx.add_cookies()` on the next launch.
TroopWebHost may still expire the session server-side.

## Environment gotchas

- `cortex browser` refuses troopwebhost.org with `net::ERR_BLOCKED_BY_CLIENT`, and no allowlist
  setting was found. Use local Python Playwright instead (`launch_persistent_context`, headed for login).
- `npx playwright` is not installed. Python Playwright is.

## Rules

- **Read-only.** Only GET exports the user can already download by hand. Do not POST to
  `FormList.aspx` admin grids (the gammann Med_Form uploader does this to write records).
  Writes change live troop data and need explicit user approval. Posting a download form
  (e.g. Troop Awards) is read-only in effect, but confirm with the user first.
- **PII**: roster, directory, medical, allergy and financial exports contain minors' personal data.
  Keep files local (`exports/` is git-ignored), never print row contents to chat (headers and
  counts only), never commit them, and never upload them anywhere.
- **Unofficial**: this replays internal endpoints that TroopWebHost may change without notice.
  The user is responsible for the Terms of Service. It is fine for personal use on this laptop.
  Don't deploy it to the troop site or share it without the user's OK.

## Reference

- Community tools using the same endpoints: https://github.com/gammann/TroopWebHost (Custom-Page
  HTML tools that run inside TWH same-origin; roles per report are listed in each tool's README).
- Official guide: https://www.troopwebhost.org/help.aspx (Database Backup: help.aspx?ID=190).
