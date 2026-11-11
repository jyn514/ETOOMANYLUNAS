#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, writeSync } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { clearInterval, setInterval } from "node:timers";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ISSUE_REPORTING_SKILL = ".agents/skills/rust-issue-reporting/SKILL.md";

const PROVIDER_MODELS = {
  claude: "claude-sonnet-5",
  codex: "gpt-6-luna",
};
const TRANSCRIPT_SUBMODULES = ["library/backtrace", "src/tools/cargo"];
const CLAUDE_SCENARIO_SETTINGS = JSON.parse(
  readFileSync(new URL("claude-settings.json", import.meta.url), "utf8"),
);

function usage() {
  console.error(`Usage:
  node scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust [--reviewer name] [--provider claude|codex] [--only name-or-directory] [--skip name-or-directory] [--skip-existing] [--jobs n] [--dry-run] [--progress|--no-progress]

Scenarios are discovered from */scenario.json, agents-md/*/scenario.json, and issue-reporting/*/scenario.json.
Select a directory, a group-qualified scenario path, or an unambiguous bare scenario name.
Directories include their discovered scenarios; --skip can exclude cases inside --only directories.
--skip-existing skips each scenario/provider pair whose transcript already exists.
Repeat --provider to run multiple providers. If omitted, both claude and codex run.
Repeat --only or --skip to combine selections.`);
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function parseArgs(argv) {
  const args = {
    rustRepo: null,
    providers: [],
    only: new Set(),
    skips: new Set(),
    skipExisting: false,
    jobs: 1,
    dryRun: false,
    progress: true,
    reviewer: null,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--rust-repo") args.rustRepo = argv[++i];
    else if (arg === "--reviewer") {
      if (args.reviewer !== null) throw new Error("--reviewer may only be provided once");
      args.reviewer = argv[++i];
    }
    else if (arg === "--provider") args.providers.push(argv[++i]);
    else if (arg === "--only") args.only.add(argv[++i]);
    else if (arg === "--skip") args.skips.add(argv[++i]);
    else if (arg === "--skip-existing") args.skipExisting = true;
    else if (arg === "--jobs") args.jobs = parsePositiveInteger(argv[++i], "--jobs");
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--no-progress") args.progress = false;
    else if (arg === "--progress") args.progress = true;
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.rustRepo) throw new Error("--rust-repo is required");
  if (args.reviewer !== null && (!args.reviewer?.trim() || args.reviewer.includes("{{reviewer}}"))) {
    throw new Error("--reviewer must be a non-empty name");
  }
  for (const name of args.only) {
    if (args.skips.has(name)) throw new Error(`Scenario cannot be both --only and --skip: ${name}`);
  }
  if (args.providers.length === 0) args.providers = ["claude", "codex"];
  for (const provider of args.providers) {
    if (!["claude", "codex"].includes(provider)) throw new Error(`Bad provider: ${provider}`);
  }
  return args;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function runProgressStep(enabled, label, operation) {
  if (!enabled) return await operation();

  const startedAt = Date.now();
  console.error(`→ ${label}`);
  try {
    const result = await operation();
    console.error(`✓ ${label} (${formatDuration(Date.now() - startedAt)})`);
    return result;
  } catch (error) {
    console.error(`✗ ${label} (${formatDuration(Date.now() - startedAt)})`);
    throw error;
  }
}

function buildClaudeCommand(run, turn, state) {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
  const settings = JSON.stringify({
    ...CLAUDE_SCENARIO_SETTINGS,
    sandbox: {
      ...CLAUDE_SCENARIO_SETTINGS.sandbox,
      filesystem: {
        ...CLAUDE_SCENARIO_SETTINGS.sandbox.filesystem,
        allowWrite: [run.bootstrapCachePath, run.cargoHomePath],
      },
    },
    claudeMdExcludes: [path.join(claudeConfigDir, "CLAUDE.md")],
  });
  const args = [
    "-p",
    "--settings",
    settings,
    "--setting-sources",
    "project,local",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "WebFetch,WebSearch",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    PROVIDER_MODELS.claude,
    "--effort",
    "medium",
  ];

  if (!state.claudeSessionId) state.claudeSessionId = randomUUID();
  if (state.turnIndex === 0) args.push("--session-id", state.claudeSessionId);
  else args.push("--resume", state.claudeSessionId);

  args.push(turn.prompt);
  return { command: run.claudeBin ?? process.env.CLAUDE_BIN ?? "claude", args };
}

function buildCodexCommand(run, turn, state) {
  const args = [
    "exec",
    "--json",
    "--config",
    `shell_environment_policy.set.HOME=${JSON.stringify(process.env.HOME ?? homedir())}`,
    "--config",
    `shell_environment_policy.set.XDG_CONFIG_HOME=${JSON.stringify(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"))}`,
    "--model",
    PROVIDER_MODELS.codex,
    "--config",
    'model_reasoning_effort="medium"',
    "--sandbox",
    "workspace-write",
    "--add-dir",
    run.bootstrapCachePath,
    "--add-dir",
    run.cargoHomePath,
    "--config",
    "sandbox_workspace_write.network_access=true",
  ];

  if (state.threadId) args.push("resume", state.threadId);

  args.push(turn.prompt);
  return { command: run.codexBin ?? process.env.CODEX_BIN ?? "codex", args };
}

function agentEnvironment(overrides = {}) {
  const allowSshPrompts = process.env.TRANSCRIPTS_ALLOW_SSH_PROMPTS === "1";
  const { CARGO_TARGET_DIR: _cargoTargetDir, ...inheritedEnvironment } = process.env;
  return {
    ...inheritedEnvironment,
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "/bin/false",
    SSH_ASKPASS: "/bin/false",
    SSH_ASKPASS_REQUIRE: "never",
    SSH_AUTH_SOCK: allowSshPrompts ? process.env.SSH_AUTH_SOCK ?? "" : "",
    SSH_AGENT_PID: allowSshPrompts ? process.env.SSH_AGENT_PID ?? "" : "",
    GIT_SSH_COMMAND: allowSshPrompts
      ? process.env.GIT_SSH_COMMAND ?? "ssh"
      : "ssh -o BatchMode=yes -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o PreferredAuthentications=publickey",
    GCM_INTERACTIVE: "Never",
    ...overrides,
  };
}

async function prepareRunEnvironment(run, dryRun) {
  const sharedEnvironment = { CARGO_HOME: run.cargoHomePath };
  if (dryRun || run.provider !== "codex") {
    return { env: agentEnvironment(sharedEnvironment), cleanup: null };
  }

  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
  // Codex refuses to create PATH helpers in CODEX_HOME under the system temp directory.
  const codexHomes = path.join(HARNESS_ROOT, "work", "codex-homes");
  await mkdir(codexHomes, { recursive: true, mode: 0o700 });
  const isolatedCodexHome = await mkdtemp(path.join(codexHomes, "run-"));
  const isolatedSqliteHome = path.join(isolatedCodexHome, "sqlite");
  const isolatedRulesDir = path.join(isolatedCodexHome, "rules");
  // Keep model-side configuration and skill discovery separate from tool configuration.
  // An explicit runtime token must not fall back to the caller's saved credentials.
  if (!process.env.CODEX_ACCESS_TOKEN) {
    await copyFile(path.join(codexHome, "auth.json"), path.join(isolatedCodexHome, "auth.json")).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  const isolatedUserHome = path.join(isolatedCodexHome, "user-home");
  const isolatedConfigHome = path.join(isolatedUserHome, ".config");
  await mkdir(isolatedConfigHome, { recursive: true });
  await mkdir(isolatedSqliteHome);
  await mkdir(isolatedRulesDir);
  await writeFile(
    path.join(isolatedRulesDir, "transcript.rules"),
    await readFile(new URL("transcript.rules", import.meta.url)),
  );

  return {
    env: agentEnvironment({
      ...sharedEnvironment,
      CODEX_HOME: isolatedCodexHome,
      CODEX_SQLITE_HOME: isolatedSqliteHome,
      HOME: isolatedUserHome,
      XDG_CONFIG_HOME: isolatedConfigHome,
    }),
    cleanup: async () => {
      await rm(isolatedCodexHome, { recursive: true, force: true });
    },
  };
}

function markdownFence(text) {
  const longestRun = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  return "`".repeat(Math.max(3, longestRun + 1));
}

function renderDetails(out, label, language, body) {
  const fence = markdownFence(body);
  if (out.at(-1) !== "") out.push("");
  out.push(
    "<details>",
    `<summary>⏺ ${label}</summary>`,
    "",
    `${fence}${language}`,
    body,
    fence,
    "",
    "</details>",
    "",
  );
}

function stripLocalLinkTargets(text) {
  return text.replace(
    /\[([^\]]+)]\(\s*(?:(?:sandbox:|file:\/\/)?\$CHECKOUT|(?:sandbox:|file:\/\/)?\/(?:private|Users)\/)[^)]*\)/g,
    "$1",
  );
}

function normalizeCheckoutPath(text, state) {
  for (const checkoutPath of state.checkoutPaths) text = text.replaceAll(checkoutPath, "$CHECKOUT");
  return text;
}

function renderedText(text, state) {
  return stripLocalLinkTargets(normalizeCheckoutPath(text, state));
}

function escapeHtml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function toolLabel(item, state) {
  const name = item.name ?? "tool";
  const rawTarget = item.input?.file_path ?? item.input?.path;
  if (typeof rawTarget !== "string") return name;
  const target = normalizeCheckoutPath(rawTarget, state).replace(/^\$CHECKOUT\//, "");
  return `${name} — <code>${escapeHtml(target)}</code>`;
}

function pushEvent(out, text) {
  if (out.at(-1) !== "") out.push("");
  out.push(text, "");
}

function flushCommands(out, state) {
  if (state.commands.length === 0) return;

  const label = state.commands.length === 1 ? "Command" : `Commands (${state.commands.length})`;
  if (out.at(-1) !== "") out.push("");
  out.push("<details>", `<summary>⏺ ${label}</summary>`, "");
  for (const [index, command] of state.commands.entries()) {
    const fence = markdownFence(command);
    if (index > 0) out.push("");
    out.push(`${fence}console`, command, fence);
  }
  out.push("", "</details>", "");
  state.commands.length = 0;
}

function collectClaudeMarkdown(line, out, state) {
  const event = JSON.parse(line);

  if (event.type === "assistant" && event.message?.content) {
    for (const item of event.message.content) {
      if (item.type === "text" && item.text?.trim()) {
        flushCommands(out, state);
        state.claudeSawAssistantText = true;
        pushEvent(out, `⏺ ${renderedText(item.text.trim(), state)}`);
      }
      if (item.type === "tool_use" && item.name === "Bash" && typeof item.input?.command === "string") {
        state.commands.push(normalizeCheckoutPath(item.input.command, state));
      } else if (item.type === "tool_use") {
        flushCommands(out, state);
        renderDetails(
          out,
          toolLabel(item, state),
          "json",
          normalizeCheckoutPath(JSON.stringify(item.input ?? {}, null, 2), state),
        );
      }
    }
    return;
  }

  if (event.type === "result" && event.subtype === "success" && event.result?.trim() && !state.claudeSawAssistantText) {
    flushCommands(out, state);
    pushEvent(out, `⏺ ${renderedText(event.result.trim(), state)}`);
  }
}

function collectCodexMarkdown(line, out, state) {
  const event = JSON.parse(line);

  if (event.type === "thread.started" && event.thread_id) state.threadId = event.thread_id;

  const errorMessage = event.type === "error" ? event.message
    : event.type === "turn.failed" ? event.error?.message
    : event.type === "item.completed" && event.item?.type === "error" ? event.item.message
    : null;
  if (typeof errorMessage === "string" && errorMessage.trim()) {
    const message = renderedText(errorMessage.trim(), state);
    if (!state.codexErrorMessages.has(message)) {
      state.codexErrorMessages.add(message);
      flushCommands(out, state);
      pushEvent(out, `⏺ Codex error: ${message}`);
    }
    return;
  }

  const item = event.item;
  if (event.type !== "item.completed" || !item) return;

  if (item.type === "agent_message" && item.text?.trim()) {
    const text = renderedText(item.text.trim(), state);
    if (state.codexAgentMessageTexts.has(text)) return;
    state.codexAgentMessageTexts.add(text);
    flushCommands(out, state);
    pushEvent(out, `⏺ ${text}`);
  } else if (item.type === "command_execution") {
    state.commands.push(normalizeCheckoutPath(String(item.command ?? ""), state));
  } else if (item.type === "file_change") {
    flushCommands(out, state);
    const target = normalizeCheckoutPath(String(item.path ?? "file"), state).replace(/^\$CHECKOUT\//, "");
    pushEvent(out, `⏺ ${item.change_type ?? "Edit"}(${target})`);
  } else if (item.type === "web_search") {
    flushCommands(out, state);
    pushEvent(out, "⏺ WebSearch");
  } else if (item.type?.includes("tool")) {
    flushCommands(out, state);
    pushEvent(out, "⏺ [tool use omitted]");
  }
}

async function runCommand(
  { command, args },
  cwd,
  dryRun,
  env = process.env,
  progressLabel = null,
  onStdoutLine = null,
  killDescendants = false,
  capture = null,
) {
  if (dryRun) {
    return {
      stdout: "",
      stderr: "",
      status: 0,
      durationMs: 0,
      dryRunCommand: [command, ...args].map(shellQuote).join(" "),
    };
  }

  return await new Promise((resolve) => {
    const ownsProcessGroup = killDescendants && process.platform !== "win32";
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: ownsProcessGroup,
    });
    let stdout = "";
    let pendingStdout = "";
    const decoder = new StringDecoder("utf8");
    let captureError = null;
    let spawnError = null;
    const captureBytes = (stream, data) => {
      if (!capture || captureError) return;
      try {
        let offset = 0;
        while (offset < data.length) {
          const written = writeSync(capture[stream], data, offset, data.length - offset);
          if (written === 0) throw new Error(`Could not write ${stream} capture`);
          offset += written;
          capture[`${stream}Bytes`] += written;
        }
      } catch (error) {
        captureError = error;
        child.kill();
      }
    };
    let stderr = "";
    let lastOutputAt = Date.now();
    const startedAt = lastOutputAt;
    let descendantCleanup = Promise.resolve();

    const heartbeat = setInterval(() => {
      if (!progressLabel) return;
      const elapsed = Date.now() - startedAt;
      const idle = Date.now() - lastOutputAt;
      if (idle >= 30000) {
        process.stderr.write(`⏳ ${progressLabel} still running after ${formatDuration(elapsed)} (${formatDuration(idle)} idle)\n`);
      }
    }, 30000);

    child.stdout.on("data", (data) => {
      lastOutputAt = Date.now();
      captureBytes("stdout", data);
      const text = decoder.write(data);
      stdout += text;
      if (onStdoutLine) {
        pendingStdout += text;
        const lines = pendingStdout.split("\n");
        pendingStdout = lines.pop();
        for (const line of lines) {
          if (line) onStdoutLine(line);
        }
      }
    });
    child.stderr.on("data", (data) => {
      lastOutputAt = Date.now();
      captureBytes("stderr", data);
      stderr += data.toString();
      process.stderr.write(data);
    });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("exit", () => {
      if (ownsProcessGroup) descendantCleanup = terminateProcessGroup(child.pid);
    });
    child.on("close", (status, signal) => {
      clearInterval(heartbeat);
      descendantCleanup.then(
        () => {
          const tail = decoder.end();
          stdout += tail;
          pendingStdout += tail;
          if (onStdoutLine && pendingStdout) onStdoutLine(pendingStdout);
          const error = spawnError ?? captureError;
          resolve({
            stdout, stderr: spawnError ? `${stderr}${spawnError.message}\n` : stderr,
            status: spawnError ? 127 : captureError ? 1 : status, signal,
            durationMs: Date.now() - startedAt, error,
          });
        },
        (error) => {
          resolve({
            stdout,
            stderr: `${stderr}${error.message}\n`,
            status: status && status !== 0 ? status : 1,
            signal,
            durationMs: Date.now() - startedAt,
            error,
          });
        },
      );
    });
  });
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function terminateProcessGroup(pid) {
  if (!pid || !processGroupExists(pid)) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return;
  }
  await delay(100);
  if (!processGroupExists(pid)) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function commandText(command) {
  return [command.command, ...command.args].map(shellQuote).join(" ");
}

async function runCheckedCommand(command, cwd, env, description) {
  const result = await runCommand(command, cwd, false, env);
  if (result.status !== 0) {
    const details = result.stderr.trim();
    throw new Error(
      `${description} failed with status ${result.status}: ${commandText(command)}${details ? `\n${details}` : ""}`,
    );
  }
  return result;
}

async function snapshotInputRevision(args, env) {
  const instructionPaths = ["CLAUDE.md", "AGENTS.md", ".claude", ".codex", ".agents"];
  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-input-index-"));
  const indexPath = path.join(tempDir, "index");
  const snapshotEnv = {
    ...env,
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: "Transcript Fixture",
    GIT_AUTHOR_EMAIL: "transcript-fixture@invalid",
    GIT_COMMITTER_NAME: "Transcript Fixture",
    GIT_COMMITTER_EMAIL: "transcript-fixture@invalid",
  };

  try {
    await runCheckedCommand(
      { command: "git", args: ["-C", args.rustRepo, "read-tree", "HEAD"] },
      args.rustRepo,
      snapshotEnv,
      "input snapshot initialization",
    );
    const trackedInstructions = await runCheckedCommand(
      {
        command: "git",
        args: ["-C", args.rustRepo, "ls-files", "-z", "--", ...instructionPaths],
      },
      args.rustRepo,
      snapshotEnv,
      "input snapshot instruction discovery",
    );
    const trackedPaths = trackedInstructions.stdout.split("\0").filter(Boolean);
    const presentInstructions = (
      await Promise.all(
        instructionPaths.map(async (instructionPath) => {
          const present = await stat(path.join(args.rustRepo, instructionPath)).catch(() => null);
          const tracked = trackedPaths.some(
            (trackedPath) => trackedPath === instructionPath || trackedPath.startsWith(`${instructionPath}/`),
          );
          return present || tracked ? instructionPath : null;
        }),
      )
    ).filter(Boolean);
    if (presentInstructions.length > 0) {
      await runCheckedCommand(
        {
          command: "git",
          args: ["-C", args.rustRepo, "add", "--all", "--", ...presentInstructions],
        },
        args.rustRepo,
        snapshotEnv,
        "input snapshot staging",
      );
    }
    const tree = await runCheckedCommand(
      { command: "git", args: ["-C", args.rustRepo, "write-tree"] },
      args.rustRepo,
      snapshotEnv,
      "input snapshot tree creation",
    );
    const headTree = await runCheckedCommand(
      { command: "git", args: ["-C", args.rustRepo, "rev-parse", "HEAD^{tree}"] },
      args.rustRepo,
      snapshotEnv,
      "input snapshot comparison",
    );
    if (tree.stdout.trim() === headTree.stdout.trim()) {
      const head = await runCheckedCommand(
        { command: "git", args: ["-C", args.rustRepo, "rev-parse", "HEAD"] },
        args.rustRepo,
        snapshotEnv,
        "input snapshot revision resolution",
      );
      return head.stdout.trim();
    }

    const commit = await runCheckedCommand(
      {
        command: "git",
        args: [
          "-C",
          args.rustRepo,
          "commit-tree",
          tree.stdout.trim(),
          "-p",
          "HEAD",
          "-m",
          "Snapshot transcript input",
        ],
      },
      args.rustRepo,
      snapshotEnv,
      "input snapshot commit creation",
    );
    return commit.stdout.trim();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function snapshotHarnessRevision(args, scenarios, env) {
  if (args.dryRun) return "$HARNESS_REVISION";

  const inputPaths = new Set(["scripts/generate-transcripts.mjs", "scripts/transcript.rules"]);
  if (scenarios.some((scenario) => scenario.name.startsWith("issue-reporting/"))) inputPaths.add(ISSUE_REPORTING_SKILL);
  for (const scenario of scenarios) {
    inputPaths.add(path.join(scenario.name, "scenario.json"));
    if (scenario.setup?.patch) {
      const relativePatch = path.relative(HARNESS_ROOT, scenario.setup.patch);
      if (relativePatch.startsWith(`..${path.sep}`) || path.isAbsolute(relativePatch)) {
        throw new Error(`${scenario.name} setup patch is outside the harness repository: ${scenario.setup.patch}`);
      }
      inputPaths.add(relativePatch);
    }
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-harness-index-"));
  const indexPath = path.join(tempDir, "index");
  const snapshotEnv = {
    ...env,
    GIT_INDEX_FILE: indexPath,
    GIT_AUTHOR_NAME: "Transcript Fixture",
    GIT_AUTHOR_EMAIL: "transcript-fixture@invalid",
    GIT_COMMITTER_NAME: "Transcript Fixture",
    GIT_COMMITTER_EMAIL: "transcript-fixture@invalid",
  };

  try {
    const head = await runCheckedCommand(
      { command: "git", args: ["rev-parse", "HEAD"] },
      HARNESS_ROOT,
      snapshotEnv,
      "harness snapshot HEAD discovery",
    );
    await runCheckedCommand(
      { command: "git", args: ["read-tree", head.stdout.trim()] },
      HARNESS_ROOT,
      snapshotEnv,
      "harness snapshot initialization",
    );
    await runCheckedCommand(
      {
        command: "git",
        args: ["add", "--all", "--", ...[...inputPaths].sort().map((inputPath) => `:(top,literal)${inputPath}`)],
      },
      HARNESS_ROOT,
      snapshotEnv,
      "harness snapshot staging",
    );
    const tree = await runCheckedCommand(
      { command: "git", args: ["write-tree"] },
      HARNESS_ROOT,
      snapshotEnv,
      "harness snapshot tree creation",
    );
    const commit = await runCheckedCommand(
      {
        command: "git",
        args: [
          "commit-tree",
          tree.stdout.trim(),
          "-p",
          head.stdout.trim(),
          "-m",
          "transcript harness input snapshot",
        ],
      },
      HARNESS_ROOT,
      snapshotEnv,
      "harness snapshot commit creation",
    );
    return commit.stdout.trim();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function collectProviderVersions(args, env) {
  const versions = {};
  for (const provider of args.providers) {
    if (args.dryRun) {
      versions[provider] = "$PROVIDER_VERSION";
      continue;
    }
    const command =
      provider === "claude"
        ? process.env.CLAUDE_BIN ?? "claude"
        : process.env.CODEX_BIN ?? "codex";
    const result = await runCommand({ command, args: ["--version"] }, process.cwd(), false, env);
    if (result.status !== 0) {
      throw new Error(`Failed to determine ${provider} version with ${shellQuote(command)} --version`);
    }
    versions[provider] = (result.stdout.trim() || result.stderr.trim()).split("\n")[0];
  }
  return versions;
}

async function findTranscriptSubmodules(args, env) {
  const result = await runCheckedCommand(
    { command: "git", args: ["ls-tree", args.inputRevision, "--", ...TRANSCRIPT_SUBMODULES] },
    args.rustRepo,
    env,
    "transcript submodule discovery",
  );
  return result.stdout
    .split("\n")
    .filter((line) => line.startsWith("160000 "))
    .map((line) => line.slice(line.indexOf("\t") + 1));
}

async function prepareCheckoutTemplate(args, env) {
  if (args.dryRun || !args.useCheckoutTemplate) return null;

  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-template-"));
  const checkout = path.join(tempDir, "checkout");
  try {
    await runProgressStep(
      args.progress,
      "Cloning checkout template",
      async () =>
        await runCheckedCommand(
          { command: "git", args: ["clone", "--shared", "--no-checkout", args.rustRepo, checkout] },
          args.rustRepo,
          env,
          "checkout template clone",
        ),
    );
    await runProgressStep(
      args.progress,
      "Checking out Rust input revision",
      async () =>
        await runCheckedCommand(
          { command: "git", args: ["-C", checkout, "checkout", "--detach", args.inputRevision] },
          checkout,
          env,
          "checkout template setup",
        ),
    );
    await runProgressStep(
      args.progress,
      "Initializing Cargo and backtrace submodules",
      async () =>
        await runCheckedCommand(
          {
            command: "git",
            args: ["submodule", "update", "--init", "--depth", "1", "--", ...args.submodulePaths],
          },
          checkout,
          env,
          "checkout template submodule setup",
        ),
    );
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    checkout,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function prepareRunCheckout(run, args, env, dryRunCommands) {
  const placeholder = "$RUN_WORKTREE";
  const cloneCommand = {
    command: "git",
    args: ["clone", "--shared", "--no-checkout", args.rustRepo, placeholder],
  };
  const checkoutCommand = {
    command: "git",
    args: ["-C", placeholder, "checkout", "--detach", args.inputRevision],
  };
  const submoduleArgs = [
    "submodule",
    "update",
    "--init",
    "--depth",
    "1",
    "--",
    ...args.submodulePaths,
  ];
  const submoduleCommand = {
    command: "git",
    args: ["-C", placeholder, ...submoduleArgs],
  };

  if (args.dryRun) {
    dryRunCommands.push(commandText(cloneCommand), commandText(checkoutCommand));
    if (args.submodulePaths.length > 0) dryRunCommands.push(commandText(submoduleCommand));
    return {
      cwd: placeholder,
      env,
      cleanup: async () => {
        dryRunCommands.push(`rm -rf ${shellQuote(placeholder)}`);
      },
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-worktree-"));
  const worktree = path.join(tempDir, "checkout");
  const bootstrapConfig = path.join(tempDir, "bootstrap.toml");
  const actualCloneCommand = {
    ...cloneCommand,
    args: ["clone", "--shared", "--no-checkout", args.rustRepo, worktree],
  };
  const actualCheckoutCommand = {
    ...checkoutCommand,
    args: ["-C", worktree, "checkout", "--detach", args.inputRevision],
  };

  try {
    await runCheckedCommand(actualCloneCommand, args.rustRepo, env, `${run.name} (${run.provider}) clone setup`);
    await runCheckedCommand(actualCheckoutCommand, worktree, env, `${run.name} (${run.provider}) checkout setup`);
    if (args.checkoutTemplate) {
      for (const submodule of args.submodulePaths) {
        await runCheckedCommand(
          {
            command: "git",
            args: [
              "config",
              "--local",
              `submodule.${submodule}.url`,
              String(pathToFileURL(path.join(args.checkoutTemplate, ".git", "modules", submodule))),
            ],
          },
          worktree,
          env,
          `${run.name} (${run.provider}) local ${submodule} configuration`,
        );
      }
      await runCheckedCommand(
        {
          command: "git",
          args: ["-c", "protocol.file.allow=always", ...submoduleArgs],
        },
        worktree,
        env,
        `${run.name} (${run.provider}) local submodule setup`,
      );
    } else if (args.submodulePaths.length > 0) {
      await runCheckedCommand(
        { command: "git", args: submoduleArgs },
        worktree,
        env,
        `${run.name} (${run.provider}) baseline submodule setup`,
      );
    }
    await writeFile(
      bootstrapConfig,
      `change-id = "ignore"\n\n[build]\nbootstrap-cache-path = ${JSON.stringify(run.bootstrapCachePath)}\nsubmodules = false\n`,
    );
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    cwd: worktree,
    env: {
      ...env,
      RUST_BOOTSTRAP_CONFIG: bootstrapConfig,
    },
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function resetRunCheckout(run, checkout, args) {
  const reset = async (command, description) =>
    await runCheckedCommand(command, checkout.cwd, checkout.env, `${run.name} (${run.provider}) ${description}`);

  await reset(
    { command: "git", args: ["reset", "--hard", args.inputRevision] },
    "checkout reset",
  );
  await reset({ command: "git", args: ["clean", "-ffdx"] }, "checkout clean");
  if (args.submodulePaths.length > 0) {
    await reset(
      { command: "git", args: ["submodule", "update", "--init", "--force", "--", ...args.submodulePaths] },
      "submodule restore",
    );
    await reset(
      { command: "git", args: ["submodule", "foreach", "--recursive", "git reset --hard"] },
      "submodule reset",
    );
    await reset(
      { command: "git", args: ["submodule", "foreach", "--recursive", "git clean -ffdx"] },
      "submodule clean",
    );
  }
}

async function applyScenarioSetup(run, cwd, args, env, dryRunCommands) {
  if (!run.setup) return;

  if (run.setup.patch) {
    const command = {
      command: "git",
      args: ["apply", ...(run.setup.commit ? ["--index"] : []), run.setup.patch],
    };
    if (args.dryRun) dryRunCommands.push(commandText(command));
    else await runCheckedCommand(command, cwd, env, `${run.name} (${run.provider}) setup patch`);
  }

  for (const setupCommand of run.setup.commands ?? []) {
    const command = { command: "sh", args: ["-c", setupCommand] };
    if (args.dryRun) dryRunCommands.push(commandText(command));
    else {
      await runCheckedCommand(
        command,
        cwd,
        env,
        `${run.name} (${run.provider}) setup command ${shellQuote(setupCommand)}`,
      );
    }
  }

  if (run.setup.commit) {
    const addCommand = { command: "git", args: ["add", "--all", "--", "$SETUP_CHANGED_PATHS"] };
    const commitCommand = {
      command: "git",
      args: [
        "-c",
        "user.name=Transcript Fixture",
        "-c",
        "user.email=transcript-fixture@invalid",
        "-c",
        "commit.gpgSign=false",
        "commit",
        "--no-verify",
        "-m",
        run.setup.commit.message,
      ],
    };
    if (args.dryRun) {
      if (run.setup.commands?.length > 0) dryRunCommands.push(commandText(addCommand));
      dryRunCommands.push(commandText(commitCommand));
    } else {
      if (run.setup.commands?.length > 0) {
        const trackedChanges = await runCheckedCommand(
          {
            command: "git",
            args: ["diff", "--name-only", "-z", "--ignore-submodules=dirty", "HEAD", "--"],
          },
          cwd,
          env,
          `${run.name} (${run.provider}) setup change discovery`,
        );
        const untrackedChanges = await runCheckedCommand(
          { command: "git", args: ["ls-files", "--others", "--exclude-standard", "-z"] },
          cwd,
          env,
          `${run.name} (${run.provider}) untracked setup change discovery`,
        );
        const changedPaths = [
          ...new Set(
            `${trackedChanges.stdout}${untrackedChanges.stdout}`
              .split("\0")
              .filter(Boolean),
          ),
        ];
        if (changedPaths.length > 0) {
          await runCheckedCommand(
            {
              command: "git",
              args: ["add", "--all", "--", ...changedPaths.map((changedPath) => `:(top,literal)${changedPath}`)],
            },
            cwd,
            env,
            `${run.name} (${run.provider}) setup staging`,
          );
        }
      }
      await runCheckedCommand(commitCommand, cwd, env, `${run.name} (${run.provider}) setup commit`);
    }
  }
}

async function runScenario(run, args, workerCheckout = null) {
  if (!Array.isArray(run.turns) || run.turns.length === 0) throw new Error(`Run ${run.name} needs turns`);

  const fixtureLinks = [];
  if (run.setup) {
    fixtureLinks.push("[Fixture](scenario.json)");
    if (run.setup.patch) {
      const setupPatch = path.relative(path.resolve(run.name), run.setup.patch).split(path.sep).join("/");
      fixtureLinks.push(`[Setup patch](${setupPatch})`);
    }
  }
  fixtureLinks.push(`[Run metadata](${run.provider}.meta.json)`);
  fixtureLinks.push(`[Raw output](${run.provider}.jsonl)`, `[Provider stderr](${run.provider}.stderr.log)`);
  const transcript = [fixtureLinks.join(" · "), ""];
  const dryRunCommands = [];
  const turnResults = [];
  const state = {
    turnIndex: 0,
    threadId: null,
    claudeSessionId: null,
    claudeSawAssistantText: false,
    codexAgentMessageTexts: new Set(),
    codexErrorMessages: new Set(),
    commands: [],
    checkoutPaths: [],
  };
  const runEnvironment = await prepareRunEnvironment(run, args.dryRun);
  let runCheckout = workerCheckout;
  let capture = null;

  try {
    if (runCheckout) {
      await runProgressStep(
        args.progress,
        `Resetting ${run.name} (${run.provider}) checkout`,
        async () => await resetRunCheckout(run, runCheckout, args),
      );
    } else {
      runCheckout = await runProgressStep(
        args.progress && !args.dryRun,
        `Preparing ${run.name} (${run.provider}) checkout`,
        async () => await prepareRunCheckout(run, args, runEnvironment.env, dryRunCommands),
      );
    }
    if (workerCheckout) {
      runCheckout = {
        ...workerCheckout,
        env: {
          ...runEnvironment.env,
          RUST_BOOTSTRAP_CONFIG: workerCheckout.env.RUST_BOOTSTRAP_CONFIG,
        },
      };
    }
    state.checkoutPaths = [runCheckout.cwd];
    if (runCheckout.cwd.startsWith("/var/")) state.checkoutPaths.unshift(`/private${runCheckout.cwd}`);
    if (runCheckout.cwd.startsWith("/private/var/")) state.checkoutPaths.push(runCheckout.cwd.slice("/private".length));
    await runProgressStep(
      args.progress && !args.dryRun && Boolean(run.setup),
      `Applying ${run.name} (${run.provider}) scenario setup`,
      async () => await applyScenarioSetup(run, runCheckout.cwd, args, runCheckout.env, dryRunCommands),
    );

    if (run.name.startsWith("issue-reporting/")) {
      const destination = path.join(runCheckout.cwd, ISSUE_REPORTING_SKILL);
      if (args.dryRun) {
        dryRunCommands.push(`mkdir -p ${shellQuote(path.dirname(destination))}`);
        dryRunCommands.push(`cp ${shellQuote(path.join(HARNESS_ROOT, ISSUE_REPORTING_SKILL))} ${shellQuote(destination)}`);
      } else {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, args.issueReportingSkill);
      }
    }

    if (!args.dryRun) {
      const outDir = path.resolve(run.name);
      await mkdir(outDir, { recursive: true });
      const stdout = openSync(path.join(outDir, `${run.provider}.jsonl`), "w");
      try {
        const stderr = openSync(path.join(outDir, `${run.provider}.stderr.log`), "w");
        capture = { stdout, stderr, stdoutBytes: 0, stderrBytes: 0 };
      } catch (error) {
        closeSync(stdout);
        throw error;
      }
    }

    for (const [turnIndex, turn] of run.turns.entries()) {
      const progressLabel = `${run.name} (${run.provider}) turn ${turnIndex + 1}/${run.turns.length}`;
      state.claudeSawAssistantText = false;
      state.codexAgentMessageTexts.clear();
      state.codexErrorMessages.clear();
      const suffix = turn.suggested ? "  ## suggested" : "";
      transcript.push(`❯ ${turn.prompt}${suffix}`, "");

      if (args.progress && !args.dryRun) {
        console.error(`→ ${progressLabel}`);
      }

      const command =
        run.provider === "claude"
          ? buildClaudeCommand(run, turn, state)
          : buildCodexCommand(run, turn, state);

      const collectOutputLine = (line) => {
        const previousLength = transcript.length;
        try {
          if (run.provider === "claude") collectClaudeMarkdown(line, transcript, state);
          else collectCodexMarkdown(line, transcript, state);
        } catch {
          transcript.push(line);
        }
        if (args.progress) {
          for (const renderedLine of transcript.slice(previousLength)) {
            process.stderr.write(`${renderedLine}\n`);
          }
        }
      };
      const stdoutStart = capture?.stdoutBytes;
      const stderrStart = capture?.stderrBytes;
      const result = await runCommand(
        command,
        runCheckout.cwd,
        args.dryRun,
        runCheckout.env,
        args.progress && !args.dryRun ? progressLabel : null,
        args.dryRun ? null : collectOutputLine,
        !args.dryRun,
        capture,
      );
      turnResults.push({
        turn: turnIndex + 1,
        status: result.status,
        duration_ms: result.durationMs,
        ...(capture ? { stdout_bytes: [stdoutStart, capture.stdoutBytes], stderr_bytes: [stderrStart, capture.stderrBytes] } : {}),
        ...(result.signal === null || result.signal === undefined ? {} : { signal: result.signal }),
      });
      flushCommands(transcript, state);
      if (result.dryRunCommand) dryRunCommands.push(result.dryRunCommand);
      if (args.dryRun && run.provider === "codex" && !state.threadId) {
        state.threadId = "DRY_RUN_THREAD_ID";
      }

      if (result.status !== 0) {
        transcript.push(`⏺ ${run.provider} exited with status ${result.status}`);
        if (result.error?.code === "ENOENT") {
          const envVar = run.provider === "claude" ? "CLAUDE_BIN" : "CODEX_BIN";
          transcript.push(`⏺ Could not find ${command.command}. Install it, put it on PATH, or set ${envVar} to its full path.`);
        }
        if (result.error && result.error.code !== "ENOENT") transcript.push(`⏺ ${result.error.message}`);
        if (result.stderr.trim()) transcript.push("", "```text", result.stderr.trim(), "```");
        break;
      }

      transcript.push("");
      state.turnIndex += 1;
    }
  } finally {
    try {
      if (capture) {
        try { closeSync(capture.stdout); } finally { closeSync(capture.stderr); }
      }
    } finally {
      try {
        if (!workerCheckout) await runCheckout?.cleanup?.();
      } finally {
        await runEnvironment.cleanup?.();
      }
    }
  }

  if (args.dryRun) {
    console.error([`\n==> ${run.name} (${run.provider})`, ...dryRunCommands].join("\n"));
    return;
  }

  const outDir = path.resolve(run.name);
  await mkdir(outDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outDir, `${run.provider}.md`), `${transcript.join("\n").trim()}\n`),
    writeFile(
      path.join(outDir, `${run.provider}.meta.json`),
      `${JSON.stringify(
        {
          version: 2,
          generated_at: new Date().toISOString(),
          provider: run.provider,
          model: PROVIDER_MODELS[run.provider],
          reasoning_effort: "medium",
          provider_version: args.providerVersions[run.provider],
          harness_revision: args.harnessRevision,
          rust_revision: args.inputRevision,
          turns: turnResults,
          ...(args.reviewer === null ? {} : { reviewer: args.reviewer }),
        },
        null,
        2,
      )}\n`,
    ),
  ]);
  const failedTurn = turnResults.find((turn) => turn.status !== 0);
  if (failedTurn) {
    throw new Error(`${run.provider} turn ${failedTurn.turn} exited with status ${failedTurn.status}; transcript saved to ${path.join(run.name, `${run.provider}.md`)}`);
  }
}

async function discoverScenarios(args) {
  const entries = await readdir(".", { withFileTypes: true });
  const directoryNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const group of ["agents-md", "issue-reporting"]) {
    if (!directoryNames.includes(group)) continue;
    const children = await readdir(group, { withFileTypes: true });
    directoryNames.push(...children.filter((entry) => entry.isDirectory()).map((entry) => `${group}/${entry.name}`));
  }
  const scenarioDirs = new Set(
    (await Promise.all(directoryNames.map(async (name) => {
      const scenarioStat = await stat(path.join(name, "scenario.json")).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return scenarioStat?.isFile() ? name : null;
    }))).filter((name) => name !== null),
  );
  function resolveSelector(selector, flag) {
    const relative = path.relative(process.cwd(), path.resolve(selector)).split(path.sep).join("/") || ".";
    const descendants = [...scenarioDirs].filter((name) => relative === "." || name.startsWith(`${relative}/`));
    if (descendants.length > 0) {
      return { target: relative, names: scenarioDirs.has(relative) ? [relative, ...descendants] : descendants };
    }
    if (selector.includes("/") && scenarioDirs.has(relative)) return { target: relative, names: [relative] };
    const matches = [...scenarioDirs].filter((name) => path.basename(name) === selector);
    if (matches.length > 1) throw new Error(`Ambiguous ${flag} scenario: ${selector}; use a qualified path: ${matches.sort().join(", ")}`);
    if (matches.length === 1) return { target: matches[0], names: matches };
    if (flag === "--only") throw new Error(`Unknown --only scenario: ${selector}`);
    return { target: null, names: [] };
  }
  const onlySelections = [...args.only].map((name) => resolveSelector(name, "--only"));
  const skipSelections = [...args.skips].map((name) => resolveSelector(name, "--skip"));
  for (const selection of onlySelections) {
    if (skipSelections.some((skip) => skip.target === selection.target)) {
      throw new Error(`Scenario cannot be both --only and --skip: ${selection.target}`);
    }
  }
  const only = new Set(onlySelections.flatMap((selection) => selection.names));
  const skips = new Set(skipSelections.flatMap((selection) => selection.names));
  const dirs = [...scenarioDirs]
    .filter((name) => args.only.size === 0 || only.has(name))
    .filter((name) => !skips.has(name))
    .sort();

  const scenarios = [];
  let skippedExisting = 0;
  for (const name of dirs) {
    const providers = [];
    for (const provider of args.providers) {
      const transcript = args.skipExisting ? await stat(path.join(name, `${provider}.md`)).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      }) : null;
      if (transcript?.isFile()) skippedExisting += 1;
      else providers.push(provider);
    }
    if (providers.length === 0) continue;
    try {
      const scenarioPath = path.join(name, "scenario.json");
      const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
      const setup = validateScenarioSetup(name, scenario.setup);
      scenarios.push({ name, turns: scenario.turns, setup, providers });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Failed to read ${name}/scenario.json: ${error.message}`);
    }
  }

  return { scenarios, skippedExisting };
}

function substituteScenarioReviewers(scenarios, reviewer) {
  const requiringReviewer = scenarios.filter((scenario) =>
    scenario.turns?.some((turn) => turn.prompt?.includes("{{reviewer}}")),
  );
  if (requiringReviewer.length > 0 && reviewer === null) {
    throw new Error(
      `--reviewer is required by scenario${requiringReviewer.length === 1 ? "" : "s"}: ${requiringReviewer
        .map((scenario) => scenario.name)
        .join(", ")}`,
    );
  }

  return scenarios.map((scenario) => ({
    ...scenario,
    turns: scenario.turns?.map((turn) => ({
      ...turn,
      prompt: turn.prompt?.replaceAll("{{reviewer}}", reviewer),
    })),
  }));
}

function validateScenarioSetup(name, setup) {
  if (setup === undefined) return null;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) {
    throw new Error(`${name}/scenario.json: setup must be an object`);
  }

  const supportedKeys = new Set(["patch", "commands", "commit"]);
  for (const key of Object.keys(setup)) {
    if (!supportedKeys.has(key)) throw new Error(`${name}/scenario.json: unknown setup property: ${key}`);
  }

  const validated = {};
  if (setup.patch !== undefined) {
    if (typeof setup.patch !== "string" || setup.patch.length === 0) {
      throw new Error(`${name}/scenario.json: setup.patch must be a non-empty string`);
    }
    validated.patch = path.resolve(name, setup.patch);
  }
  if (setup.commands !== undefined) {
    if (
      !Array.isArray(setup.commands) ||
      setup.commands.some((command) => typeof command !== "string" || command.length === 0)
    ) {
      throw new Error(`${name}/scenario.json: setup.commands must be an array of non-empty strings`);
    }
    validated.commands = setup.commands;
  }
  if (setup.commit !== undefined) {
    if (
      !setup.commit ||
      typeof setup.commit !== "object" ||
      Array.isArray(setup.commit) ||
      Object.keys(setup.commit).some((key) => key !== "message") ||
      typeof setup.commit.message !== "string" ||
      setup.commit.message.length === 0
    ) {
      throw new Error(`${name}/scenario.json: setup.commit must contain one non-empty message`);
    }
    validated.commit = { message: setup.commit.message };
  }
  return validated;
}

async function runAll(runs, args) {
  let nextRunIndex = 0;
  let completedRuns = 0;
  const failures = [];
  const jobs = Math.min(args.jobs, runs.length);
  const totalRuns = runs.length;

  async function worker() {
    let workerCheckout = null;
    try {
      if (!args.dryRun) {
        const firstRun = runs[nextRunIndex];
        workerCheckout = await prepareRunCheckout(firstRun, args, agentEnvironment(), []);
      }
      while (nextRunIndex < runs.length) {
        const runIndex = nextRunIndex;
        const run = runs[runIndex];
        nextRunIndex += 1;
        if (!args.dryRun && args.progress) console.error(`\n==> [${runIndex + 1}/${totalRuns}] ${run.name} (${run.provider})`);
        else if (!args.dryRun) console.error(`\n==> ${run.name} (${run.provider})`);
        try {
          await runScenario(run, args, workerCheckout);
        } catch (error) {
          failures.push({ run, error });
          console.error(`✗ ${run.name} (${run.provider}): ${error.message}`);
          continue;
        }
        completedRuns += 1;
        if (!args.dryRun && args.progress) {
          console.error(`✓ [${completedRuns}/${totalRuns}] ${run.name} (${run.provider}) done`);
        }
      }
    } finally {
      await workerCheckout?.cleanup?.();
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
  if (failures.length > 0) {
    throw new Error(
      `${failures.length} transcript run${failures.length === 1 ? "" : "s"} failed:\n${failures
        .map(({ run, error }) => `- ${run.name} (${run.provider}): ${error.message}`)
        .join("\n")}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const discovered = await discoverScenarios(args);
  if (discovered.skippedExisting > 0) {
    console.error(`Skipping ${discovered.skippedExisting} existing transcript${discovered.skippedExisting === 1 ? "" : "s"}.`);
  }
  if (discovered.scenarios.length === 0) {
    if (discovered.skippedExisting > 0) {
      console.error("No missing transcripts; nothing to run.");
      return;
    }
    throw new Error("No matching scenarios");
  }
  const scenarios = substituteScenarioReviewers(discovered.scenarios, args.reviewer);
  args.providers = [...new Set(scenarios.flatMap((scenario) => scenario.providers))];
  const needsIssueSkill = scenarios.some((scenario) => scenario.name.startsWith("issue-reporting/"));
  if (needsIssueSkill) {
    try {
      await readFile(path.join(HARNESS_ROOT, ISSUE_REPORTING_SKILL));
    } catch (error) {
      throw new Error(`Cannot read issue-reporting candidate ${ISSUE_REPORTING_SKILL}: ${error.message}`);
    }
  }
  args.harnessRevision = await runProgressStep(
    args.progress && !args.dryRun,
    "Snapshotting harness inputs",
    async () => await snapshotHarnessRevision(args, scenarios, agentEnvironment()),
  );
  if (needsIssueSkill && !args.dryRun) {
    args.issueReportingSkill = execFileSync("git", ["show", `${args.harnessRevision}:${ISSUE_REPORTING_SKILL}`], { cwd: HARNESS_ROOT });
  }
  args.providerVersions = await runProgressStep(
    args.progress && !args.dryRun,
    "Reading provider versions",
    async () => await collectProviderVersions(args, agentEnvironment()),
  );

  const cacheRoot = process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache");
  args.bootstrapCachePath = path.resolve(
    process.env.TRANSCRIPTS_BOOTSTRAP_CACHE ?? path.join(cacheRoot, "definitely-not-rust", "bootstrap"),
  );
  args.cargoHomePath = path.resolve(
    process.env.TRANSCRIPTS_CARGO_HOME ?? path.join(cacheRoot, "definitely-not-rust", "cargo"),
  );
  args.inputRevision = "$INPUT_REVISION";
  args.submodulePaths = TRANSCRIPT_SUBMODULES;
  if (!args.dryRun) {
    await Promise.all([
      mkdir(args.bootstrapCachePath, { recursive: true }),
      mkdir(args.cargoHomePath, { recursive: true }),
    ]);
    const rustRepoStat = await stat(args.rustRepo).catch(() => null);
    if (!rustRepoStat?.isDirectory()) throw new Error(`--rust-repo is not a directory: ${args.rustRepo}`);
    const gitCheck = await runCommand(
      { command: "git", args: ["-C", args.rustRepo, "rev-parse", "--show-toplevel"] },
      args.rustRepo,
      false,
      agentEnvironment(),
    );
    if (gitCheck.status !== 0) throw new Error(`--rust-repo is not a Git repository: ${args.rustRepo}`);
    args.inputRevision = await runProgressStep(
      args.progress,
      "Snapshotting Rust inputs",
      async () => await snapshotInputRevision(args, agentEnvironment()),
    );
    args.submodulePaths = await findTranscriptSubmodules(args, agentEnvironment());
  }

  const runs = scenarios.flatMap((scenario) =>
    scenario.providers.map((provider) => ({
      ...scenario,
      provider,
      bootstrapCachePath: args.bootstrapCachePath,
      cargoHomePath: args.cargoHomePath,
    })),
  );
  args.useCheckoutTemplate = runs.length > 1 && args.submodulePaths.length > 0;
  const template = await prepareCheckoutTemplate(args, agentEnvironment());
  args.checkoutTemplate = template?.checkout ?? null;
  try {
    await runAll(runs, args);
  } finally {
    await template?.cleanup();
  }
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exit(1);
});
