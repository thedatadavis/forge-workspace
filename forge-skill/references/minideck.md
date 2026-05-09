# FORGE — Mini-Deck Reference

## When to use this
Read this file when generating a one-page sponsor overview, leave-behind,
mini-deck, or one-pager for a specific prospect.

---

## What a Mini-Deck Is

A single self-contained HTML file designed to be:
- Opened in Chrome and printed → Save as PDF
- Emailed as an attachment
- Shared as a link (if hosted)
- A leave-behind after a call or meeting

It is **not** a full pitch deck. It is one page, visually tight, data-grounded,
and customized per prospect.

---

## Pre-Generation Checklist

Before building the deck, collect:

**From `team/profile.md`:**
- [ ] Team name, sport, city/region
- [ ] In-person attendance (avg per game + season total)
- [ ] Social followers (Instagram, TikTok, etc.)
- [ ] Email list size
- [ ] Brand tone / audience identity

**From `team/inventory.md`:**
- [ ] Package name and assets (if user hasn't specified)
- [ ] Pricing tier

**From `prospects/[slug].md`:**
- [ ] Company name
- [ ] Industry/category
- [ ] Audience alignment notes
- [ ] Geography

**From scoring output:**
- [ ] Fit tier and top reasoning lines

**From user (ask if missing):**
- [ ] Package name (e.g., "Community Partner")
- [ ] Package assets (e.g., "jersey sleeve, 4 social posts/month, email banner")
- [ ] Package price (e.g., "$2,500/season")
- [ ] Hero stat to feature (defaults to season attendance)

---

## Page Sections

The deck has six fixed sections. Do not add or remove sections.

| Section | Content |
|---------|---------|
| **Header** | Team name (large) + "Prepared for [Sponsor]" |
| **Hero stat** | One big number + audience match statement |
| **Why us** | Local reach + real connection — 2–3 sentences |
| **Why now** | Category still open — exclusivity angle |
| **Audience stats** | 4-stat grid: attendance, Instagram, email, TikTok |
| **Package block** | Package name, asset list, price |
| **Footer** | "Let's talk." CTA + contact prompt |

---

## Copy Guidelines

**Hero stat headline:** Always "Fans who look like your customers."
Follow with the audience alignment note from the prospect file.

**Why us card:**
- Reference the fit reasoning (category + local market)
- End with: "Our fans are [audience identity] — the same people you're trying to reach."

**Why now card:**
- Lead with category exclusivity: "We don't have a [category] partner yet."
- Follow with: "That means first-mover positioning, exclusivity, and a clean
  association with the team."

**Package asset list:** Format as `→ Asset name` per line (use arrow, not bullet).

**Footer CTA:** "Ready to put your brand in front of [city] fans this season?
Reply to this or reach out directly."

---

## HTML Output Spec

Generate a complete, self-contained HTML file. Requirements:

- Google Fonts import: Bebas Neue (headings) + DM Sans (body)
- A4 dimensions: `width: 210mm`, `min-height: 297mm`
- Color palette (use CSS vars):
  ```css
  --ink: #0f0f0f;
  --paper: #f5f1eb;
  --accent: #c8371a;
  --rule: #d4cfc8;
  --muted: #6b6560;
  --light: #e8e3db;
  ```
- Print-safe: include `print-color-adjust: exact`
- All stats and copy populated from real data — no placeholder text
- No logo placeholder (note in output that logo can be added)

**Save to:** `generated/minideck-[slug]-[YYYY-MM-DD].html`

---

## After Generating

Tell the user:
1. Open the file in Chrome
2. Print → Save as PDF (or Cmd+P → Save as PDF)
3. Fields they may want to manually update: team logo, season dates, real
   package pricing if it changed
4. Attach to outreach email or share the PDF link
