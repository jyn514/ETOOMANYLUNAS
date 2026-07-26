#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { clearInterval, setInterval } from "node:timers";
import { randomUUID } from "node:crypto";

const PROVIDER_MODELS = {
  claude: "claude-sonnet-5",
  codex: "gpt-5.4-mini",
};

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
    "--model",
    PROVIDER_MODELS.codex,
    "--sandbox",
    "workspace-write",
    "--add-dir",
    run.bootstrapCachePath,
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
  const isolatedRulesDir = path.join(isolatedCodexHome, "rules");
  await symlinkChildrenExcept(
    codexHome,
    isolatedCodexHome,
    new Set(["AGENTS.md", "AGENTS.override.md", "rules", "sqlite"]),
  );
  await mkdir(isolatedSqliteHome);
  await mkdir(isolatedRulesDir);
  await writeFile(
    path.join(isolatedRulesDir, "transcript.rules"),
    await readFile(new URL("transcript.rules", import.meta.url)),
  );

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
    out.push(`⏺ Command(${item.command})`);
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

async function snapshotHarnessRevision(args, scenarios, env) {
  if (args.dryRun) return "$HARNESS_REVISION";

  const inputPaths = new Set(["scripts/generate-transcripts.mjs", "scripts/transcript.rules"]);
  for (const scenario of scenarios) {
    inputPaths.add(path.join(scenario.name, "scenario.json"));
    if (scenario.setup?.patch) {
      const relativePatch = path.relative(process.cwd(), scenario.setup.patch);
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
      process.cwd(),
      snapshotEnv,
      "harness snapshot HEAD discovery",
    );
    await runCheckedCommand(
      { command: "git", args: ["read-tree", head.stdout.trim()] },
      process.cwd(),
      snapshotEnv,
      "harness snapshot initialization",
    );
    await runCheckedCommand(
      {
        command: "git",
        args: ["add", "--all", "--", ...[...inputPaths].sort().map((inputPath) => `:(top,literal)${inputPath}`)],
      },
      process.cwd(),
      snapshotEnv,
      "harness snapshot staging",
    );
    const tree = await runCheckedCommand(
      { command: "git", args: ["write-tree"] },
      process.cwd(),
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
      process.cwd(),
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

async function prepareCheckoutTemplate(args, env) {
  if (args.dryRun || process.platform !== "darwin") return null;

  const tempDir = await mkdtemp(path.join(tmpdir(), "transcript-template-"));
  const checkout = path.join(tempDir, "checkout");
  try {
    await runCheckedCommand(
      { command: "git", args: ["clone", "--shared", "--no-checkout", args.rustRepo, checkout] },
      args.rustRepo,
      env,
      "checkout template clone",
    );
    await runCheckedCommand(
      { command: "git", args: ["-C", checkout, "checkout", "--detach", args.inputRevision] },
      checkout,
      env,
      "checkout template setup",
    );
    await runCheckedCommand(
      {
        command: "git",
        args: ["submodule", "update", "--init", "--depth", "1", "--", "library/backtrace", "src/tools/cargo"],
      },
      checkout,
      env,
      "checkout template submodule setup",
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
    "library/backtrace",
    "src/tools/cargo",
  ];
  const submoduleCommand = {
    command: "git",
    args: ["-C", placeholder, ...submoduleArgs],
  };

  if (args.dryRun) {
    dryRunCommands.push(commandText(cloneCommand), commandText(checkoutCommand), commandText(submoduleCommand));
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
    let copiedTemplate = false;
    if (args.checkoutTemplate) {
      const copyResult = await runCommand(
        { command: "cp", args: ["-cR", args.checkoutTemplate, worktree] },
        tempDir,
        false,
        env,
      );
      copiedTemplate = copyResult.status === 0;
      if (copiedTemplate) {
        const refreshResult = await runCommand(
          { command: "git", args: ["update-index", "--refresh"] },
          worktree,
          false,
          env,
        );
        copiedTemplate = refreshResult.status === 0;
      }
      if (!copiedTemplate) await rm(worktree, { recursive: true, force: true });
    }
    if (!copiedTemplate) {
      await runCheckedCommand(actualCloneCommand, args.rustRepo, env, `${run.name} (${run.provider}) clone setup`);
      await runCheckedCommand(actualCheckoutCommand, worktree, env, `${run.name} (${run.provider}) checkout setup`);
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
  let runCheckout = null;

  try {
    runCheckout = await prepareRunCheckout(run, args, runEnvironment.env, dryRunCommands);
    await applyScenarioSetup(run, runCheckout.cwd, args, runCheckout.env, dryRunCommands);

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
        runCheckout.cwd,
        args.dryRun,
        runCheckout.env,
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
      await runCheckout?.cleanup?.();
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
  await Promise.all([
    writeFile(path.join(outDir, `${run.provider}.md`), `${transcript.join("\n").trim()}\n`),
    writeFile(
      path.join(outDir, `${run.provider}.meta.json`),
      `${JSON.stringify(
        {
          version: 1,
          generated_at: new Date().toISOString(),
          provider: run.provider,
          model: PROVIDER_MODELS[run.provider],
          provider_version: args.providerVersions[run.provider],
          harness_revision: args.harnessRevision,
          rust_revision: args.inputRevision,
        },
        null,
        2,
      )}\n`,
    ),
  ]);
}

async function discoverScenarios(args) {
  const entries = await readdir(".", { withFileTypes: true });
  const directoryNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const scenarioDirs = new Set(
    (
      await Promise.all(
        directoryNames.map(async (name) => {
          const scenarioStat = await stat(path.join(name, "scenario.json")).catch((error) => {
            if (error.code === "ENOENT") return null;
            throw error;
          });
          return scenarioStat?.isFile() ? name : null;
        }),
      )
    ).filter((name) => name !== null),
  );
  const unknownOnly = [...args.only].filter((name) => !scenarioDirs.has(name));
  if (unknownOnly.length > 0) {
    throw new Error(`Unknown --only scenario${unknownOnly.length === 1 ? "" : "s"}: ${unknownOnly.join(", ")}`);
  }

  const dirs = [...scenarioDirs]
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
  const failures = [];
  const jobs = Math.min(args.jobs, runs.length);
  const totalRuns = runs.length;

  async function worker() {
    while (nextRunIndex < runs.length) {
      const runIndex = nextRunIndex;
      const run = runs[runIndex];
      nextRunIndex += 1;
      if (!args.dryRun && args.progress) console.error(`\n==> [${runIndex + 1}/${totalRuns}] ${run.name} (${run.provider})`);
      else if (!args.dryRun) console.error(`\n==> ${run.name} (${run.provider})`);
      try {
        await runScenario(run, args);
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
  const scenarios = await discoverScenarios(args);
  if (scenarios.length === 0) throw new Error("No matching scenarios");
  args.harnessRevision = await snapshotHarnessRevision(args, scenarios, agentEnvironment());
  args.providerVersions = await collectProviderVersions(args, agentEnvironment());

  const cacheRoot = process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache");
  args.bootstrapCachePath = path.resolve(
    process.env.TRANSCRIPTS_BOOTSTRAP_CACHE ?? path.join(cacheRoot, "definitely-not-rust", "bootstrap"),
  );
  args.inputRevision = "$INPUT_REVISION";
  if (!args.dryRun) {
    await mkdir(args.bootstrapCachePath, { recursive: true });
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

  const template = await prepareCheckoutTemplate(args, agentEnvironment());
  args.checkoutTemplate = template?.checkout ?? null;
  try {
    const runs = scenarios.flatMap((scenario) =>
      args.providers.map((provider) => ({ ...scenario, provider, bootstrapCachePath: args.bootstrapCachePath })),
    );
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
