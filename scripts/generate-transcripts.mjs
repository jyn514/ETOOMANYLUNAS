#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { clearInterval, setInterval } from "node:timers";
import { randomUUID } from "node:crypto";

function usage() {
  console.error(`Usage:
  node scripts/generate-transcripts.mjs --rust-repo /path/to/rust-lang/rust [--provider claude|codex] [--only name] [--skip name] [--jobs n] [--dry-run] [--progress|--no-progress]

Scenarios are discovered from */scenario.json.
Repeat --provider to run multiple providers. If omitted, both claude and codex run.
Repeat --only to run multiple scenarios.`);
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
    jobs: 1,
    dryRun: false,
    progress: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--rust-repo") args.rustRepo = argv[++i];
    else if (arg === "--provider") args.providers.push(argv[++i]);
    else if (arg === "--only") args.only.add(argv[++i]);
    else if (arg === "--skip") args.skips.add(argv[++i]);
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

function buildClaudeCommand(run, turn, state) {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
  const settings = JSON.stringify({
    claudeMdExcludes: [path.join(claudeConfigDir, "CLAUDE.md")],
  });
  const args = [
    "-p",
    "--settings",
    settings,
    "--allowedTools",
    "WebFetch,WebSearch",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "sonnet",
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
    "--model",
    "gpt-5.4-mini",
    "--sandbox",
    "workspace-write",
    "--config",
    "sandbox_workspace_write.network_access=true",
  ];

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

function agentEnvironment(overrides = {}) {
  const allowSshPrompts = process.env.TRANSCRIPTS_ALLOW_SSH_PROMPTS === "1";
  return {
    ...process.env,
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

async function prepareRunEnvironment(provider, dryRun) {
  if (dryRun || provider !== "codex") return { env: agentEnvironment(), cleanup: null };

  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
  const isolatedCodexHome = await mkdtemp(path.join(tmpdir(), "transcript-codex-home-"));
  const isolatedSqliteHome = path.join(isolatedCodexHome, "sqlite");
  await symlinkChildrenExcept(
    codexHome,
    isolatedCodexHome,
    new Set(["AGENTS.md", "AGENTS.override.md", "sqlite"]),
  );
  await mkdir(isolatedSqliteHome);

  return {
    env: agentEnvironment({
      CODEX_HOME: isolatedCodexHome,
      CODEX_SQLITE_HOME: isolatedSqliteHome,
    }),
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
    const text = item.text.trim();
    if (state.codexAgentMessageTexts.has(text)) return;
    state.codexAgentMessageTexts.add(text);
    out.push(`⏺ ${text}`);
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

async function runCommand(
  { command, args },
  cwd,
  dryRun,
  env = process.env,
  progressLabel = null,
  onStdoutLine = null,
) {
  if (dryRun) {
    return { stdout: "", stderr: "", status: 0, dryRunCommand: [command, ...args].map(shellQuote).join(" ") };
  }

  return await new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let pendingStdout = "";
    let stderr = "";
    let lastOutputAt = Date.now();
    const startedAt = lastOutputAt;

    const heartbeat = setInterval(() => {
      if (!progressLabel) return;
      const elapsed = Date.now() - startedAt;
      const idle = Date.now() - lastOutputAt;
      if (idle >= 30000) {
        process.stderr.write(`⏳ ${progressLabel} still running after ${formatDuration(elapsed)} (${formatDuration(idle)} idle)\n`);
        lastOutputAt = Date.now();
      }
    }, 30000);

    child.stdout.on("data", (data) => {
      lastOutputAt = Date.now();
      const text = data.toString();
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
      stderr += data.toString();
      process.stderr.write(data);
    });
    child.on("error", (error) => {
      clearInterval(heartbeat);
      resolve({ stdout, stderr: `${stderr}${error.message}\n`, status: 127, error });
    });
    child.on("close", (status) => {
      clearInterval(heartbeat);
      if (onStdoutLine && pendingStdout) onStdoutLine(pendingStdout);
      resolve({ stdout, stderr, status });
    });
  });
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
    if (tree.stdout.trim() === headTree.stdout.trim()) return "HEAD";

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

async function prepareRunWorktree(run, args, env, dryRunCommands) {
  const placeholder = "$RUN_WORKTREE";
  const addCommand = {
    command: "git",
    args: ["-C", args.rustRepo, "worktree", "add", "--detach", placeholder, args.inputRevision],
  };

  if (args.dryRun) {
    dryRunCommands.push(commandText(addCommand));
    return {
      cwd: placeholder,
      cleanup: async () => {
        dryRunCommands.push(
          commandText({
            command: "git",
            args: ["-C", args.rustRepo, "worktree", "remove", "--force", placeholder],
          }),
        );
      },
    };
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-worktree-"));
  const worktree = path.join(tempDir, "checkout");
  const actualAddCommand = {
    ...addCommand,
    args: ["-C", args.rustRepo, "worktree", "add", "--detach", worktree, args.inputRevision],
  };

  try {
    await runCheckedCommand(actualAddCommand, args.rustRepo, env, `${run.name} (${run.provider}) worktree setup`);
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return {
    cwd: worktree,
    cleanup: async () => {
      const removeResult = await runCommand(
        {
          command: "git",
          args: ["-C", args.rustRepo, "worktree", "remove", "--force", worktree],
        },
        args.rustRepo,
        false,
        env,
      );
      await rm(tempDir, { recursive: true, force: true });
      if (removeResult.status !== 0) {
        throw new Error(
          `${run.name} (${run.provider}) worktree cleanup failed with status ${removeResult.status}${
            removeResult.stderr.trim() ? `\n${removeResult.stderr.trim()}` : ""
          }`,
        );
      }
    },
  };
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

async function runScenario(run, args) {
  if (!Array.isArray(run.turns) || run.turns.length === 0) throw new Error(`Run ${run.name} needs turns`);

  const transcript = [];
  const dryRunCommands = [];
  const state = {
    turnIndex: 0,
    threadId: null,
    claudeSessionId: null,
    claudeSawAssistantText: false,
    codexAgentMessageTexts: new Set(),
  };
  const runEnvironment = await prepareRunEnvironment(run.provider, args.dryRun);
  let runWorktree = null;

  try {
    runWorktree = await prepareRunWorktree(run, args, runEnvironment.env, dryRunCommands);
    await applyScenarioSetup(run, runWorktree.cwd, args, runEnvironment.env, dryRunCommands);

    for (const [turnIndex, turn] of run.turns.entries()) {
      const progressLabel = `${run.name} (${run.provider}) turn ${turnIndex + 1}/${run.turns.length}`;
      state.claudeSawAssistantText = false;
      state.codexAgentMessageTexts.clear();
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
      const result = await runCommand(
        command,
        runWorktree.cwd,
        args.dryRun,
        runEnvironment.env,
        args.progress && !args.dryRun ? progressLabel : null,
        args.dryRun ? null : collectOutputLine,
      );
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
        if (result.stderr.trim()) transcript.push("", "```text", result.stderr.trim(), "```");
        break;
      }

      transcript.push("");
      state.turnIndex += 1;
    }
  } finally {
    try {
      await runWorktree?.cleanup?.();
    } finally {
      await runEnvironment.cleanup?.();
    }
  }

  if (args.dryRun) {
    console.error([`\n==> ${run.name} (${run.provider})`, ...dryRunCommands].join("\n"));
    return;
  }

  const outDir = path.resolve(run.name);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, `${run.provider}.md`), `${transcript.join("\n").trim()}\n`);
}

async function discoverScenarios(args) {
  const entries = await readdir(".", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => args.only.size === 0 || args.only.has(name))
    .filter((name) => !args.skips.has(name))
    .sort();

  const scenarios = [];
  for (const name of dirs) {
    try {
      const scenarioPath = path.join(name, "scenario.json");
      const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
      const setup = validateScenarioSetup(name, scenario.setup);
      scenarios.push({ name, turns: scenario.turns, setup });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Failed to read ${name}/scenario.json: ${error.message}`);
    }
  }

  return scenarios;
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
  const jobs = Math.min(args.jobs, runs.length);
  const totalRuns = runs.length;

  async function worker() {
    while (nextRunIndex < runs.length) {
      const runIndex = nextRunIndex;
      const run = runs[runIndex];
      nextRunIndex += 1;
      if (!args.dryRun && args.progress) console.error(`\n==> [${runIndex + 1}/${totalRuns}] ${run.name} (${run.provider})`);
      else if (!args.dryRun) console.error(`\n==> ${run.name} (${run.provider})`);
      await runScenario(run, args);
      completedRuns += 1;
      if (!args.dryRun && args.progress) {
        console.error(`✓ [${completedRuns}/${totalRuns}] ${run.name} (${run.provider}) done`);
      }
    }
  }

  await Promise.all(Array.from({ length: jobs }, () => worker()));
}

async function main() {
  const args = parseArgs(process.argv);
  args.inputRevision = "$INPUT_REVISION";
  if (!args.dryRun) {
    const rustRepoStat = await stat(args.rustRepo).catch(() => null);
    if (!rustRepoStat?.isDirectory()) throw new Error(`--rust-repo is not a directory: ${args.rustRepo}`);
    const gitCheck = await runCommand(
      { command: "git", args: ["-C", args.rustRepo, "rev-parse", "--show-toplevel"] },
      args.rustRepo,
      false,
      agentEnvironment(),
    );
    if (gitCheck.status !== 0) throw new Error(`--rust-repo is not a Git repository: ${args.rustRepo}`);
    args.inputRevision = await snapshotInputRevision(args, agentEnvironment());
  }
  const scenarios = await discoverScenarios(args);

  if (scenarios.length === 0) throw new Error("No matching scenarios");

  const runs = scenarios.flatMap((scenario) => args.providers.map((provider) => ({ ...scenario, provider })));
  await runAll(runs, args);
}

main().catch((error) => {
  console.error(error.message);
  usage();
  process.exit(1);
});
