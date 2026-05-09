# FORGE — Package Builder Reference

## When to use this
Read this file when building or pricing a sponsor package, creating a
proposal snippet, or helping the user define package tiers.

---

## Pre-Build Checklist

Before building a package:
- [ ] Read `team/inventory.md` — all available assets + existing package tiers
- [ ] Read `team/profile.md` — audience metrics (needed for CPM/CPF calculations)
- [ ] Confirm prospect file for context on what to emphasize
- [ ] Ask user: what tier level is this package targeting?

---

## Pricing Logic (MVP Heuristics)

### Digital Inventory — CPM-based

CPM = cost per 1,000 impressions. Sports sponsorship CPMs typically run
$15–45 depending on engagement and exclusivity.

Use $20 CPM as the conservative baseline for local/semi-pro.

```
Asset value = (reach × frequency × CPM) / 1,000
```

**Example:**
- Instagram post, 4,200 followers, posted 4x/month = 4,200 × 4 × $20 / 1,000 = $336/month
- Email banner, 2,100 subscribers, sent 2x/month = 2,100 × 2 × $20 / 1,000 = $84/month

### Physical Inventory — Cost Per Fan (CPF)

CPF = package price ÷ total season attendance.
Target range: $0.50–$3.00 CPF depending on placement prominence.

```
Asset value = CPF × season attendance
```

**Example:**
- Courtside banner, 8,500 season attendees, $1.50 CPF → $12,750/season
- Jersey sleeve, same attendance, $3.00 CPF → $25,500/season

### Event Assets

Price by activation type:
- Naming rights to a single event: 15–25% of event attendance × $2–5
- PA read (per game): $50–150/game × number of games
- Giveaway sponsorship: production cost + 30–50% margin

---

## Package Composition

A good package has at least one asset from each category:
- Physical (tangible, visible at games)
- Digital (reaches audience outside games)
- Event (activation / experience)

When composing a package:
1. Pull available assets from `inventory.md`
2. Select a balanced set matching the target tier
3. Calculate individual asset values
4. Sum to package value
5. Apply a bundle discount: 10–15% for 3+ assets
6. Round to a clean number

---

## Output Format

```
# Sponsor Package: [Package Name]
**Prepared for:** [Company] | **Season:** [dates]

## Included Assets

| Asset | Category | Frequency | Est. Value |
|-------|----------|-----------|------------|
| Jersey sleeve logo | Physical | Full season | $X |
| 4x Instagram posts/month | Digital | Monthly | $X |
| Email newsletter banner | Digital | 2x/month | $X |
| Halftime PA read | Event | Per game | $X |

**Subtotal:** $X
**Bundle discount (12%):** -$X
**Package Price:** $[rounded total]/season

## Value Rationale
- CPM for digital: $20 (conservative local baseline)
- CPF for physical: $X.XX ([N] season attendees)
- Exclusivity: [category] category reserved for this partner

## What You Get
[2–3 sentence summary in plain language — what the sponsor actually experiences]
```

---

## Package Tiers (Standard)

Reference these defaults if `inventory.md` doesn't have tiers defined:

| Tier | Price Range | Anchor Assets |
|------|-------------|---------------|
| Starter | $1,000–2,500/season | 2 social posts/month + 1 physical placement |
| Community Partner | $2,500–6,000/season | Social + email + gameday PA |
| Presenting Partner | $6,000–15,000/season | All of above + jersey or signage |
| Title / Jersey | $15,000+/season | Jersey chest + full digital + venue naming |

---

## Proposal Snippet

After building a package, offer a "proposal-ready snippet" — a short
2–3 paragraph version suitable for pasting into an email or attaching
to a mini-deck. Keep it to ~100 words.

Save the full package to: `generated/package-[slug]-[YYYY-MM-DD].md`
