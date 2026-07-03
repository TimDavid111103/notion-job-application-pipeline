---
name: job-aggregators
description: "How to source job postings from each supported aggregator. Use whenever pulling or refreshing job listings from these boards. Covers, per aggregator, how to access it, search and filter, and what to extract, and the standard structured list to return."
---

# Job Aggregators

## Aggregators

- Wobo
- Handshake
- Jack & Jill

## Pull

Pull postings from each aggregator listed above via Claude in Chrome. Run agents in parallel:

1. Spawn one agent per aggregator in the list above.
2. Give each agent its own browser tab. Each agent acts only on its own `tabId`.
3. Each agent logs its results to the scratch file as soon as it finishes its aggregator (see **Logging**). Do not wait for all agents to finish before logging.
4. Once all agents are done, read the scratch file and merge all rows into one combined list.
5. Check the merged list against the Notion Application Tracker database (`32f1de14-69d8-803a-81ba-fb8cf47a1ccd`) for duplicates (see **Dedup Against Application Tracker**).
6. Return the deduplicated list in the **Output** format.

## Logging

Sourcing can take a while, and an agent or tab can fail partway through. To avoid losing completed work:

- Create one shared scratch file at the start of a Pull run, e.g. `/home/claude/sourced-jobs.md`, containing only the **Output** table header.
- The moment an aggregator section reaches its stop condition (see each aggregator's last step below), append its captured rows to that file using the **Output** table format. Do this before moving on to the next aggregator or finishing.
- If a Pull run is interrupted, the scratch file still holds every aggregator that finished before the interruption.
- Treat the scratch file as the source of truth for the final merge. Do not reconstruct the list from memory.

## Wobo

1. Open `https://www.wobo.ai/` and click **Sign In**.
2. If a login form appears:
   - Enter `30.recess_archaea@icloud.com` in the email field.
   - Post the password in chat for the user to paste themselves: `kemfuh-dyrjor-pocPu6`. Do not type it.
   - Wait for the user to submit the form.
3. Click **Feed** in the left sidebar.
4. For each job card:
   - Capture the **Output** fields from the card excerpt.
   - Skim the card against `references/elimination-rules.md`. If a rule is clearly met, press **Skip** and move on. If unclear, keep the role.
   - Set **Source** to `Wobo`.
   - Read the **href** of the "View original" link for the **Job URL**. Do not click the link.
   - Press **Save** to log the role and advance.
   - Wait for the next card to fully render before pressing **Save** again.
   - Click **Skip for now** on any Autopilot promo.
   - If the "View original" link is missing or returns a 404, press **Skip** and do not log the role.
5. Stop when **"You're all caught up! No more matches for today"** appears.
6. Append all rows captured in this section to the scratch file (see **Logging**).

## Handshake

1. Open `https://app.joinhandshake.com/job-search`.
2. Click **Filters** in the top-right of the search bar area.
3. In the filters panel, select:
   - **Employment type**: Full-Time
   - **Job type**: Job
   - **Pay and benefits**: Paid
   - **Onsite/remote**: Onsite, Remote, Hybrid
   - **Work authorization**: Open to US visa sponsorship, Open to Optional Practical Training (OPT)
4. Click **Apply**.
5. Search variations of Junior AI Engineering roles one at a time, in sequence: `Junior AI Engineer`, `Agentic AI`, etc.
6. Skim the job list against `references/elimination-rules.md`. Ignore roles where a rule is clearly met, and roles that list compensation as an hourly rate. If unclear, keep the role.
7. For each remaining role:
   - Click the role to open its preview panel.
   - Ignore the AI Summary badge if present. Rely only on the job description.
   - Click **More** to expand the full JD if needed to confirm no elimination rule is clearly met.
   - Capture the **Job URL** from the browser address bar (format: `https://app.joinhandshake.com/jobs/{id}`).
   - Set **Source** to `Handshake`.
8. Stop a search variation once it has yielded 10 relevant roles or its results are exhausted, then move to the next variation.
9. After all variations are done, remove duplicates across them before finalizing the list.
10. Append all rows captured in this section to the scratch file (see **Logging**).

## Jack & Jill

1. Open `https://app.jackandjill.ai/jack/dashboard/inbox`.
2. If a login prompt appears, log in with `tim.david1111@gmail.com`. Post the password request in chat and wait for the user to submit it.
3. **Fill the inbox.** Check the inbox item count next to **Inbox** in the left sidebar. If it is already at 10 or more items, skip to step 4. Otherwise, alternate between sending a search prompt and checking the count until it reaches at least 10:
   - Use the prompts in `references/jack-prompts.md` as inspiration. Adapt, combine, and vary them rather than sending them verbatim in order.
   - Click the input field, type one prompt, press Enter.
   - Wait for Jack to finish responding and surfacing roles.
   - Check the inbox count. If it is still below 10, send another prompt and check again. Do not stop before reaching 10.
4. **Review each role.** Click **Review job →** on the first inbox item. For each role in the review modal:
   - Scroll up to read the **Role** section (full job description).
   - Locate the **View job post** link and read its `href` attribute. This is the **Job URL**. Do not click it.
   - Capture Company, Role, and Location from the modal header.
   - Set **Source** to `Jack & Jill`.
   - Skim the role against `references/elimination-rules.md`. If a rule is clearly met, click **Not for me**. Otherwise, click **Track**. If unclear, click **Track**.
5. If a role's "View job post" link is missing or broken, click **Not for me** and do not log the role.
6. Stop when all inbox items have been reviewed.
7. Append all rows captured in this section to the scratch file (see **Logging**).

**Interface notes:**
- **Track** and **Not for me** both advance to the next role. Use these to navigate, not the arrow keys.
- The browser URL changes to `?review={uuid}` when a role is open. This is not the job URL. The job URL is always the "View job post" link href.

## Dedup Against Application Tracker

Before returning the final list, remove postings already tracked in the last week:

1. Query the Notion Application Tracker database (`32f1de14-69d8-803a-81ba-fb8cf47a1ccd`) for entries created or updated in the last 7 days.
2. Match each sourced posting against those entries by Job URL first. If the Job URL is missing or doesn't match anything, fall back to matching Company + Role.
3. Drop any sourced posting that matches an existing entry from the merged list.

## Output

Return one combined list, one row per posting:

| Field | Description |
|---|---|
| Company | Company name only |
| Role | Job title |
| Job URL | Direct link to the posting |
| Source | The aggregator it came from (from the Aggregators list) |
| Location | City / remote |
