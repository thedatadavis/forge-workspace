# FORGE — Task Management Reference

## When to use this
Read this file when the user wants to add a task, see what's due, check
follow-ups, mark something done, or review what needs attention today.
Also trigger stale detection from here — it's the same operation.

---

## Why TASKS.md (not GitHub Issues)

One flat file in the repo root. No auth, no API calls, no infrastructure.
The founder can read it in GitHub, edit it in any text editor, and Claude
can update it in-place. It's the right tool until the team grows past one.

---

## File Location

`forge-workspace/TASKS.md`

Always read the current file before adding or updating tasks — never
overwrite from memory.

---

## Task Format

Each task is one line:

```
- [ ] YYYY-MM-DD | P[1-3] | [slug] | [action]
```

| Field | Values | Meaning |
|-------|--------|---------|
| `[ ]` / `[x]` | checkbox | open / done |
| `YYYY-MM-DD` | due date | when this needs to happen |
| `P1` / `P2` / `P3` | priority | P1 = today, P2 = this week, P3 = someday |
| `[slug]` | prospect slug or `—` | links task to a prospect file |
| `[action]` | free text | what to actually do |

**Examples:**
```
- [ ] 2025-03-10 | P1 | lone-star-brewery | Send follow-up email (no reply to first touch)
- [ ] 2025-03-11 | P2 | acme-auto | Draft LinkedIn DM after connecting
- [ ] 2025-03-14 | P2 | — | Research brewery sponsors in Austin market
- [x] 2025-03-08 | P1 | lone-star-brewery | Send first-touch email ← done
```

---

## File Structure

```markdown
# FORGE Tasks

## Open

- [ ] 2025-03-10 | P1 | lone-star-brewery | Send follow-up email
- [ ] 2025-03-11 | P2 | acme-auto | Draft LinkedIn DM
- [ ] 2025-03-14 | P3 | — | Research local brewery sponsors

## Done

- [x] 2025-03-08 | P1 | lone-star-brewery | Send first-touch email
```

Keep Open and Done sections separate. Done tasks accumulate as a log —
don't delete them. Archive to `## Done (archived)` if the Done section
gets over 30 lines.

---

## Operations

### Add a task
When user says "add a task", "remind me to", "follow up with X in N days",
or a stage change implies a next action:

1. Read current `TASKS.md`
2. Determine: due date, priority, slug, action text
3. Insert into the Open section, sorted by due date ascending
4. Write the file back
5. Confirm: "Added: [task line]"

**Priority defaults:**
- "today" / "urgent" / overdue → P1
- "this week" / specific date within 7 days → P2
- "someday" / no date / >7 days out → P3

**Auto-add tasks on stage changes:**
When `update_prospect_stage` is called, automatically add a task based on
the new stage and next_action_date from the prospect file:

| New Stage | Auto-task |
|-----------|-----------|
| Qualified | Draft outreach for [company] |
| Contacted | Follow up with [company] if no reply |
| Meeting Scheduled | Prep notes + confirm meeting with [company] |
| Proposal Sent | Chase proposal with [company] |
| Negotiation | Check in on deal status — [company] |

### Show tasks due today / this week
When user asks "what's due today", "what do I have", "what needs attention":

1. Read `TASKS.md`
2. Parse all open tasks
3. Filter and group:

```
## Today (P1 + overdue)
- 🔴 OVERDUE (3d) | lone-star-brewery | Send follow-up email

## This Week (P2, due within 7 days)
- 2025-03-11 | acme-auto | Draft LinkedIn DM
- 2025-03-14 | — | Research brewery sponsors

## Someday (P3)
- [count] tasks — ask to see them
```

Always lead with overdue items. Make them impossible to miss.

### Mark a task done
When user says "done", "mark [x] complete", "finished the follow-up":

1. Read `TASKS.md`
2. Find the matching task (fuzzy match on slug + action text)
3. Change `[ ]` → `[x]`
4. Move the line from Open to Done section
5. Write back
6. Confirm + ask if a follow-up task should be created

### Stale detection
When user asks "what's stale" or "who needs follow-up":

1. Read all files in `prospects/`
2. For each prospect (excluding Won/Lost):
   - Check `next_action_date`
   - If past due by 3+ days → stale
3. Cross-reference with `TASKS.md` — is there already an open task for them?
4. If no open task exists for a stale prospect, offer to create one
5. Return sorted table (most overdue first):

```
# ⚠️ Stale Prospects

| Company | Stage | Overdue | Score | Open Task? |
|---------|-------|---------|-------|------------|
| Lone Star Brewery | Contacted | 6 days | 87 🔥 | No — add one? |
| Acme Auto | Qualified | 11 days | 61 🌡 | Yes |
```

---

## Weekly Review Prompt

If the user asks for a "weekly review" or "what's the state of things":

1. Show stale prospects
2. Show all P1 + overdue tasks
3. Show pipeline summary (count by stage)
4. Ask: "Want to batch-add follow-up tasks for anything stale?"

This should feel like a 5-minute standup, not a report.

---

## Task ↔ Prospect Linkage

When showing tasks, if a slug is present, offer to jump to that prospect:
"Lone Star Brewery is 🔥 HOT (87/100) — want me to draft the follow-up now?"

This is the core loop: task surfaces → Claude drafts the artifact → founder
approves and sends → stage advances → new task auto-added.
