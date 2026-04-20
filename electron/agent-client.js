const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const AGENT_URL = "http://127.0.0.1:47071";
const AGENT_START_TIMEOUT_MS = 15000;
let agentProcess = null;

async function ensureNativeAgent() {
  if (await isAgentHealthy()) {
    return;
  }

  if (!agentProcess || agentProcess.killed) {
    agentProcess = startNativeAgentProcess();
  }

  await waitForAgent();
}

async function sendAgentCommand(endpoint, payload) {
  await ensureNativeAgent();

  const response = await fetch(`${AGENT_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload ?? {})
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Agent request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function fetchAgentState(endpoint) {
  await ensureNativeAgent();

  const response = await fetch(`${AGENT_URL}${endpoint}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Agent request failed (${response.status}): ${body}`);
  }

  return response.json();
}

function stopNativeAgent() {
  if (!agentProcess || agentProcess.killed) {
    return;
  }

  agentProcess.kill();
  agentProcess = null;
}

function startNativeAgentProcess() {
  const executablePath = resolveAgentExecutablePath();

  if (!fs.existsSync(executablePath)) {
    throw new Error(`ScreenAppAgent.exe lipseste: ${executablePath}. Ruleaza agent publish inainte de build.`);
  }

  const child = spawn(executablePath, [], {
    cwd: path.dirname(executablePath),
    windowsHide: true,
    stdio: "ignore"
  });

  child.once("exit", () => {
    agentProcess = null;
  });

  return child;
}

async function isAgentHealthy() {
  try {
    const response = await fetch(`${AGENT_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForAgent() {
  const start = Date.now();

  while (Date.now() - start < AGENT_START_TIMEOUT_MS) {
    if (await isAgentHealthy()) {
      return;
    }

    await delay(250);
  }

  throw new Error("ScreenAppAgent nu a pornit la timp.");
}

function resolveAgentExecutablePath() {
  if (process.resourcesPath) {
    const packagedPath = path.join(process.resourcesPath, "agent", "publish", "ScreenAppAgent.exe");
    if (fs.existsSync(packagedPath)) {
      return packagedPath;
    }
  }

  return path.join(__dirname, "..", "agent", "publish", "ScreenAppAgent.exe");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  ensureNativeAgent,
  fetchAgentState,
  sendAgentCommand,
  stopNativeAgent
};
