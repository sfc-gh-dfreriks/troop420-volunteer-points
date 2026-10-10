# Troop 420 Adult Volunteer Points

A public, static volunteer-points tracker for Troop 420 families, hosted on GitHub Pages. It implements the
**Troop 420 Adult Volunteer Points System (revised proposal)**.

| Who | Can do |
| --- | --- |
| Anyone (public) | See family standings and each family's tracker, the price list and the rules. Submit a claim for work they weren't credited for. |
| Volunteer committee (admin login) | Approve or reject claims (with audit flags), add entries, import TroopWebHost, set targets, manage households, publish, export CSV. |

## What it enforces (from the points document)

- **Ladder:** 100 / 60 / 40 / 25 / 15 / 10 / 5. The full role price list is in `rules.js`.
- **Targets:**
  - 100 per family per year, January to December.
  - 60 for a single registered adult.
  - Joining mid-year: 25 per remaining quarter.
  - Committee overrides set in confidence. Only the number is stored, never the reason.
- **Caps:**
  - Micro-tasks, including committee meetings: 30.
  - Committee meetings on their own: 30.
  - Merit badge counselling: 60.
  - Caps are applied in date order, and the tracker shows "capped from" on any line that hit one.
- **Audit flags in the approval queue:**
  - off-price or off-ladder points;
  - date outside the year, or in the future;
  - registered-adult roles claimed by an unregistered adult;
  - YPT not current;
  - post already claimed;
  - work that falls inside a post the adult holds (no double counting);
  - possible duplicates;
  - Chair entries.
- **No self-approval:** an admin cannot approve their own line. The Chair's line needs a second member. This is enforced both in the UI and by row-level security in the database.
- **Recognition:** Commitment met (100), Silver (150), Gold (200), Platinum (300+). Below 100 the site shows progress ("50 of 100 · halfway"), not an award.

## TroopWebHost import

The **Event Participation Annual Summary** export (`.XLS`) is a per-person annual total, not a list of events. On the
**Committee → Import TroopWebHost** tab the file is parsed **in the browser** and converted as follows:

- **Adult** camping nights, plus cabin nights, become overnight-adult trips: 2 nights = 1 trip = 25 points.
- **Adult** service hours, plus conservation hours, become service credits: every 3 hours = 10 points.
- **Scout** rows are only used to count Scouts per family surname. Youth names are never stored.
- Households are grouped by surname. Move adults in different-surname households on the **Adults** tab; the move is remembered on re-import.
- Re-importing a year replaces only that year's TroopWebHost lines. Approved claims, targets and household moves are kept.

The conversion ratios live in `config.js → twh`. They are committee policy, so adjust them there.

Everything that TroopWebHost does not record comes in through **Log missing credit** and committee approval. That includes committee posts, boards of review, driving other Scouts, grubmaster, merit badge counselling and training.

## Modes

**Demo (default).** Works on GitHub Pages immediately. It shows fictional sample families, and all data stays in the visitor's browser (localStorage). The admin passphrase is in `config.js`. Use it to try the workflow; it is **not** shared and **not** secure.

**Live (Supabase, free tier).** This mode gives shared data and a real admin login. To set it up:

1. Create a project at supabase.com.
2. Open the **SQL Editor**, paste `supabase/schema.sql` and run it.
3. Go to **Authentication → Users → Add user** and create one user (email and password) for each committee member.
4. Register each committee member as an admin:
   ```sql
   insert into admins (email, adult_name, is_chair) values ('chair@example.org', 'Anders Halvorsen', true);
   ```
   `adult_name` must match the name on the roster exactly (format "First Last"). This is what blocks self-approval.
5. Turn off public sign-ups under **Authentication → Providers → Email → disable "Allow new users to sign up"**.
6. Copy the **Project URL** and **anon public key** into `config.js`, then commit. The anon key is designed to be public; row-level security does the protecting:
   - The public reads approved lines only, through the `public_entries` view. Claimant emails are hidden.
   - Anyone can insert, but only `pending` claims.
   - Only admins can update, delete, import, or change targets.
   - Approving your own line is rejected by the database.

## Privacy

The document's design is that every family sees every family's total. On a public site, that means "everyone on the internet". Adult names and family totals are published; youth names are not. If the committee wants totals visible only to troop families, keep the repository public but put the site behind a shared link, or switch the `public_entries` read policy to `authenticated` and give families logins.

Do **not** commit TroopWebHost exports to this repository. `.gitignore` blocks `*.xls` and `*.xlsx`.

## Run locally

```
python3 -m http.server 8000   # then open http://localhost:8000
```

There is no build step. The vendored libraries are SheetJS (XLS parsing) and supabase-js.

## Previewing an export from the command line

```
node tools/twh-preview.js "Event Participation Annual Summary <timestamp>.XLS" 2026 [--csv out.csv]
```

This runs the same ingest and rules code as the site. It prints family totals and targets, and lists families that have Scouts but no adult row. Nothing is uploaded. The Cortex Code skill that documents the export → preview → import workflow is in `skills/troopwebhost-export/SKILL.md`.

## Supabase setup guide

A step-by-step Word guide that includes the complete `schema.sql` is in `docs/Troop420_Supabase_Setup_Guide.docx`. To regenerate it after editing the schema, run `python3 tools/build_supabase_guide.py`.
