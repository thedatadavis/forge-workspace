#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const REPO_PATH = process.env.FORGE_REPO || path.join(process.env.HOME, "forge-workspace");

function repoPath(...parts) {
  return path.join(REPO_PATH, ...parts);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function listFiles(dir, ext = ".md") {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(ext) && !f.startsWith("_"))
      .map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ── Scoring Engine ───────────────────────────────────────────────────────────

function loadScoringConfig() {
  const raw = readFile(repoPath(".forge", "scoring-config.json"));
  return raw ? JSON.parse(raw) : null;
}

function parseMarkdownFields(content) {
  // Extract bold **Key**: Value pairs AND indented sub-list "  - Label: Value" items
  const fields = {};
  const lines = content.split("\n");
  for (const line of lines) {
    const boldMatch = line.match(/^[-*]?\s*\*\*([^*]+)\*\*:\s*(.+)/);
    if (boldMatch) {
      fields[boldMatch[1].toLowerCase().replace(/\s+/g, "_")] = boldMatch[2].trim();
      continue;
    }
    const subMatch = line.match(/^\s{2,}[-*]\s+([^:]+):\s*(.+)/);
    if (subMatch) {
      fields[subMatch[1].toLowerCase().replace(/\s+/g, "_")] = subMatch[2].trim();
    }
  }
  return fields;
}

function scoreProspect(prospectContent, teamContent, config) {
  const prospect = parseMarkdownFields(prospectContent);
  const team = parseMarkdownFields(teamContent);

  const scores = {};
  const explanations = {};

  // 1. Category Relevance
  const industry = (prospect["industry_/_category"] || prospect["industry/category"] || "").toLowerCase().replace(/\s+/g, "_");
  const highCats = config.scoring.category_relevance.tiers.high;
  const medCats = config.scoring.category_relevance.tiers.medium;

  let catScore = 40;
  let catMatch = "unknown category";
  for (const cat of highCats) {
    if (industry.includes(cat.replace(/_/g, " ")) || industry.includes(cat)) {
      catScore = 100; catMatch = `"${industry}" is a high-fit category`; break;
    }
  }
  if (catScore === 40) {
    for (const cat of medCats) {
      if (industry.includes(cat.replace(/_/g, " ")) || industry.includes(cat)) {
        catScore = 65; catMatch = `"${industry}" is a medium-fit category`; break;
      }
    }
  }
  scores.category_relevance = catScore;
  explanations.category_relevance = catMatch;

  // 2. Local Market Alignment
  const prospectGeo = (prospect["geography"] || "").toLowerCase();
  const teamCity = (team["city_/_region"] || team["city/region"] || "").toLowerCase();
  const cityWord = teamCity.split(/[,\/\s]/)[0];

  let geoScore = 30;
  let geoNote = "No geography data";
  if (prospectGeo && cityWord) {
    if (prospectGeo.includes(cityWord) || prospectGeo.includes("local")) {
      geoScore = 100; geoNote = "Prospect is in team's local market";
    } else if (prospectGeo.includes("regional")) {
      geoScore = 65; geoNote = "Regional presence — partial overlap";
    } else if (prospectGeo.includes("national")) {
      geoScore = 35; geoNote = "National brand — local activation possible but harder";
    }
  }
  scores.local_market_alignment = geoScore;
  explanations.local_market_alignment = geoNote;

  // 3. Audience Channel Alignment
  const audienceNotes = (prospect["audience_alignment_notes"] || "").toLowerCase();
  let audScore = 50; // neutral default — insufficient data
  let audNote = "No audience alignment notes provided — recommend adding";
  if (audienceNotes && audienceNotes.length > 10) {
    audScore = 75;
    audNote = "Alignment notes present — manual review recommended";
  }
  scores.audience_channel_alignment = audScore;
  explanations.audience_channel_alignment = audNote;

  // 4. Known Sponsorship Behavior
  const sponsorHistory = (prospect["known_sponsor_of_other_teams"] || "").toLowerCase();
  let sponScore = 30;
  let sponNote = "No sponsorship history known";
  if (sponsorHistory.includes("yes")) {
    sponScore = 100; sponNote = "Active sports sponsor — high conversion signal";
  } else if (sponsorHistory.includes("unknown")) {
    sponScore = 50; sponNote = "Unknown — worth investigating before outreach";
  }
  scores.known_sponsorship_behavior = sponScore;
  explanations.known_sponsorship_behavior = sponNote;

  // 5. Budget Signal
  const budgetSignal = (prospect["budget_signal"] || "").toLowerCase();
  let budScore = 40;
  let budNote = "No budget signals noted";
  if (budgetSignal && budgetSignal.length > 5) {
    const positives = ["ads", "marketing", "franchise", "multiple", "growth", "staff"];
    const hits = positives.filter(p => budgetSignal.includes(p));
    if (hits.length >= 2) { budScore = 85; budNote = `Strong budget signals: ${hits.join(", ")}`; }
    else if (hits.length === 1) { budScore = 60; budNote = `Some budget signal: ${hits[0]}`; }
    else { budScore = 40; budNote = "Budget signal noted but weak"; }
  }
  scores.budget_signal = budScore;
  explanations.budget_signal = budNote;

  // Weighted total
  const w = config.scoring.weights;
  const total = Math.round(
    scores.category_relevance * w.category_relevance +
    scores.local_market_alignment * w.local_market_alignment +
    scores.audience_channel_alignment * w.audience_channel_alignment +
    scores.known_sponsorship_behavior * w.known_sponsorship_behavior +
    scores.budget_signal * w.budget_signal
  );

  const thresholds = config.score_thresholds;
  const tier = total >= thresholds.hot ? "🔥 HOT" : total >= thresholds.warm ? "🌡 WARM" : "❄️ COLD";

  // Conflict check
  const currentSponsors = teamContent.toLowerCase();
  const companyName = (prospect["company"] || "").toLowerCase();
  const industryRaw = (prospect["industry_/_category"] || "").toLowerCase();
  const conflictWarning = currentSponsors.includes(industryRaw) && industryRaw.length > 3
    ? `⚠️ Possible category conflict — check active sponsors in team profile`
    : null;

  // Data gaps
  const gaps = [];
  if (!prospect["geography"] || prospect["geography"] === "") gaps.push("geography");
  if (!prospect["audience_alignment_notes"] || prospect["audience_alignment_notes"] === "") gaps.push("audience_alignment_notes");
  if (!prospect["budget_signal"] || prospect["budget_signal"] === "") gaps.push("budget_signal");
  if (!prospect["known_sponsor_of_other_teams"]) gaps.push("known_sponsor_of_other_teams");

  return { total, tier, scores, explanations, conflictWarning, gaps };
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "forge",
  version: "0.1.0",
});

// ── Tool: get_team_profile ───────────────────────────────────────────────────

server.tool(
  "get_team_profile",
  "Read the current team's profile including audience metrics, inventory, and brand voice.",
  {},
  async () => {
    const content = readFile(repoPath("team", "profile.md"));
    if (!content) {
      return { content: [{ type: "text", text: "No team profile found. Create one at team/profile.md using the template." }] };
    }
    return { content: [{ type: "text", text: content }] };
  }
);

// ── Tool: score_prospect ─────────────────────────────────────────────────────

server.tool(
  "score_prospect",
  "Score a prospect's sponsorship fit against the team profile. Returns a weighted score with dimension-by-dimension breakdown.",
  {
    prospect_file: z.string().describe("Filename of the prospect in the prospects/ folder, e.g. 'acme-auto.md'"),
  },
  async ({ prospect_file }) => {
    const prospectPath = repoPath("prospects", prospect_file);
    const prospectContent = readFile(prospectPath);
    if (!prospectContent) {
      return { content: [{ type: "text", text: `Prospect file not found: ${prospect_file}` }] };
    }

    const teamContent = readFile(repoPath("team", "profile.md"));
    if (!teamContent) {
      return { content: [{ type: "text", text: "Team profile not found. Please set up team/profile.md first." }] };
    }

    const config = loadScoringConfig();
    if (!config) {
      return { content: [{ type: "text", text: "Scoring config not found at .forge/scoring-config.json" }] };
    }

    const result = scoreProspect(prospectContent, teamContent, config);

    const lines = [
      `# Fit Score: ${result.total}/100 — ${result.tier}`,
      ``,
      `## Score Breakdown`,
      `| Dimension | Score | Weight | Reasoning |`,
      `|-----------|-------|--------|-----------|`,
      `| Category Relevance | ${result.scores.category_relevance} | 25% | ${result.explanations.category_relevance} |`,
      `| Local Market Alignment | ${result.scores.local_market_alignment} | 25% | ${result.explanations.local_market_alignment} |`,
      `| Audience Alignment | ${result.scores.audience_channel_alignment} | 20% | ${result.explanations.audience_channel_alignment} |`,
      `| Sponsorship Behavior | ${result.scores.known_sponsorship_behavior} | 20% | ${result.explanations.known_sponsorship_behavior} |`,
      `| Budget Signal | ${result.scores.budget_signal} | 10% | ${result.explanations.budget_signal} |`,
    ];

    if (result.conflictWarning) {
      lines.push(``, `## ⚠️ Conflict Check`, result.conflictWarning);
    }

    if (result.gaps.length > 0) {
      lines.push(``, `## 📋 Data Gaps (fill these to improve score accuracy)`, result.gaps.map(g => `- ${g}`).join("\n"));
    }

    const output = lines.join("\n");

    // Write score back into prospect file
    const updatedContent = prospectContent
      .replace(/- \*\*Fit Score\*\*:.*/, `- **Fit Score**: ${result.total}/100 — ${result.tier}`)
      .replace(/- \*\*Score Breakdown\*\*:.*/, `- **Score Breakdown**: See last score run`)
      .replace(/- \*\*Scored At\*\*:.*/, `- **Scored At**: ${new Date().toISOString()}`);
    writeFile(prospectPath, updatedContent);

    return { content: [{ type: "text", text: output }] };
  }
);

// ── Tool: list_prospects ─────────────────────────────────────────────────────

server.tool(
  "list_prospects",
  "List all prospects in the pipeline with their current stage and score.",
  {
    stage: z.string().optional().describe("Filter by stage: New, Qualified, Contacted, Meeting, Proposal, Won, Lost"),
  },
  async ({ stage }) => {
    const files = listFiles(repoPath("prospects"));
    if (!files.length) {
      return { content: [{ type: "text", text: "No prospect files found in prospects/" }] };
    }

    const rows = [];
    for (const file of files) {
      const content = readFile(file);
      if (!content) continue;
      const fields = parseMarkdownFields(content);
      const company = fields["company"] || path.basename(file, ".md");
      const fileStage = fields["stage"] || "New";
      const score = fields["fit_score"] || "—";
      const nextAction = fields["next_action"] || "—";
      const due = fields["next_action_date"] || "—";

      if (stage && !fileStage.toLowerCase().includes(stage.toLowerCase())) continue;

      rows.push(`| ${company} | ${fileStage} | ${score} | ${nextAction} | ${due} |`);
    }

    const header = `| Company | Stage | Fit Score | Next Action | Due |\n|---------|-------|-----------|-------------|-----|`;
    const output = rows.length
      ? `# Prospects\n\n${header}\n${rows.join("\n")}`
      : `No prospects found${stage ? ` with stage: ${stage}` : ""}.`;

    return { content: [{ type: "text", text: output }] };
  }
);

// ── Tool: create_prospect ────────────────────────────────────────────────────

server.tool(
  "create_prospect",
  "Create a new prospect file from captured data. Used by Chrome extension and manual entry.",
  {
    company: z.string().describe("Company name"),
    website: z.string().optional(),
    industry: z.string().optional().describe("Industry or category"),
    geography: z.string().optional().describe("City, region, or 'National'"),
    contact_name: z.string().optional(),
    contact_title: z.string().optional(),
    contact_email: z.string().optional(),
    linkedin_url: z.string().optional(),
    source: z.string().optional().describe("How was this prospect found"),
    notes: z.string().optional().describe("Any raw capture notes"),
    local_presence: z.string().optional().describe("Yes / No / Regional / National"),
    known_sponsor: z.string().optional().describe("Yes / No / Unknown"),
    budget_signal: z.string().optional(),
    audience_alignment: z.string().optional(),
  },
  async (args) => {
    const slug = slugify(args.company);
    const filePath = repoPath("prospects", `${slug}.md`);

    if (fs.existsSync(filePath)) {
      return { content: [{ type: "text", text: `Prospect already exists: ${slug}.md — open it to update.` }] };
    }

    const content = `# Prospect: ${args.company}

## Basic Info
- **Company**: ${args.company}
- **Website**: ${args.website || ""}
- **Industry / Category**: ${args.industry || ""}
- **Geography**: ${args.geography || ""}
- **Company Size**: 
- **Key Contact**: ${args.contact_name || ""}, ${args.contact_title || ""}
- **Contact Email**: ${args.contact_email || ""}
- **LinkedIn URL**: ${args.linkedin_url || ""}
- **Source**: ${args.source || "Manual"}
- **Date Added**: ${today()}

## Fit Signals
- **Local Market Presence**: ${args.local_presence || ""}
- **Known Sponsor of Other Teams**: ${args.known_sponsor || "Unknown"}
- **Category Active in Local Sports**: Unknown
- **Audience Alignment Notes**: ${args.audience_alignment || ""}
- **Budget Signal**: ${args.budget_signal || ""}

## Capture Notes
${args.notes || ""}

## Outreach Status
- **Stage**: New
- **Last Contacted**: 
- **Next Action**: 
- **Next Action Date**: 
- **Owner**: 

## Score
- **Fit Score**: 
- **Score Breakdown**: 
- **Scored At**: 
`;

    writeFile(filePath, content);

    return {
      content: [{
        type: "text",
        text: `✅ Created prospect: ${slug}.md\n\nRun \`score_prospect\` with filename "${slug}.md" to get a fit score.`
      }]
    };
  }
);

// ── Tool: generate_outreach ──────────────────────────────────────────────────

server.tool(
  "generate_outreach",
  "Generate a first-touch outreach email for a prospect, grounded in team profile and fit reasoning.",
  {
    prospect_file: z.string().describe("Filename of the prospect, e.g. 'acme-auto.md'"),
    tone: z.string().optional().describe("Override tone: formal / casual / direct. Defaults to team brand voice."),
    focus: z.string().optional().describe("What to emphasize: attendance, digital, community, package deal, etc."),
  },
  async ({ prospect_file, tone, focus }) => {
    const prospectContent = readFile(repoPath("prospects", prospect_file));
    const teamContent = readFile(repoPath("team", "profile.md"));

    if (!prospectContent || !teamContent) {
      return { content: [{ type: "text", text: "Missing prospect or team profile file." }] };
    }

    const config = loadScoringConfig();
    const scoreResult = scoreProspect(prospectContent, teamContent, config);

    const prospectFields = parseMarkdownFields(prospectContent);
    const teamFields = parseMarkdownFields(teamContent);

    const prompt = `You are a sponsorship sales writer for a sports organization. Your job is to write a concise, specific, human-sounding first-touch outreach email to a potential sponsor.

TEAM PROFILE:
${teamContent}

PROSPECT DATA:
${prospectContent}

FIT SCORE: ${scoreResult.total}/100 — ${scoreResult.tier}
FIT REASONING:
- Category: ${scoreResult.explanations.category_relevance}
- Local Market: ${scoreResult.explanations.local_market_alignment}
- Audience: ${scoreResult.explanations.audience_channel_alignment}
- Sponsorship History: ${scoreResult.explanations.known_sponsorship_behavior}

TONE: ${tone || teamFields["tone"] || "Direct, locally rooted, not corporate"}
FOCUS AREA: ${focus || "Overall value proposition"}

INSTRUCTIONS:
- Write a subject line and email body
- Keep it under 150 words
- Reference something specific about their business (not generic)
- Lead with value to them, not a ask
- End with a low-friction CTA (quick call, reply with interest)
- Do NOT use clichéd phrases like "I hope this email finds you well"
- Sound like a real person, not a marketing department
- Reference local market connection if applicable

Format:
Subject: [subject line]

[email body]`;

    // Store the prompt as a generated asset draft
    const assetPath = repoPath("generated", `outreach-${slugify(prospectFields["company"] || prospect_file)}-${today()}.md`);
    const draftMeta = `# Outreach Draft — ${prospectFields["company"] || prospect_file}
Generated: ${new Date().toISOString()}
Prospect: ${prospect_file}
Fit Score: ${scoreResult.total}/100

---

*[Paste Claude's output below after generation]*

`;
    writeFile(assetPath, draftMeta);

    return {
      content: [{
        type: "text",
        text: `## Outreach Generation Context\n\nFit Score: **${scoreResult.total}/100 — ${scoreResult.tier}**\n\nHere is the grounded prompt for outreach generation. Claude will now use this to write the email:\n\n---\n\n${prompt}\n\n---\n\n*Draft will be saved to: generated/${path.basename(assetPath)}*`
      }]
    };
  }
);

// ── Tool: get_market_intelligence ────────────────────────────────────────────

server.tool(
  "get_market_intelligence",
  "Read the local market intelligence file — competitor teams, sponsor relationships, category landscape.",
  {},
  async () => {
    const content = readFile(repoPath("market", "intelligence.md"));
    if (!content) {
      return { content: [{ type: "text", text: "No market intelligence file found. Create one at market/intelligence.md." }] };
    }
    return { content: [{ type: "text", text: content }] };
  }
);

// ── Tool: update_prospect_stage ──────────────────────────────────────────────

server.tool(
  "update_prospect_stage",
  "Move a prospect to a new pipeline stage and log a note.",
  {
    prospect_file: z.string(),
    new_stage: z.enum(["New", "Qualified", "Contacted", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Won", "Lost"]),
    note: z.string().optional(),
    next_action: z.string().optional(),
    next_action_date: z.string().optional().describe("YYYY-MM-DD"),
  },
  async ({ prospect_file, new_stage, note, next_action, next_action_date }) => {
    const filePath = repoPath("prospects", prospect_file);
    let content = readFile(filePath);
    if (!content) {
      return { content: [{ type: "text", text: `Prospect file not found: ${prospect_file}` }] };
    }

    content = content
      .replace(/- \*\*Stage\*\*:.*/, `- **Stage**: ${new_stage}`)
      .replace(/- \*\*Last Contacted\*\*:.*/, `- **Last Contacted**: ${today()}`)
      .replace(/- \*\*Next Action\*\*:.*/, `- **Next Action**: ${next_action || ""}`)
      .replace(/- \*\*Next Action Date\*\*:.*/, `- **Next Action Date**: ${next_action_date || ""}`);

    if (note) {
      content += `\n\n## Activity Log\n- [${today()}] Stage → ${new_stage}: ${note}`;
    }

    writeFile(filePath, content);

    return {
      content: [{
        type: "text",
        text: `✅ ${prospect_file} → **${new_stage}**${note ? `\nNote: ${note}` : ""}${next_action ? `\nNext: ${next_action} (${next_action_date || "no date"})` : ""}`
      }]
    };
  }
);

// ── Tool: score_all_prospects ────────────────────────────────────────────────

server.tool(
  "score_all_prospects",
  "Score every prospect in the prospects/ folder and return a ranked list.",
  {},
  async () => {
    const files = listFiles(repoPath("prospects"));
    if (!files.length) {
      return { content: [{ type: "text", text: "No prospect files found." }] };
    }

    const teamContent = readFile(repoPath("team", "profile.md"));
    const config = loadScoringConfig();

    if (!teamContent || !config) {
      return { content: [{ type: "text", text: "Team profile or scoring config missing." }] };
    }

    const results = [];
    for (const file of files) {
      const content = readFile(file);
      if (!content) continue;
      const fields = parseMarkdownFields(content);
      const company = fields["company"] || path.basename(file, ".md");
      const score = scoreProspect(content, teamContent, config);
      results.push({ company, file: path.basename(file), score: score.total, tier: score.tier, gaps: score.gaps.length });
    }

    results.sort((a, b) => b.score - a.score);

    const rows = results.map(r =>
      `| ${r.company} | ${r.score}/100 | ${r.tier} | ${r.gaps > 0 ? `⚠️ ${r.gaps} gaps` : "✅ complete"} | ${r.file} |`
    );

    const output = `# Prospect Rankings\n\n| Company | Score | Tier | Data Quality | File |\n|---------|-------|------|--------------|------|\n${rows.join("\n")}`;

    return { content: [{ type: "text", text: output }] };
  }
);

// ── Shared outreach context builder ──────────────────────────────────────────

function buildOutreachContext(prospectContent, teamContent) {
  const config = loadScoringConfig();
  const scoreResult = scoreProspect(prospectContent, teamContent, config);
  const prospectFields = parseMarkdownFields(prospectContent);
  const teamFields = parseMarkdownFields(teamContent);
  return { scoreResult, prospectFields, teamFields };
}

function readExistingAssets(slug) {
  const dir = repoPath("generated");
  try {
    const files = fs.readdirSync(dir).filter(f => f.includes(slug));
    const assets = {};
    for (const f of files) {
      const content = readFile(path.join(dir, f));
      if (f.includes("email")) assets.email = content;
      if (f.includes("linkedin-connect")) assets.linkedinConnect = content;
      if (f.includes("linkedin-dm")) assets.linkedinDm = content;
      if (f.includes("followup")) assets.followup = content;
    }
    return assets;
  } catch { return {}; }
}

// ── Tool: generate_linkedin_connect ──────────────────────────────────────────

server.tool(
  "generate_linkedin_connect",
  "Generate a LinkedIn connection request note for a prospect. Max 300 characters — short, specific, no pitch.",
  {
    prospect_file: z.string().describe("Filename of the prospect, e.g. 'acme-auto.md'"),
    mutual_context: z.string().optional().describe("Any mutual connection, group, event, or shared context to reference"),
  },
  async ({ prospect_file, mutual_context }) => {
    const prospectContent = readFile(repoPath("prospects", prospect_file));
    const teamContent = readFile(repoPath("team", "profile.md"));
    if (!prospectContent || !teamContent) {
      return { content: [{ type: "text", text: "Missing prospect or team profile." }] };
    }

    const { scoreResult, prospectFields, teamFields } = buildOutreachContext(prospectContent, teamContent);
    const slug = slugify(prospectFields["company"] || prospect_file);

    const prompt = `You are writing a LinkedIn connection request note on behalf of a sports team's commercial lead.

STRICT RULES:
- Maximum 300 characters TOTAL (LinkedIn hard limit) — count carefully
- No sales pitch, no ask, no mention of sponsorship
- Sound like a real human, not a marketer
- Reference something specific — their business, location, or activity
- One sentence or two very short ones
- End with something that makes them curious or feel seen

TEAM: ${teamFields["name"] || "our team"} — ${teamFields["city_/_region"] || ""}
PROSPECT: ${prospectFields["company"] || ""} — ${prospectFields["industry_/_category"] || ""} in ${prospectFields["geography"] || ""}
NOTES: ${prospectFields["capture_notes"] || prospectFields["audience_alignment_notes"] || ""}
${mutual_context ? `MUTUAL CONTEXT: ${mutual_context}` : ""}
FIT REASONING: ${scoreResult.explanations.local_market_alignment} · ${scoreResult.explanations.category_relevance}

Write only the connection note text. No subject line, no labels, no explanation. Just the note.`;

    const assetPath = repoPath("generated", `linkedin-connect-${slug}-${today()}.md`);
    writeFile(assetPath, `# LinkedIn Connection Request — ${prospectFields["company"] || prospect_file}
Generated: ${new Date().toISOString()}
Prospect: ${prospect_file}
Fit Score: ${scoreResult.total}/100
Character limit: 300

---

*[Claude output below — approve before sending]*

PROMPT USED:
${prompt}
`);

    return {
      content: [{
        type: "text",
        text: `## LinkedIn Connection Request — ${prospectFields["company"] || prospect_file}
Fit Score: **${scoreResult.total}/100 — ${scoreResult.tier}**
⚠️ Hard limit: **300 characters**

---

${prompt}

---
*Saved to: generated/linkedin-connect-${slug}-${today()}.md*
*After Claude generates the note, paste the approved version into that file.*`
      }]
    };
  }
);

// ── Tool: generate_linkedin_dm ────────────────────────────────────────────────

server.tool(
  "generate_linkedin_dm",
  "Generate a LinkedIn DM to send after connecting. Warmer than cold email, shorter than full pitch. Should reference the connection and move toward a real conversation.",
  {
    prospect_file: z.string().describe("Filename of the prospect, e.g. 'acme-auto.md'"),
    connection_note: z.string().optional().describe("What you said in your connection request, so the DM feels continuous"),
    focus: z.string().optional().describe("What angle to lead with: local tie, audience match, category opportunity, etc."),
  },
  async ({ prospect_file, connection_note, focus }) => {
    const prospectContent = readFile(repoPath("prospects", prospect_file));
    const teamContent = readFile(repoPath("team", "profile.md"));
    if (!prospectContent || !teamContent) {
      return { content: [{ type: "text", text: "Missing prospect or team profile." }] };
    }

    const { scoreResult, prospectFields, teamFields } = buildOutreachContext(prospectContent, teamContent);
    const slug = slugify(prospectFields["company"] || prospect_file);

    const prompt = `You are writing a LinkedIn DM on behalf of a sports team's commercial lead, sent shortly after connecting.

RULES:
- 3–5 sentences maximum. Under 400 characters preferred.
- Warmer and more conversational than a cold email
- Light mention of partnership potential — don't pitch hard, plant a seed
- Reference the connection context if provided
- End with a soft, low-friction question or CTA — not "would you be interested?" — something more specific and easy to respond to
- Sound like a real person, not a template

TEAM: ${teamFields["name"] || "our team"} (${teamFields["sport"] || ""}, ${teamFields["city_/_region"] || ""})
AUDIENCE: ${teamFields["audience_identity"] || ""}
TONE: ${teamFields["tone"] || "direct, locally rooted"}

PROSPECT: ${prospectFields["company"] || ""}
INDUSTRY: ${prospectFields["industry_/_category"] || ""}
GEOGRAPHY: ${prospectFields["geography"] || ""}
AUDIENCE ALIGNMENT: ${prospectFields["audience_alignment_notes"] || ""}
KNOWN SPONSOR HISTORY: ${prospectFields["known_sponsor_of_other_teams"] || "Unknown"}
${connection_note ? `\nWHAT I SAID IN CONNECTION REQUEST: "${connection_note}"` : ""}
${focus ? `\nFOCUS ANGLE: ${focus}` : ""}

FIT SCORE: ${scoreResult.total}/100
LOCAL MARKET: ${scoreResult.explanations.local_market_alignment}
CATEGORY: ${scoreResult.explanations.category_relevance}

Write only the DM body. No labels, no subject. Just the message.`;

    const assetPath = repoPath("generated", `linkedin-dm-${slug}-${today()}.md`);
    writeFile(assetPath, `# LinkedIn DM — ${prospectFields["company"] || prospect_file}
Generated: ${new Date().toISOString()}
Prospect: ${prospect_file}
Fit Score: ${scoreResult.total}/100

---

*[Claude output below — approve before sending]*

PROMPT USED:
${prompt}
`);

    return {
      content: [{
        type: "text",
        text: `## LinkedIn DM — ${prospectFields["company"] || prospect_file}
Fit Score: **${scoreResult.total}/100 — ${scoreResult.tier}**

---

${prompt}

---
*Saved to: generated/linkedin-dm-${slug}-${today()}.md*`
      }]
    };
  }
);

// ── Tool: generate_followup_sequence ─────────────────────────────────────────

server.tool(
  "generate_followup_sequence",
  "Generate a 3-step follow-up email sequence for a prospect. Each step aware of the previous, escalating in specificity and urgency without being pushy.",
  {
    prospect_file: z.string().describe("Filename of the prospect, e.g. 'acme-auto.md'"),
    first_touch_summary: z.string().optional().describe("What the first-touch email said, so follow-ups don't repeat it"),
    channel: z.enum(["email", "linkedin"]).default("email").describe("Whether follow-ups are email or LinkedIn DMs"),
    cadence: z.string().optional().describe("Timing between steps, e.g. '3 days, 7 days, 14 days'. Defaults to 4/7/14."),
  },
  async ({ prospect_file, first_touch_summary, channel, cadence }) => {
    const prospectContent = readFile(repoPath("prospects", prospect_file));
    const teamContent = readFile(repoPath("team", "profile.md"));
    if (!prospectContent || !teamContent) {
      return { content: [{ type: "text", text: "Missing prospect or team profile." }] };
    }

    const { scoreResult, prospectFields, teamFields } = buildOutreachContext(prospectContent, teamContent);
    const slug = slugify(prospectFields["company"] || prospect_file);
    const timing = cadence || "4 days, 7 days, 14 days";

    const prompt = `You are writing a 3-step follow-up sequence for a sports sponsorship outreach campaign. Each step should feel different from the others — vary the angle, length, and emotional tone.

TEAM: ${teamFields["name"] || "our team"} (${teamFields["sport"] || ""}, ${teamFields["city_/_region"] || ""})
TEAM AUDIENCE: ${teamFields["audience_identity"] || ""}
TEAM TONE: ${teamFields["tone"] || "direct, locally rooted"}
TEAM INVENTORY SIGNALS: ${teamFields["sponsorship_inventory"] || "signage, social, events"}

PROSPECT: ${prospectFields["company"] || ""}
INDUSTRY: ${prospectFields["industry_/_category"] || ""}
AUDIENCE ALIGNMENT: ${prospectFields["audience_alignment_notes"] || ""}
BUDGET SIGNAL: ${prospectFields["budget_signal"] || "unknown"}
CHANNEL: ${channel}
CADENCE: Send at ${timing} after first touch

${first_touch_summary ? `FIRST-TOUCH SUMMARY (do not repeat this content):\n"${first_touch_summary}"\n` : ""}

FIT SCORE: ${scoreResult.total}/100
REASONING: ${Object.values(scoreResult.explanations).join(" · ")}

STEP STRUCTURE:
- Step 1 (${timing.split(",")[0].trim()} after first touch): Short, specific value add. Add one new piece of information or proof point they didn't have. Under 80 words.
- Step 2 (${timing.split(",")[1]?.trim() || "7 days"} after first touch): Shift the frame — try a different angle entirely (season timing, comparable partner, local market data). Under 100 words.
- Step 3 (${timing.split(",")[2]?.trim() || "14 days"} after first touch): Honest breakup / last touch. Brief, respectful, leaves door open. Under 60 words.

${channel === "email" ? "Include subject lines for each step. Make subjects feel personal, not marketing." : "No subject lines — these are LinkedIn DMs. Keep each under 300 characters."}

RULES:
- Never use "I hope this finds you well" or similar openers
- Each step should feel like it was written by a different version of the sender — vary the voice slightly
- Step 3 must not be passive-aggressive — genuine, human close

Format each step clearly:
STEP 1 — [timing]
${channel === "email" ? "Subject: ...\n" : ""}[body]

STEP 2 — [timing]
${channel === "email" ? "Subject: ...\n" : ""}[body]

STEP 3 — [timing]
${channel === "email" ? "Subject: ...\n" : ""}[body]`;

    const assetPath = repoPath("generated", `followup-${slug}-${today()}.md`);
    writeFile(assetPath, `# Follow-up Sequence — ${prospectFields["company"] || prospect_file}
Generated: ${new Date().toISOString()}
Prospect: ${prospect_file}
Channel: ${channel}
Cadence: ${timing}
Fit Score: ${scoreResult.total}/100

---

*[Claude output below — approve each step before sending]*

PROMPT USED:
${prompt}
`);

    return {
      content: [{
        type: "text",
        text: `## Follow-up Sequence — ${prospectFields["company"] || prospect_file}
Channel: **${channel}** · Cadence: **${timing}**
Fit Score: **${scoreResult.total}/100 — ${scoreResult.tier}**

---

${prompt}

---
*Saved to: generated/followup-${slug}-${today()}.md*`
      }]
    };
  }
);

// ── Tool: generate_minideck ───────────────────────────────────────────────────

server.tool(
  "generate_minideck",
  "Generate a one-page sponsor mini-deck as a self-contained HTML file. Designed to be printed or shared as a PDF leave-behind.",
  {
    prospect_file: z.string().describe("Filename of the prospect, e.g. 'acme-auto.md'"),
    package_name: z.string().optional().describe("Name of the package to feature, e.g. 'Community Partner' or 'Digital Starter'"),
    package_value: z.string().optional().describe("Package price or value range, e.g. '$2,500/season'"),
    package_assets: z.string().optional().describe("Comma-separated list of assets in the package, e.g. 'jersey sleeve, 4 social posts/month, email banner'"),
    highlight_stat: z.string().optional().describe("One standout audience number to hero, e.g. '8,500 season attendees'"),
  },
  async ({ prospect_file, package_name, package_value, package_assets, highlight_stat }) => {
    const prospectContent = readFile(repoPath("prospects", prospect_file));
    const teamContent = readFile(repoPath("team", "profile.md"));
    if (!prospectContent || !teamContent) {
      return { content: [{ type: "text", text: "Missing prospect or team profile." }] };
    }

    const { scoreResult, prospectFields, teamFields } = buildOutreachContext(prospectContent, teamContent);
    const slug = slugify(prospectFields["company"] || prospect_file);

    const teamName = teamFields["name"] || "Our Team";
    const teamCity = teamFields["city_/_region"] || "";
    const teamSport = teamFields["sport"] || "";
    const sponsorName = prospectFields["company"] || "Your Company";
    const audienceDesc = teamFields["audience_identity"] || "passionate local fans";
    const tone = teamFields["tone"] || "direct, community-focused";
    const heroStat = highlight_stat || teamFields["in-person_attendance"] || "thousands of fans";
    const pkgName = package_name || "Season Partner";
    const pkgValue = package_value || "Custom pricing";
    const pkgAssets = package_assets || "signage, social posts, event activations";
    const fitReasoning = `${scoreResult.explanations.category_relevance}. ${scoreResult.explanations.local_market_alignment}.`;
    const audienceAlignment = prospectFields["audience_alignment_notes"] || `${sponsorName}'s customers align with our fan base.`;

    // Build the HTML mini-deck directly
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${teamName} × ${sponsorName} — Partnership Overview</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,600;1,300&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --ink: #0f0f0f;
    --paper: #f5f1eb;
    --accent: #c8371a;
    --rule: #d4cfc8;
    --muted: #6b6560;
    --light: #e8e3db;
  }

  html, body {
    width: 210mm;
    min-height: 297mm;
    background: var(--paper);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 16mm 12mm;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 0;
  }

  /* ── Header ── */
  .header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    padding-bottom: 8mm;
    border-bottom: 2px solid var(--ink);
    margin-bottom: 8mm;
  }

  .team-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 38pt;
    letter-spacing: 0.04em;
    line-height: 0.9;
    color: var(--ink);
  }

  .team-meta {
    font-size: 9pt;
    color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 3mm;
  }

  .prepared-for {
    text-align: right;
  }

  .prepared-label {
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 1mm;
  }

  .sponsor-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22pt;
    color: var(--accent);
    letter-spacing: 0.03em;
  }

  /* ── Body grid ── */
  .body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
    gap: 6mm;
  }

  /* ── Hero stat ── */
  .hero {
    grid-column: 1 / -1;
    background: var(--ink);
    color: var(--paper);
    padding: 7mm 10mm;
    display: flex;
    align-items: center;
    gap: 8mm;
  }

  .hero-number {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 52pt;
    letter-spacing: 0.02em;
    line-height: 1;
    color: #fff;
    white-space: nowrap;
  }

  .hero-label {
    font-size: 10pt;
    color: rgba(245,241,235,0.7);
    line-height: 1.4;
    max-width: 80mm;
  }

  .hero-label strong {
    display: block;
    color: #fff;
    font-size: 12pt;
    font-weight: 600;
    margin-bottom: 1mm;
  }

  /* ── Cards ── */
  .card {
    background: var(--light);
    padding: 5mm 6mm;
  }

  .card-label {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 2mm;
  }

  .card-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 17pt;
    letter-spacing: 0.03em;
    margin-bottom: 2mm;
    line-height: 1;
  }

  .card p {
    font-size: 9.5pt;
    color: var(--muted);
    line-height: 1.5;
  }

  /* ── Package block ── */
  .package {
    grid-column: 1 / -1;
    border: 1.5px solid var(--ink);
    padding: 5mm 6mm;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 6mm;
    align-items: start;
  }

  .package-badge {
    background: var(--accent);
    color: #fff;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 13pt;
    padding: 2mm 4mm;
    letter-spacing: 0.05em;
    white-space: nowrap;
    align-self: center;
  }

  .package-assets {
    font-size: 9pt;
    color: var(--ink);
    line-height: 1.7;
  }

  .package-assets ul {
    list-style: none;
    padding: 0;
  }

  .package-assets li::before {
    content: "→ ";
    color: var(--accent);
    font-weight: 600;
  }

  .package-value {
    text-align: right;
    white-space: nowrap;
  }

  .package-value-label {
    font-size: 7.5pt;
    color: var(--muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .package-value-amount {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22pt;
    color: var(--ink);
    letter-spacing: 0.02em;
  }

  /* ── Audience stats row ── */
  .stats {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 3mm;
  }

  .stat {
    text-align: center;
    padding: 3mm 2mm;
    border-top: 2px solid var(--rule);
  }

  .stat-number {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 20pt;
    color: var(--ink);
    line-height: 1;
  }

  .stat-label {
    font-size: 7.5pt;
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 1mm;
  }

  /* ── Footer ── */
  .footer {
    border-top: 1px solid var(--rule);
    padding-top: 4mm;
    margin-top: 4mm;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
  }

  .footer-cta {
    font-size: 9pt;
    color: var(--muted);
  }

  .footer-cta strong {
    display: block;
    font-size: 11pt;
    color: var(--ink);
    margin-bottom: 0.5mm;
  }

  .footer-logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 14pt;
    letter-spacing: 0.1em;
    color: var(--rule);
    text-align: right;
  }

  @media print {
    html, body { background: var(--paper); }
    .page { min-height: 297mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div>
      <div class="team-name">${teamName}</div>
      <div class="team-meta">${teamSport} · ${teamCity}</div>
    </div>
    <div class="prepared-for">
      <div class="prepared-label">Prepared for</div>
      <div class="sponsor-name">${sponsorName}</div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Hero stat -->
    <div class="hero">
      <div class="hero-number">${heroStat}</div>
      <div class="hero-label">
        <strong>Fans who look like your customers.</strong>
        ${audienceAlignment}
      </div>
    </div>

    <!-- Why us card -->
    <div class="card">
      <div class="card-label">Why this works</div>
      <div class="card-title">Local reach,<br>real connection.</div>
      <p>${fitReasoning} Our fans are ${audienceDesc} — the same people you're trying to reach.</p>
    </div>

    <!-- Why now card -->
    <div class="card">
      <div class="card-label">The opportunity</div>
      <div class="card-title">Category still<br>open.</div>
      <p>We don't have a ${prospectFields["industry_/_category"] || "category"} partner yet. That means first-mover positioning, exclusivity, and a clean association with the team.</p>
    </div>

    <!-- Audience stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-number">${teamFields["in-person_attendance"]?.split("/")[0]?.trim() || "—"}</div>
        <div class="stat-label">Avg Attendance</div>
      </div>
      <div class="stat">
        <div class="stat-number">${teamFields["instagram"] || "—"}</div>
        <div class="stat-label">Instagram</div>
      </div>
      <div class="stat">
        <div class="stat-number">${teamFields["email_list"] || "—"}</div>
        <div class="stat-label">Email List</div>
      </div>
      <div class="stat">
        <div class="stat-number">${teamFields["tiktok"] || teamFields["twitter/x"] || "—"}</div>
        <div class="stat-label">TikTok / Social</div>
      </div>
    </div>

    <!-- Package -->
    <div class="package">
      <div class="package-badge">${pkgName}</div>
      <div class="package-assets">
        <ul>
          ${pkgAssets.split(",").map(a => `<li>${a.trim()}</li>`).join("\n          ")}
        </ul>
      </div>
      <div class="package-value">
        <div class="package-value-label">Starting at</div>
        <div class="package-value-amount">${pkgValue}</div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-cta">
      <strong>Let's talk.</strong>
      Ready to put your brand in front of ${teamCity.split(",")[0] || "local"} fans this season? Reply to this or reach out directly.
    </div>
    <div class="footer-logo">FORGE</div>
  </div>

</div>
</body>
</html>`;

    const deckPath = repoPath("generated", `minideck-${slug}-${today()}.html`);
    writeFile(deckPath, html);

    return {
      content: [{
        type: "text",
        text: `## Mini-Deck Generated ✅
**${teamName} × ${sponsorName}**
Package: ${pkgName} · ${pkgValue}
Fit Score: ${scoreResult.total}/100 — ${scoreResult.tier}

Saved to: \`generated/minideck-${slug}-${today()}.html\`

**To use:**
- Open in Chrome and print → Save as PDF
- Attach to outreach email or share as a link
- Edit the HTML to swap in real numbers or adjust copy

**Fields populated from team profile:**
${heroStat !== highlight_stat ? `- Hero stat pulled from attendance data` : `- Hero stat: ${heroStat}`}
- Audience stats: attendance, Instagram, email list, TikTok
- Category exclusivity angle auto-generated

**Fields you may want to manually update:**
- Team logo (add an \`<img>\` to the header)
- Season dates / specific game schedule
- Real package pricing if not provided`
      }]
    };
  }
);

// ── Tool: list_generated_assets ───────────────────────────────────────────────

server.tool(
  "list_generated_assets",
  "List all generated outreach assets for a prospect or across all prospects.",
  {
    prospect_file: z.string().optional().describe("Filter to a specific prospect slug, e.g. 'acme-auto'"),
  },
  async ({ prospect_file }) => {
    const dir = repoPath("generated");
    try {
      let files = fs.readdirSync(dir).filter(f => !f.startsWith("."));
      if (prospect_file) {
        const slug = prospect_file.replace(".md", "");
        files = files.filter(f => f.includes(slug));
      }
      if (!files.length) {
        return { content: [{ type: "text", text: "No generated assets found." }] };
      }

      const rows = files.map(f => {
        const type = f.startsWith("email") ? "📧 Email"
          : f.startsWith("linkedin-connect") ? "🔗 LI Connect"
          : f.startsWith("linkedin-dm") ? "💬 LI DM"
          : f.startsWith("followup") ? "📬 Follow-up Seq"
          : f.startsWith("minideck") ? "🎴 Mini-Deck"
          : "📄 Asset";
        const date = f.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "—";
        return `| ${type} | ${f} | ${date} |`;
      });

      return {
        content: [{
          type: "text",
          text: `# Generated Assets\n\n| Type | File | Date |\n|------|------|------|\n${rows.join("\n")}`
        }]
      };
    } catch {
      return { content: [{ type: "text", text: "No generated assets directory found." }] };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
