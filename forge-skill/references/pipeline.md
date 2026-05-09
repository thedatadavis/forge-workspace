# FORGE — Pipeline Reference

## When to use this
Read this file when managing deal stages, logging activity, checking for
stale prospects, reviewing the pipeline, or updating `pipeline/tracker.md`.

---

## Pipeline Stages (in order)

| Stage | Meaning | Typical next action |
|-------|---------|-------------------|
| New | Added, not yet scored | Score & qualify |
| Qualified | Scored ≥50, worth pursuing | Draft outreach |
| Contacted | First touch sent | Follow up in 4 days |
| Meeting Scheduled | Call/meeting booked | Prep + confirm |
| Proposal Sent | Package sent | Chase in 5–7 days |
| Negotiation | Active back-and-forth | Close |
| Won | Deal signed | Onboard + deliver |
| Lost | Dead or passed | Note reason, set reopen date |

---

## Moving a Prospect Through Stages

When the user says "move [company] to [stage]" or equivalent:

1. Read `prospects/[slug].md` to confirm current stage and data
2. Update these fields in the file:
   ```
   - **Stage**: [new stage]
   - **Last Contacted**: [today's date]
   - **Next Action**: [what happens next]
   - **Next Action Date**: [YYYY-MM-DD]
   ```
3. Append to the Activity Log section (create it if missing):
   ```
   ## Activity Log
   - [YYYY-MM-DD] Stage → [New Stage]: [note]
   ```
4. Confirm the update with a summary

**Stage-specific next action defaults:**
- → Qualified: "Draft first-touch outreach"
- → Contacted: "Follow up if no reply by [today + 4 days]"
- → Meeting Scheduled: "Send calendar invite + prep notes"
- → Proposal Sent: "Chase if no response by [today + 7 days]"
- → Won: "Send onboarding info + kickoff call"
- → Lost: "Log reason, note reopen date if applicable"

---

## Stale Detection

A prospect is stale when:
- `next_action_date` is set AND is more than 3 days in the past
- Stage is not Won or Lost

When asked to check for stale prospects:
1. Read every file in `prospects/`
2. Parse `next_action_date` for each
3. Calculate days overdue (today − next_action_date)
4. Return a sorted table (most overdue first), filtered to active stages
5. For each stale prospect, suggest a concrete re-engagement action

```
# ⚠️ Stale Prospects

| Company | Stage | Overdue | Next Action (was) | Score |
|---------|-------|---------|-------------------|-------|
| Lone Star Brewery | Contacted | 6 days | Follow-up email | 87 |
| Acme Auto | Qualified | 11 days | Draft outreach | 61 |

**Recommended:** Re-engage Lone Star Brewery first (HOT + most overdue).
```

---

## Pipeline View

When asked for a pipeline overview or "how's the pipeline?":

Read all prospect files and output:

```
# Pipeline Overview — [today's date]

## By Stage
| Stage | Count | Pipeline Value | Avg Score |
|-------|-------|----------------|-----------|
| New | 3 | — | 42 |
| Qualified | 4 | $18,000 | 68 |
| Contacted | 2 | $9,000 | 74 |
...

## Hot Prospects (75+)
[list]

## Stale (action overdue)
[list]

## Summary
- Total active: N
- Pipeline value: $X
- Weighted forecast: $X (pipeline × avg close rate estimate)
```

---

## Updating tracker.md

After any bulk operation (scoring all, stage sweep, stale check), offer to
update `pipeline/tracker.md` with a fresh summary table. This is the
lightweight "dashboard" — keep it current so the founder can glance at it
in GitHub without running Claude.

---

## Won / Lost Handling

**Won:**
- Set stage to Won
- Ask for: deal value, package sold, close date
- Log in `pipeline/tracker.md` Won section
- Congratulate — then ask if they want to open a renewal reminder

**Lost:**
- Set stage to Lost
- Ask for: reason (budget, timing, no interest, went with competitor)
- Log reason in Activity Log
- Ask: reopen date? (set a future next_action_date for re-engagement)
