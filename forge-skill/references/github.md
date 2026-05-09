# FORGE — GitHub Issues Reference

## When to use this
Read this file when the user wants to sync prospects to GitHub Issues,
view the pipeline in GitHub, manage issue labels, or automate stale alerts.

---

## Setup Requirements

The user needs:
- `FORGE_GH_TOKEN` — a GitHub Personal Access Token with `repo` scope
- `FORGE_GH_REPO` — the repo in `owner/repo` format (same repo as the workspace)

If these aren't set, remind the user and offer to help them create a PAT
at github.com/settings/tokens.

---

## Issue Structure

Each prospect gets **one open issue at a time**. When a stage advances,
the current issue is closed and a new one opens for the next stage.

**Issue title format:** `[Action]: [Company Name]`
- New → `Score & qualify: Acme Auto`
- Qualified → `Draft outreach: Acme Auto`
- Contacted → `Follow up: Acme Auto`
- Meeting Scheduled → `Prep for meeting: Acme Auto`
- Proposal Sent → `Chase proposal: Acme Auto`
- Negotiation → `Close deal: Acme Auto`
- Won / Lost → close all open issues, no new one

**Issue body always includes:**
```
**Company:** [name]
**Stage:** [stage]
**Fit Score:** [N]/100 — [tier]
**File:** `prospects/[slug].md`

[next action note if available]

---
<!-- forge-slug: [slug] -->
```

The `forge-slug` HTML comment is the lookup key — it's how we find the
right issue for a prospect without relying on exact title matching.

---

## Label System

Labels are created automatically on first sync. Never ask the user to
create them manually.

**Stage labels (blue family):**
`stage:new` · `stage:qualified` · `stage:contacted` · `stage:meeting`
`stage:proposal` · `stage:negotiation` · `stage:won` · `stage:lost`

**Tier labels:**
`tier:hot` (red) · `tier:warm` (orange) · `tier:cold` (blue)

**Utility:**
`forge` (amber) — applied to every FORGE-managed issue
`stale` (yellow) — added by stale detection

---

## GitHub API Calls

Use `fetch` with the GitHub REST API. Base URL: `https://api.github.com/repos/{owner}/{repo}`

Always include:
```
Authorization: Bearer {FORGE_GH_TOKEN}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

**Key endpoints:**
- `GET /issues?state=open&labels=forge&per_page=100` — list all FORGE issues
- `POST /issues` — create issue
- `PATCH /issues/{number}` — update issue (state, labels, title)
- `POST /issues/{number}/comments` — add comment
- `GET /labels` / `POST /labels` — manage labels

**Finding a prospect's issue:**
Search open issues for `forge` label, then find the one whose body contains
`forge-slug: {slug}`. This is more reliable than title matching.

---

## Operations

### Sync single prospect
When user says "sync [company] to GitHub" or after a stage change:
1. Find existing open issue for the slug
2. If exists: update labels + add a comment with new state
3. If not: create new issue with correct title, body, and labels

### Sync all prospects
When user says "sync all to GitHub" or "push pipeline to GitHub":
1. Ensure all labels exist (create missing ones)
2. For each prospect file:
   - Find existing open issue
   - If exists: update labels
   - If not: create new issue
3. Return a summary table

### Stale detection → GitHub
When stale detection finds overdue prospects:
1. Find (or create) the issue for each stale prospect
2. Add the `stale` label
3. Add a comment: `⚠️ STALE — N days overdue\n[next action that was set]`

### Stage change → GitHub
When `update_prospect_stage` is called:
1. Comment on the current issue: "Stage → [New Stage] ([date])\n[note]"
2. Close the current issue
3. Open a new issue with the stage-appropriate title
4. Apply correct stage + tier labels

### Pipeline view from GitHub
When user says "show me the GitHub pipeline" or "open issues":
1. `GET /issues?state=open&labels=forge&per_page=100&sort=updated`
2. Format as a table with: issue number (linked), title, stage label,
   tier label, stale indicator, last updated date

---

## GitHub Actions: Stale Automation

If the user wants stale detection to run automatically (without Claude open),
they can add this workflow to `.github/workflows/forge-stale.yml`:

```yaml
name: FORGE Stale Check
on:
  schedule:
    - cron: '0 9 * * 1-5'   # 9am weekdays
  workflow_dispatch:          # allow manual trigger

jobs:
  stale-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for stale prospects
        env:
          FORGE_GH_TOKEN: ${{ secrets.FORGE_GH_TOKEN }}
          FORGE_GH_REPO: ${{ github.repository }}
        run: |
          node .forge/stale-check.js

      - name: Commit any updates
        run: |
          git config user.name "FORGE Bot"
          git config user.email "forge-bot@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || git commit -m "chore: forge stale check $(date +%Y-%m-%d)"
          git push
```

**Setup:**
1. Add `FORGE_GH_TOKEN` as a repository secret (Settings → Secrets → Actions)
2. The secret needs `repo` scope
3. Workflow runs automatically — also triggerable manually from Actions tab

Also offer to generate the `.forge/stale-check.js` script when asked.
