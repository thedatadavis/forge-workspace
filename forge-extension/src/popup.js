// FORGE Prospect Capture — popup.js

const $ = (id) => document.getElementById(id);

function today() {
  return new Date().toISOString().split("T")[0];
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function val(id) {
  return $(id)?.value?.trim() || "";
}

function setVal(id, value) {
  if ($(id) && value) $(id).value = value;
}

// ── Markdown generator ────────────────────────────────────────────────────────

function generateMarkdown() {
  const company = val("company");
  const contactName = val("contactName");
  const displayName = company || contactName || "Unknown Prospect";
  const source = extractedData?.source || (currentUrl.includes("linkedin.com") ? "LinkedIn (Chrome Extension)" : "Web Capture (Chrome Extension)");
  
  return `# Prospect: ${displayName}

## Basic Info
- **Company**: ${company}
- **Website**: ${val("website")}
- **Industry / Category**: ${val("industry")}
- **Geography**: ${val("geography")}
- **Company Size**: ${val("size")}
- **Contact Name**: ${contactName}
- **Contact Title**: ${val("contactTitle")}
- **Contact Email**: ${val("contactEmail")}
- **LinkedIn URL**: ${extractedData?.linkedin_url || currentUrl || ""}
- **Source**: ${source}

## Fit Signals
- **Local Market Presence**: ${val("localPresence")}
- **Known Sponsor of Other Teams**: ${val("knownSponsor")}
- **Category Active in Local Sports**: ${val("activeInSports")}
- **Audience Alignment Notes**: ${val("audienceAlignment")}
- **Budget Signal**: ${val("budgetSignal")}

## Outreach Status
- **Stage**: New
- **Last Contacted**: 
- **Next Action**: Score & qualify
- **Next Action Date**: 
- **Owner**: 

## Score
- **Fit Score**: 
- **Score Breakdown**: 
- **Scored At**: 

## Activity Log
- ${today()} Captured from ${source}
${val("notes") ? `\n### Capture Notes\n${val("notes")}` : ""}
`;
}

// ── Companion API ─────────────────────────────────────────────────────────────

const DEFAULT_COMPANION_URL = "http://localhost:7432";

async function getCompanionUrl() {
  const { companionUrl } = await chrome.storage.local.get("companionUrl");
  return companionUrl || DEFAULT_COMPANION_URL;
}

async function companionPing(url) {
  try {
    const res = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch { return false; }
}

async function saveToCompanion(url, filename, content) {
  const res = await fetch(`${url}/prospect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content }),
    signal: AbortSignal.timeout(4000),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || "Unknown error"), { status: res.status });
  return data;
}

// ── State ─────────────────────────────────────────────────────────────────────

let currentUrl = "";
let extractedData = null;
let companionAlive = false;

// ── Page type detection ───────────────────────────────────────────────────────

function detectPageType(url) {
  if (url.includes("linkedin.com/company/")) return "linkedin-company";
  if (url.includes("linkedin.com/in/")) return "linkedin-person";
  return "web";
}

function updatePageBadge(url) {
  const type = detectPageType(url);
  const badge = $("pageBadge");
  $("pageUrl").textContent = url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 45);
  if (type.startsWith("linkedin")) {
    badge.textContent = type === "linkedin-company" ? "LinkedIn Company" : "LinkedIn Person";
    badge.className = "badge badge-linkedin";
  } else {
    badge.textContent = "Web Page";
    badge.className = "badge badge-web";
  }
  return type;
}

// ── Companion indicator ───────────────────────────────────────────────────────

function updateCompanionIndicator(alive) {
  companionAlive = alive;
  const indicator = $("companionIndicator");
  const btn = $("captureBtn");
  if (alive) {
    indicator.textContent = "● companion connected";
    indicator.className = "companion-indicator connected";
    btn.textContent = "Save to Workspace";
  } else {
    indicator.textContent = "○ companion offline — will copy to clipboard";
    indicator.className = "companion-indicator offline";
    btn.textContent = "Copy to Clipboard";
  }
}

// ── Auto-extract on LinkedIn ──────────────────────────────────────────────────

async function extractFromLinkedIn(tabId) {
  try {
    // Try sending a message to the content script first (it has the most robust logic)
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: "extract" });
      if (response?.success && response.data) {
        handleExtractionSuccess(response.data);
        return;
      }
    } catch (msgErr) {
      // Content script might not be ready, fall back to injection
      console.log("Content script not ready, falling back to injection");
    }

    // Fallback: Inject a robust extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const getCleanText = (el) => el ? el.innerText.trim().replace(/\s+/g, ' ') : "";
        const getSectionByHeading = (headingText) => {
          return Array.from(document.querySelectorAll('section')).find(s => {
            const h = s.querySelector('h2, h3');
            return h && h.innerText.includes(headingText);
          });
        };

        const isCompany = window.location.href.includes("/company/");
        
        if (isCompany) {
          const name = getCleanText(document.querySelector('h1')) || getCleanText(document.querySelector('.org-top-card-summary__title'));
          const infoItems = Array.from(document.querySelectorAll('.org-top-card-summary-info-list__info-item, .org-top-card-summary__info-item')).map(getCleanText);
          const website = document.querySelector("a[data-field='website'], a[href*='website']")?.href || "";
          
          return {
            type: "company",
            company: name,
            website,
            industry: infoItems.find(i => i && !i.includes('employees') && !i.includes(',')) || "",
            geography: infoItems.find(i => i.includes(',')) || "",
            size: infoItems.find(i => i.includes('employees')) || "",
            description: getCleanText(getSectionByHeading('About')?.querySelector('p')) || getCleanText(document.querySelector('.org-top-card-summary__tagline')),
            linkedin_url: window.location.href.split("?")[0],
          };
        } else {
          const topCard = document.querySelector('section[componentkey*="Topcard"]') || document.querySelector('main section') || document.querySelector('.pv-top-card');
          const name = getCleanText(topCard?.querySelector('h1, h2')) || document.title.split(' | ')[0];
          const paragraphs = Array.from(topCard?.querySelectorAll('p, div') || []).map(getCleanText).filter(t => t.length > 2 && t !== name);
          
          const headline = paragraphs.find(p => !p.includes(',') && p.length > 10) || paragraphs[0] || "";
          const geo = paragraphs.find(p => p.includes(',') && p.split(',').length >= 2) || "";
          const company = getCleanText(topCard?.querySelector('a[href*="/company/"]'));

          const about = getCleanText(getSectionByHeading('About')?.querySelector('.break-words, p'));
          const exp = Array.from(getSectionByHeading('Experience')?.querySelectorAll('li') || []).slice(0, 3).map(getCleanText).join('\n- ');

          return {
            type: "person",
            contact_name: name,
            contact_title: headline,
            geography: geo,
            company: company,
            description: [about, exp ? "\nRecent Experience:\n- " + exp : ""].filter(Boolean).join('\n'),
            linkedin_url: window.location.href.split("?")[0],
          };
        }
      }
    });

    if (results?.[0]?.result) {
      handleExtractionSuccess(results[0].result);
    } else {
      showResult("error", "Failed to extract LinkedIn data. Try clicking 'Re-extract'.");
    }
  } catch (err) {
    console.error("Extraction error:", err);
    if (!err.message.includes("Could not establish connection")) {
      showResult("error", `Extraction error: ${err.message}`);
    }
  }
}

function handleExtractionSuccess(data) {
  extractedData = data;
  populateForm(data);
  $("autoBanner").classList.add("visible");
  $("statusDot").classList.add("active");
  showResult("success", "✦ Data extracted from LinkedIn");
  setTimeout(() => { if ($("resultBox").classList.contains("success")) $("resultBox").style.display = "none"; }, 3000);
}

function populateForm(data) {
  if (data.company)       setVal("company", data.company);
  if (data.website)       setVal("website", data.website);
  if (data.industry)      setVal("industry", data.industry);
  if (data.geography)     setVal("geography", data.geography);
  if (data.size)          setVal("size", data.size);
  if (data.contact_name)  setVal("contactName", data.contact_name);
  if (data.contact_title) setVal("contactTitle", data.contact_title);
  if (data.description) {
    const current = val("notes");
    setVal("notes", current ? `${current}\n\n${data.description}` : data.description);
  }
}

// ── Result display ────────────────────────────────────────────────────────────

function showResult(type, message) {
  const box = $("resultBox");
  box.className = `result ${type}`;
  box.textContent = message;
}

function showMarkdown(md) {
  $("markdownPre").textContent = md;
  $("markdownOutput").classList.add("visible");
}

// ── Capture ───────────────────────────────────────────────────────────────────

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentUrl = tab.url || "";
  const pageType = updatePageBadge(currentUrl);

  const companionUrl = await getCompanionUrl();
  const alive = await companionPing(companionUrl);
  updateCompanionIndicator(alive);

  if (!pageType.startsWith("linkedin") && currentUrl.startsWith("http")) {
    try { setVal("website", new URL(currentUrl).origin); } catch {}
  }
  if (pageType.startsWith("linkedin")) await extractFromLinkedIn(tab.id);

  // ── Event Listeners ───────────────────────────────────────────────────────────
  
  $("captureBtn")?.addEventListener("click", async () => {
    const company = val("company");
    const contactName = val("contactName");
    
    if (!company && !contactName) { 
      showResult("error", "At least a Company Name or Contact Name is required."); 
      return; 
    }

    const md = generateMarkdown();
    if (!md) { showResult("error", "Could not generate markdown."); return; }

    const displayName = company || contactName;
    const filename = `${slugify(displayName)}.md`;
    $("captureBtn").disabled = true;

    chrome.storage.local.get("captured", (data) => {
      const list = data.captured || [];
      list.unshift({ company: displayName, filename, url: currentUrl, date: today() });
      chrome.storage.local.set({ captured: list.slice(0, 20) });
    });

    if (companionAlive) {
      try {
        const url = await getCompanionUrl();
        const result = await saveToCompanion(url, filename, md);
        showResult("success",
          `✓ Saved to workspace!\n\nprospects/${result.filename}\n\nTell Claude: "score ${result.filename}"`
        );
      } catch (err) {
        if (err.status === 409) {
          showResult("error", `prospects/${filename} already exists.\n\nOpen it to update, or rename this prospect.`);
        } else {
          showResult("error", `Companion error: ${err.message}\n\nFalling back to clipboard.`);
          await navigator.clipboard.writeText(md).catch(() => {});
          showMarkdown(md);
        }
      }
    } else {
      try { await navigator.clipboard.writeText(md); } catch {}
      showResult("success", `✓ Copied!\n\nPaste into: prospects/${filename}\n\nStart the companion for direct saves.`);
      showMarkdown(md);
    }

    $("captureBtn").disabled = false;
  });

  $("extractBtn")?.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await extractFromLinkedIn(tab.id);
  });

  $("copyBtn")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("markdownPre").textContent).then(() => {
      $("copyBtn").textContent = "Copied!";
      setTimeout(() => { $("copyBtn").textContent = "Copy"; }, 1500);
    });
  });

  $("settingsLink")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
});
