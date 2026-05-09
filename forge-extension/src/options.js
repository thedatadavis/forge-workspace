// FORGE Settings — options.js

const DEFAULT_URL = "http://localhost:7432";

const $ = (id) => document.getElementById(id);

async function testConnection(url) {
  try {
    const res = await fetch(`${url}/ping`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, workspace: data.workspace };
    }
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: err.message.includes("Failed to fetch")
        ? "Not running"
        : err.message,
    };
  }
}

function setStatus(state, message) {
  const dot = $("statusDot");
  const text = $("statusText");
  dot.className =
    "status-dot" +
    (state === "connected" ? " connected" : state === "error" ? " error" : "");
  text.textContent = message;
}

async function checkAndDisplay() {
  const { companionUrl } = await chrome.storage.local.get("companionUrl");
  const url = companionUrl || DEFAULT_URL;
  $("companionUrl").value = url;

  setStatus("checking", "Checking companion...");
  const result = await testConnection(url);
  if (result.ok) {
    setStatus("connected", `Connected — workspace: ${result.workspace}`);
  } else {
    setStatus(
      "error",
      `Not reachable — ${result.error}. Run forge-companion.js to start it.`,
    );
  }
}

$("saveBtn").addEventListener("click", async () => {
  const url = $("companionUrl").value.trim() || DEFAULT_URL;
  await chrome.storage.local.set({ companionUrl: url });

  const result = await testConnection(url);
  if (result.ok) {
    setStatus("connected", `Connected — workspace: ${result.workspace}`);
    $("savedNotice").classList.add("visible");
    setTimeout(() => $("savedNotice").classList.remove("visible"), 2000);
  } else {
    setStatus("error", `Saved, but companion not reachable — ${result.error}`);
  }
});

$("testBtn").addEventListener("click", async () => {
  const url = $("companionUrl").value.trim() || DEFAULT_URL;
  setStatus("checking", "Testing...");
  const result = await testConnection(url);
  if (result.ok) {
    setStatus("connected", `Connected — workspace: ${result.workspace}`);
  } else {
    setStatus("error", `${result.error} — is forge-companion.js running?`);
  }
});

checkAndDisplay();
