#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

function usage() {
  console.error(`Usage:
  node scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust [--provider claude|codex] [--only name] [--skip name] [--dry-run]

Scenarios are discovered from */scenario.json.
Repeat --provider to run multiple providers. If omitted, both claude and codex run.`);
}

function parseArgs(argv) {
  const args = {
    rustRepo: null,
    providers: [],
    only: null,
    skips: new Set(),
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--rust-repo") args.rustRepo = argv[++i];
    else if (arg === "--provider") args.providers.push(argv[++i]);
    else if (arg === "--only") args.only = argv[++i];
    else if (arg === "--skip") args.skips.add(argv[++i]);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.rustRepo) throw new Error("--rust-repo is required");
  if (args.only && args.skips.has(args.only)) throw new Error(`Scenario cannot be both --only and --skip: ${args.only}`);
  if (args.providers.length === 0) args.providers = ["claude", "codex"];
  for (const provider of args.providers) {
    if (!["claude", "codex"].includes(provider)) throw new Error(`Bad provider: ${provider}`);
  }
  return args;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function buildClaudeCommand(run, turn, state) {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
  const settings = JSON.stringify({
    claudeMdExcludes: [path.join(claudeConfigDir, "CLAUDE.md")],
  });
  const args = ["-p", "--settings", settings, "--output-format", "stream-json", "--verbose", "--model", "sonnet", "--effort", "medium"];

  if (!state.claudeSessionId) state.claudeSessionId = randomUUID();
  if (state.turnIndex === 0) args.push("--session-id", state.claudeSessionId);
  else args.push("--resume", state.claudeSessionId);

  args.push(turn.prompt);
  return { command: run.claudeBin ?? process.env.CLAUDE_BIN ?? "claude", args };
}

function buildCodexCommand(run, turn, state) {
  const args = ["exec", "--json", "--model", "gpt-5.4-mini", "--sandbox", "workspace-write"];

  if (state.threadId) args.push("resume", state.threadId);

  args.push(turn.prompt);
  return { command: run.codexBin ?? process.env.CODEX_BIN ?? "codex", args };
}

async function symlinkChildrenExcept(sourceDir, targetDir, excludedNames) {
  const entries = await readdir(sourceDir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });

  await mkdir(targetDir, { recursive: true });
  for (const entry of entries) {
    if (excludedNames.has(entry.name)) continue;
    await symlink(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), entry.isDirectory() ? "dir" : "file");
  }
}

async function prepareRunEnvironment(provider, dryRun) {
  if (dryRun || provider !== "codex") return { env: process.env, cleanup: null };

  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
  const isolatedCodexHome = await mkdtemp(path.join(tmpdir(), "transcript-codex-home-"));
  await symlinkChildrenExcept(codexHome, isolatedCodexHome, new Set(["AGENTS.md", "AGENTS.override.md"]));

  return {
    env: { ...process.env, CODEX_HOME: isolatedCodexHome },
    cleanup: async () => {
      await rm(isolatedCodexHome, { recursive: true, force: true });
    },
  };
}

function collectClaudeMarkdown(line, out, state) {
  const event = JSON.parse(line);

  if (event.type === "assistant" && event.message?.content) {
    for (const item of event.message.content) {
      if (item.type === "text" && item.text?.trim()) {
        state.claudeSawAssistantText = true;
        out.push(`⏺ ${item.text.trim()}`);
      }
      if (item.type === "tool_use") out.push(`⏺ ${item.name ?? "tool"}(${JSON.stringify(item.input ?? {})})`);
    }
    return;
  }

  if (event.type === "result" && event.subtype === "success" && event.result?.trim() && !state.claudeSawAssistantText) {
    out.push(`⏺ ${event.result.trim()}`);
  }
}

function collectCodexMarkdown(line, out, state) {
  const event = JSON.parse(line);

  if (event.type === "thread.started" && event.thread_id) state.threadId = event.thread_id;

  const item = event.item;
  if (event.type !== "item.completed" || !item) return;

  if (item.type === "agent_message" && item.text?.trim()) {
    out.push(`⏺ ${item.text.trim()}`);
  } else if (item.type === "command_execution") {
    out.push(`⏺ Bash(${item.command})`);
  } else if (item.type === "file_change") {
    out.push(`⏺ ${item.change_type ?? "Edit"}(${item.path ?? "file"})`);
  } else if (item.type === "web_search") {
    out.push("⏺ WebSearch");
  } else if (item.type?.includes("tool")) {
    out.push("⏺ [tool use omitted]");
  }
}

async function runCommand({ command, args }, cwd, dryRun, env = process.env) {
  if (dryRun) {
    console.error([command, ...args].map(shellQuote).join(" "));
    return { stdout: "", stderr: "", status: 0 };
  }

  return await new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    child.on("error", (error) => {
      resolve({ stdout, stderr: `${stderr}${error.message}\n`, status: 127, error });
    });
    child.on("close", (status) => resolve({ stdout, stderr, status }));
  });
}

async function runScenario(run, args) {
  if (!Array.isArray(run.turns) || run.turns.length === 0) throw new Error(`Run ${run.name} needs turns`);

  const transcript = [];
  const state = { turnIndex: 0, threadId: null, claudeSessionId: null, claudeSawAssistantText: false };
  const runEnvironment = await prepareRunEnvironment(run.provider, args.dryRun);

  try {
    for (const turn of run.turns) {
      state.claudeSawAssistantText = false;
      const suffix = turn.suggested ? "  ## suggested" : "";
      transcript.push(`❯ ${turn.prompt}${suffix}`, "");

      const command =
        run.provider === "claude"
          ? buildClaudeCommand(run, turn, state)
          : buildCodexCommand(run, turn, state);

      const result = await runCommand(command, args.rustRepo, args.dryRun, runEnvironment.env);
      if (args.dryRun && run.provider === "codex" && !state.threadId) {
        state.threadId = "DRY_RUN_THREAD_ID";
      }
      for (const line of result.stdout.split("\n").filter(Boolean)) {
        try {
          if (run.provider === "claude") collectClaudeMarkdown(line, transcript, state);
          else collectCodexMarkdown(line, transcript, state);
        } catch {
          transcript.push(line);
        }
      }

      if (result.status !== 0) {
        transcript.push(`⏺ ${run.provider} exited with status ${result.status}`);
        if (result.error?.code === "ENOENT") {
          const envVar = run.provider === "claude" ? "CLAUDE_BIN" : "CODEX_BIN";
          transcript.push(`⏺ Could not find ${command.command}. Install it, put it on PATH, or set ${envVar} to its full path.`);
        }
        if (result.stderr.trim()) transcript.push("", "```text", result.stderr.trim(), "```");
        break;
      }

      transcript.push("");
      state.turnIndex += 1;
    }
  } finally {
    await runEnvironment.cleanup?.();
  }

  if (args.dryRun) return;

  const outDir = path.resolve(run.name);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${run.provider}.md`), `${transcript.join("\n").trim()}\n`);
}

async function discoverScenarios(args) {
  const entries = await readdir(".", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !args.only || name === args.only)
    .filter((name) => !args.skips.has(name))
    .sort();

  const scenarios = [];
  for (const name of dirs) {
    try {
      const scenarioPath = path.join(name, "scenario.json");
      const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
      scenarios.push({ name, turns: scenario.turns });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Failed to read ${name}/scenario.json: ${error.message}`);
    }
  }

  return scenarios;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.dryRun) {
    const rustRepoStat = await stat(args.rustRepo).catch(() => null);
    if (!rustRepoStat?.isDirectory()) throw new Error(`--rust-repo is not a directory: ${args.rustRepo}`);
  }
  const scenarios = await discoverScenarios(args);

  if (scenarios.length === 0) throw new Error("No matching scenarios");

  for (const scenario of scenarios) {
    for (const provider of args.providers) {
      const run = { ...scenario, provider };
      console.error(`\n==> ${run.name} (${provider})`);
      await runScenario(run, args);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exit(1);
});
