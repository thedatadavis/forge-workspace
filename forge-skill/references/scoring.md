# FORGE — Scoring Reference

## When to use this
Read this file when the user asks to score a prospect, qualify leads, rank
prospects, or understand why a prospect scored a certain way.

---

## Step-by-Step: Score a Prospect

1. Read `team/profile.md` — capture city/region, audience identity, tone,
   current sponsors
2. Read `prospects/[slug].md` — capture all fit signal fields
3. Read `.forge/scoring-config.json` — use these exact weights (do not
   substitute your own)
4. Score each dimension (0–100), apply weights, sum to total
5. Write score back into the prospect file
6. Surface data gaps and conflict warnings

---

## Scoring Dimensions & Weights

| Dimension | Weight | What to assess |
|-----------|--------|---------------|
| Category Relevance | 25% | Does the industry map to sports audiences? |
| Local Market Alignment | 25% | Is the business in the team's city/region? |
| Audience Channel Alignment | 20% | Does their customer profile match the fan base? |
| Known Sponsorship Behavior | 20% | Evidence of prior sports or community sponsorship? |
| Budget Signal | 10% | Proxy indicators of available marketing spend |

**Score tiers:**
- 🔥 HOT — 75+ (prioritize immediately)
- 🌡 WARM — 50–74 (queue for outreach)
- ❄️ COLD — <50 (deprioritize or enrich further)

---

## Scoring Rubrics

### Category Relevance
Use the tiers from `scoring-config.json`. In general:
- **High (90–100):** Auto dealers, restaurants/bars, breweries, fitness,
  sports retail, health clinics, physical therapy, local insurance,
  local real estate
- **Medium (55–70):** Local banks, dental, urgent care, staffing, home
  services, event venues, financial advisors
- **Low (20–40):** B2B software, wholesale, manufacturing, corporate legal

### Local Market Alignment
- **High (90–100):** Prospect's primary market matches team city — same
  city or immediate metro
- **Medium (55–70):** Regional presence with meaningful overlap
- **Low (20–40):** National brand, no meaningful local footprint
- **Unknown (40):** Geography not specified — flag as data gap

### Audience Channel Alignment
- **High (85–100):** Explicit notes confirm customer↔fan demographic match
- **Medium (60–75):** Plausible match based on industry + location
- **Low (30–50):** No clear overlap or mismatch
- **Unknown (45):** No alignment notes — flag as data gap, set to neutral

### Known Sponsorship Behavior
- **High (100):** Active sponsor of another sports team or league
- **Medium (60):** Sponsors community events, races, charity programs
- **Low (25):** No known sponsorship history
- **Unknown (45):** Not researched — flag as data gap

### Budget Signal
Score based on count of positive signals:
- 3+ signals → 85–100
- 2 signals → 65–80
- 1 signal → 45–60
- 0 / unknown → 30–40

Positive signals: runs paid ads, dedicated marketing staff, multiple
locations, franchise or chain, recent funding or expansion, co-op eligible

---

## Output Format

```
# Fit Score: [N]/100 — [TIER]

## Score Breakdown
| Dimension | Score | Weight | Reasoning |
|-----------|-------|--------|-----------|
| Category Relevance | N | 25% | [one line] |
| Local Market Alignment | N | 25% | [one line] |
| Audience Alignment | N | 20% | [one line] |
| Sponsorship Behavior | N | 20% | [one line] |
| Budget Signal | N | 10% | [one line] |

## ⚠️ Conflict Check
[Only show if category matches a current sponsor]

## 📋 Data Gaps
[List fields that would improve accuracy — be specific]
```

Then write these fields back into the prospect file:
```
- **Fit Score**: [N]/100 — [TIER]
- **Score Breakdown**: See last score run
- **Scored At**: [ISO timestamp]
```

---

## Scoring All Prospects

When asked to rank all prospects:
1. Read every file in `prospects/` (skip `_template.md`)
2. Score each against the same team profile
3. Sort by score descending
4. Output as a ranked table with tier, data quality indicator, and filename
5. Highlight HOT prospects and call out any with critical data gaps

```
# Prospect Rankings

| Rank | Company | Score | Tier | Data Quality | File |
|------|---------|-------|------|--------------|------|
| 1 | Lone Star Brewery | 87/100 | 🔥 HOT | ✅ complete | lone-star-brewery.md |
| 2 | Acme Auto | 61/100 | 🌡 WARM | ⚠️ 2 gaps | acme-auto.md |
```
