# FORGE — Outreach Reference

## When to use this
Read this file when generating any outreach artifact: first-touch email,
LinkedIn connection request, LinkedIn DM, or follow-up sequence.

---

## Pre-Generation Checklist

Before writing any outreach, confirm you have:
- [ ] Team profile read (`team/profile.md`) — name, city, audience, tone, inventory
- [ ] Prospect file read — company, industry, geography, fit signals, capture notes
- [ ] Score run (or existing score in file) — use fit reasoning to ground the copy
- [ ] Stage awareness — don't draft a follow-up for a prospect still at New

---

## Artifact 1: First-Touch Email

**When:** Prospect is Qualified or New with a good score. User asks for
an outreach email, intro email, or first email.

**Constraints:**
- Under 150 words (body only, not counting subject)
- Subject line: personal, specific, never "Partnership opportunity"
- No "I hope this email finds you well" or equivalent openers
- Lead with value to them — not an ask
- Reference something specific about their business or market position
- Local market connection if applicable
- End with low-friction CTA: a question, a quick call, reply with interest
- Sound like one human to another — not a marketing department

**Template structure:**
```
Subject: [specific, curiosity-driving, 6–9 words]

[Opening that references something concrete about them — 1 sentence]

[Core value prop — what's in it for them specifically — 2–3 sentences]

[Soft CTA — 1 sentence]

[Sign-off]
```

**Grounding the copy:**
Pull these into the prompt context:
- Team name, sport, city, audience size/identity
- Prospect's industry, geography, known sponsor history
- Category relevance reasoning from the score
- Local market alignment reasoning from the score
- Audience alignment notes from the prospect file
- Brand tone from team profile

**Save to:** `generated/outreach-[slug]-[YYYY-MM-DD].md`

---

## Artifact 2: LinkedIn Connection Request

**When:** User wants to connect with a prospect on LinkedIn before emailing,
or as the primary outreach channel.

**Constraints:**
- **Hard limit: 300 characters total** (LinkedIn enforces this)
- Count characters carefully before finalizing
- No pitch, no mention of sponsorship
- Reference something specific — their business, city, recent activity
- One or two short sentences maximum
- Make them feel seen, not sold to
- Optional: use mutual_context (shared group, event, connection) if provided

**Format:** Just the note text. No subject, no labels.

**Character check:** Count the output. If over 280, trim. Never exceed 300.

**Save to:** `generated/linkedin-connect-[slug]-[YYYY-MM-DD].md`

---

## Artifact 3: LinkedIn DM (Post-Connect)

**When:** User has connected and wants to open a conversation.

**Constraints:**
- 3–5 sentences max, under 400 characters preferred
- Warmer and more conversational than cold email
- Reference the connection request if context is provided (don't repeat it)
- Light mention of partnership potential — plant a seed, don't pitch
- End with a specific, easy-to-answer question — not "would you be interested?"
- Something like: "Are you doing much local marketing this season?" or
  "Do you work with any sports organizations currently?"

**Save to:** `generated/linkedin-dm-[slug]-[YYYY-MM-DD].md`

---

## Artifact 4: Follow-Up Sequence

**When:** User needs 2–3 follow-up messages after an unanswered first touch.

**Constraints:**
- 3 steps, each with a distinct angle and emotional register
- Never repeat content from the first touch (ask for summary if unknown)
- Each step should feel like a different version of the sender

**Step arc:**

| Step | Timing | Angle | Length |
|------|--------|-------|--------|
| 1 | 4 days after first touch | Add one new proof point or stat | <80 words |
| 2 | 7 days after first touch | Completely different frame (season timing, comparable partner, local data) | <100 words |
| 3 | 14 days after first touch | Honest breakup — brief, respectful, leaves door open | <60 words |

**Step 3 rules:**
- Must not be passive-aggressive
- Genuine close: "Totally understand if the timing isn't right —
  happy to revisit when it makes sense"
- Never guilt or pressure

**For email:** Include subject line per step (vary them — don't use the same
subject pattern each time).

**For LinkedIn DM:** No subject line. Keep each under 300 characters.

**Format output:**
```
STEP 1 — Day 4
Subject: [if email]

[body]

---

STEP 2 — Day 7
Subject: [if email]

[body]

---

STEP 3 — Day 14
Subject: [if email]

[body]
```

**Save to:** `generated/followup-[slug]-[YYYY-MM-DD].md`

---

## Quality Check (run mentally before presenting)

- [ ] Is anything over its character/word limit?
- [ ] Does it reference something specific (not generic)?
- [ ] Is it grounded in actual team + prospect data?
- [ ] Does it sound like a real person?
- [ ] Is it labeled as a draft requiring approval?
- [ ] Is it saved to `generated/`?
