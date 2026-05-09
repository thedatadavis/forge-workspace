#!/usr/bin/env node

// FORGE Local Companion
// Receives prospect markdown from the Chrome extension and writes it to disk.
//
// Usage:
//   node forge-companion.js
//
// Config (first run will prompt, then saves to ~/.forge-companion.json):
//   FORGE_WORKSPACE  — absolute path to your forge-workspace folder

import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

const PORT = 7432; // FORG on a phone keypad
const CONFIG_PATH = path.join(os.homedir(), ".forge-companion.json");

// ── Config ────────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function getConfig() {
  let config = loadConfig();
  if (config?.workspacePath && fs.existsSync(config.workspacePath)) {
    return config;
  }

  console.log("\n🔧 FORGE Companion — First-time setup\n");

  let workspacePath = "";
  while (!workspacePath) {
    const input = await prompt("Path to your forge-workspace folder: ");
    const expanded = input.replace(/^~/, os.homedir());
    if (fs.existsSync(expanded)) {
      workspacePath = expanded;
    } else {
      console.log(`  ✗ Not found: ${expanded}`);
      const create = await prompt("  Create it? (y/n): ");
      if (create.toLowerCase() === "y") {
        fs.mkdirSync(expanded, { recursive: true });
        fs.mkdirSync(path.join(expanded, "prospects"), { recursive: true });
        workspacePath = expanded;
        console.log(`  ✓ Created ${expanded}`);
      }
    }
  }

  config = { workspacePath };
  saveConfig(config);
  console.log(`\n✓ Config saved to ${CONFIG_PATH}\n`);
  return config;
}

// ── Request handler ───────────────────────────────────────────────────────────

function handleRequest(req, res, workspacePath) {
  // CORS — allow the extension origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, workspace: workspacePath }));
    return;
  }

  if (req.method === "POST" && req.url === "/prospect") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const { filename, content } = JSON.parse(body);

        if (!filename || !content) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing filename or content" }));
          return;
        }

        // Safety: only allow .md files, no path traversal
        const safeName = path.basename(filename).replace(/[^a-z0-9\-_.]/gi, "-");
        if (!safeName.endsWith(".md")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Only .md files allowed" }));
          return;
        }

        const prospectsDir = path.join(workspacePath, "prospects");
        fs.mkdirSync(prospectsDir, { recursive: true });

        const filePath = path.join(prospectsDir, safeName);
        const existed = fs.existsSync(filePath);

        if (existed) {
          // Don't overwrite — return conflict so extension can warn
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "File already exists", filename: safeName }));
          return;
        }

        fs.writeFileSync(filePath, content, "utf8");

        const timestamp = new Date().toLocaleTimeString();
        console.log(`  ✓ [${timestamp}] Saved: prospects/${safeName}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, path: filePath, filename: safeName }));

      } catch (err) {
        console.error("  ✗ Error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
}

// ── Start ─────────────────────────────────────────────────────────────────────

const config = await getConfig();
const { workspacePath } = config;

const server = http.createServer((req, res) => handleRequest(req, res, workspacePath));

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n✦ FORGE Companion running`);
  console.log(`  Workspace: ${workspacePath}`);
  console.log(`  Listening: http://localhost:${PORT}`);
  console.log(`\n  Waiting for prospects from the Chrome extension...`);
  console.log(`  (Ctrl+C to stop)\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n✗ Port ${PORT} already in use — is the companion already running?\n`);
  } else {
    console.error("\n✗ Server error:", err.message);
  }
  process.exit(1);
});
