"""Build docs/Troop420_Supabase_Setup_Guide.docx - step-by-step Supabase wiring guide.
Embeds supabase/schema.sql verbatim so the document is self-contained.
    python3 tools/build_supabase_guide.py
"""
from pathlib import Path
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://sfc-gh-dfreriks.github.io/troop420-volunteer-points/"
REPO = "https://github.com/sfc-gh-dfreriks/troop420-volunteer-points"
RED, GREEN, GOLD, GREY = RGBColor(0xBB, 0, 0), RGBColor(0x2B, 0x3D, 0x3A), RGBColor(0xA6, 0x7C, 0x00), RGBColor(0x5F, 0x6B, 0x68)

doc = Document()
sec = doc.sections[0]
sec.left_margin = sec.right_margin = Inches(0.9)
sec.top_margin = sec.bottom_margin = Inches(0.8)
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(11)


def shade(cell, hex_):
    tcPr = cell._tc.get_or_add_tcPr(); s = OxmlElement("w:shd")
    s.set(qn("w:val"), "clear"); s.set(qn("w:color"), "auto"); s.set(qn("w:fill"), hex_); tcPr.append(s)


_n = [0]


def h(text, level=1):
    _n[0] = 0
    p = doc.add_heading(text, level=level)
    for r in p.runs:
        r.font.color.rgb = RED if level == 1 else GREEN
        r.font.name = "Calibri"
    return p


def para(text="", bold=False, italic=False, color=None, size=None):
    p = doc.add_paragraph(); r = p.add_run(text); r.bold = bold; r.italic = italic
    if color: r.font.color.rgb = color
    if size: r.font.size = Pt(size)
    return p


def rich(*parts):
    """parts: str or (str, 'b'|'i'|'c') tuples. 'c' = inline code."""
    p = doc.add_paragraph()
    for part in parts:
        t, f = (part, "") if isinstance(part, str) else part
        r = p.add_run(t)
        if "b" in f: r.bold = True
        if "i" in f: r.italic = True
        if "c" in f: r.font.name = "Consolas"; r.font.size = Pt(10); r.font.color.rgb = GREEN
    return p


def bullet(*parts, style="List Bullet"):
    p = rich(*parts); p.style = doc.styles[style]; return p


def num(*parts):
    _n[0] += 1
    p = rich((f"{_n[0]}.  ", "b"), *parts)
    p.paragraph_format.left_indent = Inches(0.3); p.paragraph_format.first_line_indent = Inches(-0.25)
    return p


def code(text, size=8.5):
    t = doc.add_table(rows=1, cols=1); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = t.cell(0, 0); shade(c, "F3F4F1"); c.paragraphs[0].text = ""
    lines = text.rstrip("\n").split("\n")
    p = c.paragraphs[0]
    for i, line in enumerate(lines):
        r = p.add_run(line); r.font.name = "Consolas"; r.font.size = Pt(size)
        rpr = r._element.get_or_add_rPr(); f = OxmlElement("w:rFonts"); f.set(qn("w:eastAsia"), "Consolas"); rpr.append(f)
        if i < len(lines) - 1: r.add_break()
    p.paragraph_format.space_after = Pt(0)
    doc.add_paragraph()


def callout(title, text, fill="FFF4D6"):
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); shade(c, fill)
    p = c.paragraphs[0]; r = p.add_run(title + "  "); r.bold = True; r.font.color.rgb = RED if fill == "FDE8EA" else GREEN
    p.add_run(text)
    doc.add_paragraph()


def table(rows, widths=None, header=True):
    t = doc.add_table(rows=len(rows), cols=len(rows[0])); t.style = "Table Grid"
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.cell(i, j); c.text = ""; r = c.paragraphs[0].add_run(str(val)); r.font.size = Pt(9.5)
            if header and i == 0: r.bold = True; r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); shade(c, "2B3D3A")
            if widths: c.width = Inches(widths[j])
    doc.add_paragraph()
    return t


def check(text):
    p = doc.add_paragraph(); r = p.add_run("☐  "); r.font.size = Pt(12); p.add_run(text); return p


# ---------------------------------------------------------------- cover
logo = ROOT / "assets/troop420-emblem.png"
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run().add_picture(str(logo), width=Inches(1.6))
p = para("TROOP 420 · TROOP 8420 · BOTHELL, WASHINGTON", bold=True, color=GOLD, size=10); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = para("Adult Volunteer Points", bold=True, color=RED, size=26); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = para("Supabase setup guide: from demo mode to a live, shared system", bold=True, color=GREEN, size=14); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = para("Everything needed is inside this document, including the complete database script.", italic=True, color=GREY); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
doc.add_paragraph()
table([["Item", "Value"],
       ["Public site", SITE],
       ["Code repository", REPO],
       ["Files changed in this guide", "config.js (two values). Nothing else."],
       ["Cost", "Supabase Free tier ($0). Free projects pause after 7 days with no activity; see Step 11."],
       ["Time", "About 20-30 minutes for the first committee member."]], widths=[1.8, 4.9])

h("What this changes", 2)
para("Today the site runs in demo mode: fictional families, and every claim or approval lives only in the browser that made it. "
     "Connecting Supabase gives the troop one shared database and a real committee login, so:")
bullet(("Anyone", "b"), " can see the standings, the family trackers, the price list and the rules, and can submit a claim for missing credit.")
bullet(("Committee members", "b"), " sign in with an email and password to approve or reject claims, import TroopWebHost, set targets and publish.")
bullet("The database itself enforces the rules: the public sees approved lines only, claims always arrive as pending, only admins approve, "
       "and an admin can never approve their own line.")

h("Before you start", 2)
check("A computer with a web browser. Every step happens in the browser.")
check("Committee member names and email addresses: at least two people, so the Chair's own lines can be signed by someone else.")
check("Edit access to the GitHub repository, or someone who has it, for Step 7.")
check("The latest TroopWebHost export: Reports → Event Participation Annual Summary → Excel.")
doc.add_page_break()

# ---------------------------------------------------------------- steps
h("Step 1 - Create a Supabase account and project")
num("Go to ", ("https://supabase.com", "b"), " and click ", ("Start your project", "b"), ". Sign up with GitHub or with an email address. "
    "Use a troop-owned email if you have one, so the account can be handed over later.")
num("Create an ", ("organization", "b"), " when prompted: name it ", ("Troop 420 Bothell", "c"), ", type Personal, plan ", ("Free", "b"), ".")
num("Click ", ("New project", "b"), " and fill in:")
table([["Field", "Enter"],
       ["Project name", "troop420-points"],
       ["Database password", "Click Generate. Save it in the troop's password manager. The website never uses it."],
       ["Region", "West US (Oregon), the closest to Bothell"],
       ["Security options", "Leave the defaults: Data API on, automatic RLS on"]], widths=[1.8, 4.9])
num("Click ", ("Create new project", "b"), " and wait 1-2 minutes until the dashboard shows the project as healthy.")

h("Step 2 - Create the database (run schema.sql)")
num("In the left sidebar, open ", ("SQL Editor", "b"), " and click ", ("+ New query", "b"), ".")
num("Copy the ", ("entire", "b"), " script below, from the first line to the last, paste it into the editor and click ", ("Run", "b"), ".")
num("The result should be ", ("Success. No rows returned", "b"), ". The script is safe to run again if you need to.")
callout("What it creates:", "five tables (families, adults, entries, admins, settings), a public view (public_entries) that shows "
        "approved lines without contact emails, two helper functions, and the row-level security policies that enforce who can do what.")
schema = (ROOT / "supabase/schema.sql").read_text()
para("supabase/schema.sql (complete)", bold=True, color=GREEN)
code(schema, size=7.5)
para("Check it worked: open ", italic=True).add_run("Table Editor").bold = True
bullet("You should see ", ("admins, adults, entries, families, settings", "c"), ", each marked RLS enabled.")
bullet("If the dashboard warns that ", ("public_entries", "c"), " is a security definer view, that is intentional. The view exists to show "
       "approved rows to the public while the entries table itself stays private.")
doc.add_page_break()

h("Fast path: test without logins (TEST MODE)")
callout("Use this to try every feature before setting up committee accounts.",
        "Do Steps 1 and 2, then the three steps below, and skip Steps 3-6 for now. While test mode is on, anyone with the link can approve, "
        "import or delete, so use test data only and do not announce the site.", fill="FDE8EA")
num("In SQL Editor, run the script below (", ("supabase/test_mode_on.sql", "c"), "). It must run after schema.sql.")
code((ROOT / "supabase/test_mode_on.sql").read_text(), size=8.5)
num("Do Step 7 (paste the Project URL and key into ", ("config.js", "c"), ") and make sure ", ("TEST_MODE: true", "c"), " is set. The repository ships with it on.")
num("Reload the site. A red ", ("Test mode", "b"), " banner shows. Click ", ("Committee", "b"), ", type the name you are acting as (or leave it blank), "
    "click ", ("Open console", "b"), ", then work through Steps 8 and 9.")
para("Turning test mode off (before real use)", bold=True, color=GREEN)
num("Run ", ("supabase/test_mode_off.sql", "c"), " below. Uncomment its last line to wipe the test data.")
code((ROOT / "supabase/test_mode_off.sql").read_text(), size=8.5)
num("Set ", ("TEST_MODE: false", "c"), " in config.js and commit.")
num("Do Steps 3-6 (sign-ups off, site URL, logins, admins), then repeat the Step 9 test with real logins.")
doc.add_page_break()

h("Step 3 - Turn off public sign-ups")
para("Only committee members should have logins. Families never need one: claims are submitted without signing in.")
num("Go to ", ("Authentication → Sign In / Providers", "b"), ". In older dashboards this is Authentication → Providers.")
num("Under ", ("User Signups", "b"), ", switch ", ("Allow new users to sign up", "b"), " OFF and click ", ("Save", "b"), ".")
num("Leave the ", ("Email", "b"), " provider enabled. That is how committee members sign in.")
callout("Why:", "even with sign-ups open, a stranger who registered still could not approve anything, because approvals require a row in the admins table. "
        "Turning sign-ups off removes the possibility entirely.")

h("Step 4 - Set the site address")
num("Go to ", ("Authentication → URL Configuration", "b"), ".")
num("Set ", ("Site URL", "b"), " to ", (SITE, "c"), " and click ", ("Save", "b"), ".")
num("Under ", ("Redirect URLs", "b"), ", add the same address.")
para("This only affects password-reset emails, but setting it now saves confusion later.", italic=True, color=GREY)

h("Step 5 - Create committee logins")
num("Go to ", ("Authentication → Users", "b"), " and click ", ("Add user → Create new user", "b"), ".")
num("Enter the member's email and a temporary password, tick ", ("Auto Confirm User", "b"), ", and click ", ("Create user", "b"), ".")
num("Repeat for each committee member. Send each person their password privately, not by group email.")
para("A login alone grants nothing. Step 6 is what makes someone an admin.", italic=True, color=GREY)

h("Step 6 - Register committee members as admins")
para("Back in SQL Editor, open a new query. Edit the names and emails below, then Run:")
code("""insert into admins (email, adult_name, is_chair) values
  ('chair@example.org',     'Jane Doe',   true),
  ('secretary@example.org', 'John Roe',   false),
  ('advancement@example.org','Sam Smith', false);""", size=9)
table([["Column", "What to enter", "Why it matters"],
       ["email", "Exactly the email used in Step 5", "Links the login to admin rights"],
       ["adult_name", "The person's name exactly as the site shows it after import (\"First Last\", e.g. Jobie Abram)",
        "Blocks approving your own lines. If it does not match, the self-approval guard cannot recognise you"],
       ["is_chair", "true for the Committee Chair, false otherwise", "Informational; the Chair's lines always need a second member"]],
      widths=[1.1, 2.8, 2.8])
para("Useful later:", bold=True)
code("""-- see who is an admin
select * from admins order by email;

-- remove someone (also delete their user under Authentication -> Users)
delete from admins where email = 'former.member@example.org';

-- fix a name so it matches the roster
update admins set adult_name = 'Jobie Abram' where email = 'jobie@example.org';""", size=9)
doc.add_page_break()

h("Step 7 - Connect the website (config.js)")
num("In Supabase, go to ", ("Project Settings → API Keys", "b"), ". Older dashboards call this Project Settings → API.")
num("Copy the ", ("Project URL", "b"), ", which looks like ", ("https://abcdefghijkl.supabase.co", "c"), ". It is also under Project Settings → Data API.")
num("Copy the ", ("public key", "b"), ". Newer projects call it the ", ("Publishable key", "b"), " (", ("sb_publishable_…", "c"), "), older ones the ",
    ("anon public", "b"), " key (a long string starting ", ("eyJ…", "c"), "). Either works.")
callout("NEVER", "copy the secret key or service_role key. It bypasses every rule in Step 2 and must never appear in a website or repository.", fill="FDE8EA")
num("Open ", ("config.js", "c"), " in the repository. On GitHub: open the file, click the pencil icon, edit, then Commit changes. Set the two values:")
code("""window.T420_CONFIG = {
  SUPABASE_URL: "https://abcdefghijkl.supabase.co",      // <- your Project URL
  SUPABASE_ANON_KEY: "sb_publishable_XXXXXXXXXXXXXXXX",  // <- your publishable / anon key

  DEMO_ADMIN_PASSPHRASE: "committee", // ignored once Supabase is connected
  defaultYear: 2026,
  troopName: "Troop 420",

  twh: {
    campingNightsPerTrip: 2,        // 2 camping nights = one overnight-adult trip (25)
    includeCabinNights: true,
    serviceHoursPerCredit: 3,       // every 3 service hours = 10 points
    includeConservationHours: true,
    overnightRequiresRegistration: true
  }
};""", size=9)
num("Commit. GitHub Pages republishes in about a minute.")
num("Reload the site with Ctrl/Cmd + Shift + R. The yellow ", ("Demo mode", "b"), " banner should be gone, and the standings will be empty until Step 8.")
para("Is it safe to publish this key? Yes. The publishable/anon key is designed to sit in public web pages. It can only do what the "
     "row-level security in Step 2 allows: read approved lines and submit pending claims.", italic=True, color=GREY)

h("Step 8 - First import from TroopWebHost")
num("In TroopWebHost: ", ("Reports → Event Participation Annual Summary", "b"), " → export to Excel (.XLS).")
num("On the site, click ", ("Committee", "b"), " (top right) and sign in with your Step 5 email and password.")
num("Open the ", ("Import TroopWebHost", "b"), " tab and choose the file. The file is read in your browser; only the converted results are saved.")
num("Check the preview: pick the year, then review the counts of families, adults and point lines. Click ", ("Import", "b"), ".")
num("Open the ", ("Adults", "b"), " tab and fix anything the export cannot know:")
bullet("Move adults in different-surname households to the right family. The move is remembered on every future import.", style="List Bullet 2")
bullet("Untick ", ("Registered", "b"), " for adults who are not registered leaders, and set ", ("YPT current", "b"), ".", style="List Bullet 2")
num("Open ", ("Families & targets", "b"), " and set a joined-in quarter or a target override where the committee has agreed one.")
table([["Converted from TroopWebHost", "Rule (edit in config.js → twh)"],
       ["Adult camping nights + cabin nights", "Every 2 nights = one overnight-adult trip = 25 pts"],
       ["Adult service hours + conservation hours", "Every 3 hours = one service credit = 10 pts"],
       ["Scout rows", "Counted per family surname only. Youth names are never stored"],
       ["Re-importing the same year", "Replaces only that year's TroopWebHost lines; claims, targets and household moves are kept"]],
      widths=[2.8, 3.9])
doc.add_page_break()

h("Step 9 - Test the whole loop")
para("Do this once with two committee members before announcing the site.")
table([["#", "Who / where", "Do this", "Expect"],
       ["1", "Private/incognito window (not signed in)", "Log missing credit → submit a 10-pt board of review", "\"Thanks - your claim … is with the committee\""],
       ["2", "Same window", "Open Standings and that family", "The claim is NOT shown yet (pending is private)"],
       ["3", "Committee member A", "Committee → Approval queue", "The claim appears, with any audit flags"],
       ["4", "Member A", "Approve it", "It moves to approved; the family total rises by 10"],
       ["5", "Private window", "Reload Standings", "The new total is visible to the public"],
       ["6", "Member A", "Add entry for yourself (any role)", "Saved as pending: \"a second committee member must sign\""],
       ["7", "Member B", "Approve A's pending line", "Succeeds"],
       ["8", "Member A", "Try to approve your own line", "Not offered; the database would refuse it anyway"]],
      widths=[0.3, 1.7, 2.4, 2.3])

h("Step 10 - Go-live checklist")
for t in ["TEST MODE OFF: test_mode_off.sql run and TEST_MODE: false in config.js",
          "Schema run successfully (Step 2) and all five tables show RLS enabled",
          "Public sign-ups OFF (Step 3)",
          "Every committee member has a login (Step 5) AND an admins row whose adult_name matches the roster (Step 6)",
          "config.js has the Project URL and publishable/anon key, never the secret/service_role key (Step 7)",
          "Demo banner gone; current year imported; households, registration and YPT reviewed (Step 8)",
          "Test loop passed with two members (Step 9)",
          "Committee has decided the contribution-in-lieu rate and entered it under Settings & export",
          "Committee has confirmed the conversion ratios (2 nights / 3 hours) or changed them in config.js",
          "Committee has decided whether standings are public or families-only (see Appendix B)",
          "Families have been told the link, the 100-point target and how to log missing credit"]:
    check(t)

h("Step 11 - Keeping it running")
table([["When", "Task"],
       ["After each campout or month", "Export from TroopWebHost and re-import the current year (Step 8)"],
       ["Weekly", "Review the Approval queue; approve or reject with a short reason"],
       ["Quarterly", "Settings & export → set Published through (Q1-Q4); download the tracker CSV for the minutes"],
       ["New committee member", "Steps 5 and 6. Departing member: delete from admins and from Authentication → Users"],
       ["January", "Choose the new year in the year picker and import; targets and households are per year"],
       ["Free-tier pause", "Free projects pause after 7 days with no activity. If the site shows errors, open the Supabase dashboard and click "
                           "Restore project. Regular use keeps it awake; the Pro plan never pauses"],
       ["Backups", "The free tier has no downloadable backups. Download the tracker CSV quarterly, or run the select queries in Appendix A"]],
      widths=[1.9, 4.8])
doc.add_page_break()

# ---------------------------------------------------------------- appendices
h("Appendix A - Handy SQL")
code("""-- pending claims, oldest first
select id, adult_name, family_name, contribution, points, work_date, submitter_email, notes
from entries where status = 'pending' order by created_at;

-- family totals for a year (raw, before caps; the site applies the 30/60 caps)
select family_name, sum(points) as raw_points
from entries where year = 2026 and status = 'approved'
group by family_name order by raw_points desc;

-- set a confidential target (number only, never a reason)
update families set target_override = 40 where year = 2026 and name = 'Smith';

-- set the contribution-in-lieu rate and publish through a quarter
insert into settings (year, in_lieu_rate, published_through) values (2026, '$10 per point', 'Q3')
on conflict (year) do update set in_lieu_rate = excluded.in_lieu_rate, published_through = excluded.published_through;

-- full export of a year (paste results into a spreadsheet as a backup)
select * from entries where year = 2026 order by family_name, work_date;""", size=8.5)

h("Appendix B - Make standings families-only (optional)")
para("By default anyone with the link can see adult names and family totals. To restrict reading to signed-in users only:")
code("""revoke select on public_entries from anon;
drop policy if exists families_read on families;
create policy families_read on families for select to authenticated using (true);
drop policy if exists adults_read on adults;
create policy adults_read on adults for select to authenticated using (true);""", size=9)
para("Families would then need logins (Step 5 without Step 6), and claims would also require signing in. "
     "To undo this, re-run the full schema from Step 2.", italic=True, color=GREY)

h("Appendix C - Troubleshooting")
table([["Symptom", "Cause and fix"],
       ["Demo banner still showing", "config.js not updated or not yet republished. Check the commit, wait a minute, then hard-reload"],
       ["\"Invalid login credentials\"", "Wrong email or password, or the user was not auto-confirmed. Reset under Authentication → Users"],
       ["Signed in but \"not on the committee admin list\"", "No admins row, or the email differs (check spelling). Fix with Step 6"],
       ["\"new row violates row-level security policy\" when approving", "You are approving your own line (adult_name matches yours). Ask another member"],
       ["Approve buttons missing for one line", "Same reason: it is your own line; the site hides the buttons"],
       ["Import fails with \"Could not find the Year / Type / Name header row\"", "Wrong report. Use Event Participation Annual Summary, exported to Excel"],
       ["Family split across two names", "Different surnames in one household. Fix on the Adults tab; it persists on re-import"],
       ["Site loads but shows errors or empty everywhere", "The free project is paused. Restore it in the Supabase dashboard"],
       ["relation \"admins\" does not exist", "Step 2 did not run fully. Re-run the complete schema"]],
      widths=[2.6, 4.1])

h("Appendix D - Who can do what (enforced by the database)")
table([["Action", "Public", "Committee admin"],
       ["See standings, approved lines, price list, rules", "Yes", "Yes"],
       ["See pending/rejected claims and claimant emails", "No", "Yes"],
       ["Submit a claim (always lands as pending)", "Yes", "Yes"],
       ["Approve / reject / delete entries", "No", "Yes, except your own lines"],
       ["Import TroopWebHost, set targets, move households, settings", "No", "Yes"],
       ["Add or remove admins", "No", "Only via the Supabase dashboard / SQL Editor"]],
      widths=[3.9, 1.0, 1.8])

out = ROOT / "docs/Troop420_Supabase_Setup_Guide.docx"
out.parent.mkdir(exist_ok=True)
doc.save(out)
print(out)
