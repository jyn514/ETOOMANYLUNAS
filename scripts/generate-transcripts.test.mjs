import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { test as nodeTest } from "node:test";
import { fileURLToPath } from "node:url";

const sourceScripts = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(sourceScripts);
const tests = [];
let fixtureTemplate = null;

function test(name, body) {
  tests.push({ name, body });
}

async function readAnnotations() {
  return JSON.parse(await readFile(path.join(repositoryRoot, "transcript-annotations.json"), "utf8"));
}

async function transcriptPaths() {
  const transcripts = [];
  const entries = await readdir(repositoryRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const files = await readdir(path.join(repositoryRoot, entry.name), { withFileTypes: true });
    if (!files.some((file) => file.isFile() && file.name === "scenario.json")) continue;

    for (const file of files) {
      if (file.isFile() && file.name.endsWith(".md")) transcripts.push(`${entry.name}/${file.name}`);
    }
  }

  return transcripts.sort();
}

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function executeAsync(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => resolve({ status: 127, stdout, stderr: `${stderr}${error.message}\n`, error }));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function git(repo, ...args) {
  const result = execute("git", ["-C", repo, ...args]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function makeFixtureTemplate(t) {
  const root = await mkdtemp(path.join(tmpdir(), "generate-transcripts-template-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const rustRepo = path.join(root, "rust");
  const scenarios = path.join(root, "scenarios");
  const codexHome = path.join(root, "codex-home");
  await mkdir(rustRepo);
  await mkdir(scenarios);
  await mkdir(codexHome);
  await mkdir(path.join(scenarios, "scripts"));
  const runner = path.join(scenarios, "scripts", "generate-transcripts.mjs");
  await copyFile(path.join(sourceScripts, "generate-transcripts.mjs"), runner);
  await copyFile(path.join(sourceScripts, "claude-settings.json"), path.join(scenarios, "scripts", "claude-settings.json"));
  await copyFile(path.join(sourceScripts, "transcript.rules"), path.join(scenarios, "scripts", "transcript.rules"));
  git(scenarios, "init");
  git(scenarios, "config", "user.name", "Test User");
  git(scenarios, "config", "user.email", "test@example.invalid");
  git(scenarios, "add", "scripts");
  git(scenarios, "commit", "-m", "Harness");
  git(rustRepo, "init");
  git(rustRepo, "config", "user.name", "Test User");
  git(rustRepo, "config", "user.email", "test@example.invalid");
  git(rustRepo, "config", "status.showUntrackedFiles", "normal");
  await writeFile(path.join(rustRepo, "base.txt"), "base\n");
  await mkdir(path.join(rustRepo, "library", "backtrace"), { recursive: true });
  await mkdir(path.join(rustRepo, "src", "tools", "cargo"), { recursive: true });
  await writeFile(path.join(rustRepo, "library", "backtrace", ".keep"), "");
  await writeFile(path.join(rustRepo, "src", "tools", "cargo", ".keep"), "");
  git(rustRepo, "add", "base.txt", "library/backtrace/.keep", "src/tools/cargo/.keep");
  git(rustRepo, "commit", "-m", "Base");

  const fakeCodex = path.join(root, "fake-codex.mjs");
  await writeFile(
    fakeCodex,
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
if (process.argv.includes("--version")) {
  console.log("fake-codex 1.0");
  process.exit(0);
}
if (process.env.FAIL_PROVIDER === "1") process.exit(7);
const fixture = existsSync("fixture.txt") ? readFileSync("fixture.txt", "utf8").trim() : "missing";
const command = existsSync("command.txt") ? readFileSync("command.txt", "utf8").trim() : "missing";
const subject = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim();
const callerState = ["base.txt", "AGENTS.md", ".claude/rules.md"]
  .map((file) => existsSync(file) ? readFileSync(file, "utf8").trim() : "missing")
  .join(",");
const sqliteIsIsolated =
  process.env.CODEX_SQLITE_HOME === process.env.CODEX_HOME + ${JSON.stringify(path.sep)} + "sqlite";
const cargoTargetDirIsUnset = !("CARGO_TARGET_DIR" in process.env);
let cargoHomeIsWritable = false;
try {
  writeFileSync(process.env.CARGO_HOME + ${JSON.stringify(path.sep)} + "write-check", "ok");
  cargoHomeIsWritable = true;
} catch {}
if (process.env.DESCENDANT_PID_FILE) {
  const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  descendant.unref();
  writeFileSync(process.env.DESCENDANT_PID_FILE, String(descendant.pid));
}
writeFileSync("agent-change.txt", fixture);
console.log(JSON.stringify({ type: "thread.started", thread_id: "fixture-thread" }));
if (process.env.EMIT_COMMANDS === "1") {
  console.log(JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: "printf one " + process.cwd() + "\\nprintf two" }
  }));
  console.log(JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: "printf '\u0060\u0060\u0060'" }
  }));
}
console.log(JSON.stringify({
  type: "item.completed",
  item: {
    type: "agent_message",
    text: [fixture, command, subject, sqliteIsIsolated, callerState, \`cargo-target-unset=\${cargoTargetDirIsUnset}\`, \`cargo-home-writable=\${cargoHomeIsWritable}\`].join("|")
  }
}));
if (process.env.EMIT_LOCAL_LINK === "1") {
  console.log(JSON.stringify({
    type: "item.completed",
    item: {
      type: "agent_message",
      text: "Read [sandbox](sandbox:/private/tmp/transcript-worktree/checkout/src/file.rs#L4), [file](file://" + process.cwd() + "/src/file.rs#L4), and [checkout](" + process.cwd() + "/src/file.rs#L4)."
    }
  }));
}
if (process.env.EMIT_COMMANDS === "1") {
  console.log(JSON.stringify({
    type: "item.completed",
    item: { type: "file_change", change_type: "Edit", path: process.cwd() + "/src/file.rs" }
  }));
  console.log(JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: "printf three" }
  }));
}
`,
  );
  await chmod(fakeCodex, 0o755);

  const fakeClaude = path.join(root, "fake-claude.mjs");
  await writeFile(
    fakeClaude,
    `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  console.log("fake-claude 1.0");
  process.exit(0);
}
const settingsIndex = process.argv.indexOf("--settings");
console.log(JSON.stringify({
  type: "assistant",
  message: { content: [{
    type: "text",
    text: JSON.stringify({
      configDir: process.env.CLAUDE_CONFIG_DIR,
      settingSources: process.argv[process.argv.indexOf("--setting-sources") + 1],
      globalInstructionsExcluded: JSON.parse(process.argv[settingsIndex + 1]).claudeMdExcludes.includes(
        process.env.CLAUDE_CONFIG_DIR + "/CLAUDE.md",
      ),
      ghIssueAllowed: JSON.parse(process.argv[settingsIndex + 1]).permissions.allow.includes("Bash(gh issue view *)"),
      slashCommandsDisabled: process.argv.includes("--disable-slash-commands"),
      strictMcp: process.argv.includes("--strict-mcp-config"),
    }),
  }] },
}));
console.log(JSON.stringify({ type: "result", subtype: "success", result: "done" }));
`,
  );
  await chmod(fakeClaude, 0o755);

  return { root, rustRepo, scenarios, codexHome, fakeClaude, fakeCodex, runner };
}

async function makeFixture(t) {
  assert(fixtureTemplate);
  const root = await mkdtemp(path.join(tmpdir(), "generate-transcripts-test-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const rustRepo = path.join(root, "rust");
  const scenarios = path.join(root, "scenarios");
  const codexHome = path.join(root, "codex-home");
  await Promise.all([
    cp(fixtureTemplate.rustRepo, rustRepo, { recursive: true }),
    cp(fixtureTemplate.scenarios, scenarios, { recursive: true }),
    mkdir(codexHome),
  ]);

  return {
    root,
    rustRepo,
    scenarios,
    codexHome,
    fakeClaude: fixtureTemplate.fakeClaude,
    fakeCodex: fixtureTemplate.fakeCodex,
    runner: path.join(scenarios, "scripts", "generate-transcripts.mjs"),
  };
}

async function writeScenario(scenarios, name, command = "printf command > command.txt", prompt = `Run ${name}`) {
  const scenarioDir = path.join(scenarios, name);
  await mkdir(scenarioDir);
  const setup = {
    patch: "setup.patch",
    commit: { message: `Fixture ${name}` },
  };
  if (command !== null) setup.commands = [command];
  await writeFile(
    path.join(scenarioDir, "scenario.json"),
    JSON.stringify({
      setup,
      turns: [{ prompt }],
    }),
  );
  await writeFile(
    path.join(scenarioDir, "setup.patch"),
    `diff --git a/fixture.txt b/fixture.txt
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/fixture.txt
@@ -0,0 +1 @@
+${name}
`,
  );
}

nodeTest("annotations cover every generated transcript", async () => {
  const document = await readAnnotations();
  assert.equal(document.version, 1);
  assert.deepEqual(Object.keys(document.annotations).sort(), await transcriptPaths());
});

nodeTest("annotation hashes match their transcripts", async () => {
  const { annotations } = await readAnnotations();

  for (const [transcriptPath, annotation] of Object.entries(annotations)) {
    const transcript = await readFile(path.join(repositoryRoot, transcriptPath));
    const actual = createHash("sha256").update(transcript).digest("hex");
    assert.equal(actual, annotation.sha256, transcriptPath);
  }
});

test("one invocation renders and isolates selected scenarios", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(
    fixture.scenarios,
    "reviewed",
    "printf command > command.txt",
    "{{reviewer}} is reviewing this.",
  );
  await writeScenario(fixture.scenarios, "linked");
  const noSetupDir = path.join(fixture.scenarios, "no-setup");
  await mkdir(noSetupDir);
  await writeFile(path.join(noSetupDir, "scenario.json"), JSON.stringify({ turns: [{ prompt: "No setup" }] }));
  await writeScenario(fixture.scenarios, "selected-alpha");
  await writeScenario(fixture.scenarios, "skipped-beta");
  await writeScenario(fixture.scenarios, "selected-gamma");
  await writeScenario(fixture.scenarios, "parallel-alpha");
  await writeScenario(fixture.scenarios, "parallel-beta", "test -f fixture.txt && printf command > command.txt");
  await writeScenario(fixture.scenarios, "live");
  await writeScenario(fixture.scenarios, "local-link");
  const selected = [
    "reviewed",
    "linked",
    "no-setup",
    "selected-alpha",
    "selected-gamma",
    "parallel-alpha",
    "parallel-beta",
    "live",
    "local-link",
  ];
  const rustRevision = git(fixture.rustRepo, "rev-parse", "HEAD");

  const result = await runGenerator({
    ...fixture,
    extraArgs: [
      "--reviewer",
      "Esteban",
      "--jobs",
      "2",
      "--progress",
      ...selected.flatMap((name) => ["--only", name]),
    ],
    extraEnv: {
      CARGO_TARGET_DIR: path.join(fixture.root, "external-target"),
      EMIT_LOCAL_LINK: "1",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(fixture.scenarios, "reviewed", "codex.md"), "utf8"), /Esteban is reviewing this/);
  const metadata = JSON.parse(await readFile(path.join(fixture.scenarios, "reviewed", "codex.meta.json"), "utf8"));
  assert.equal(metadata.reviewer, "Esteban");
  assert.equal(metadata.rust_revision, rustRevision);
  assert.equal(metadata.version, 2);
  assert.equal(metadata.turns.length, 1);
  assert.equal(metadata.turns[0].turn, 1);
  assert.equal(metadata.turns[0].status, 0);
  assert.equal(Number.isInteger(metadata.turns[0].duration_ms), true);
  const transcript = await readFile(path.join(fixture.scenarios, "linked", "codex.md"), "utf8");
  assert.match(
    transcript,
    /^\[Fixture\]\(scenario\.json\) · \[Setup patch\]\(setup\.patch\) · \[Run metadata\]\(codex\.meta\.json\)\n\n❯/,
  );
  const noSetupTranscript = await readFile(path.join(noSetupDir, "codex.md"), "utf8");
  assert.match(noSetupTranscript, /^\[Run metadata\]\(codex\.meta\.json\)\n\n❯/);
  assert.doesNotMatch(noSetupTranscript, /\[Fixture\]|\[Setup patch\]/);
  await readFile(path.join(fixture.scenarios, "selected-alpha", "codex.md"));
  await readFile(path.join(fixture.scenarios, "selected-gamma", "codex.md"));
  await assert.rejects(readFile(path.join(fixture.scenarios, "skipped-beta", "codex.md")), { code: "ENOENT" });
  assert.match(await readFile(path.join(fixture.scenarios, "parallel-alpha", "codex.md"), "utf8"), /parallel-alpha\|command\|Fixture parallel-alpha\|true/);
  assert.match(await readFile(path.join(fixture.scenarios, "parallel-beta", "codex.md"), "utf8"), /parallel-beta\|command\|Fixture parallel-beta\|true/);
  assert.match(await readFile(path.join(fixture.scenarios, "parallel-alpha", "codex.md"), "utf8"), /cargo-target-unset=true/);
  assert.match(await readFile(path.join(fixture.scenarios, "parallel-alpha", "codex.md"), "utf8"), /cargo-home-writable=true/);
  assert.match(result.stderr, /⏺ live\|command\|Fixture live\|true/);
  const liveTranscript = await readFile(path.join(fixture.scenarios, "live", "codex.md"), "utf8");
  assert.equal(liveTranscript.match(/live\|command\|Fixture live\|true/g)?.length, 1);
  const localLinkTranscript = await readFile(path.join(fixture.scenarios, "local-link", "codex.md"), "utf8");
  assert.match(localLinkTranscript, /Read sandbox, file, and checkout\./);
  assert.match(localLinkTranscript, /cargo-home-writable=true\n\n⏺ Read sandbox, file, and checkout\./);
  assert.doesNotMatch(localLinkTranscript, /sandbox:|file:\/\/|transcript-worktree|\$CHECKOUT/);
  assert.equal(git(fixture.rustRepo, "status", "--porcelain"), "");
  await assert.rejects(readFile(path.join(fixture.rustRepo, "fixture.txt")), { code: "ENOENT" });
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("reviewer placeholders require --reviewer", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(
    fixture.scenarios,
    "reviewed",
    "printf command > command.txt",
    "{{reviewer}} is reviewing this.",
  );

  const result = await runGenerator(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--reviewer is required by scenario: reviewed/);
});

function runGenerator({
  root,
  scenarios,
  rustRepo,
  codexHome,
  fakeClaude,
  fakeCodex,
  runner,
  provider = "codex",
  extraArgs = [],
  extraEnv = {},
}) {
  return executeAsync(
    process.execPath,
    [
      runner,
      "--rust-repo",
      rustRepo,
      "--provider",
      provider,
      "--no-progress",
      ...extraArgs,
    ],
    {
      cwd: scenarios,
      env: {
        ...process.env,
        CODEX_BIN: fakeCodex,
        CODEX_HOME: codexHome,
        CLAUDE_BIN: fakeClaude,
        TRANSCRIPTS_BOOTSTRAP_CACHE: path.join(root, "bootstrap-cache"),
        TRANSCRIPTS_CARGO_HOME: path.join(root, "cargo-home"),
        ...extraEnv,
      },
    },
  );
}

test("Claude runs preserve auth location without loading caller customization", async (t) => {
  const fixture = await makeFixture(t);
  const claudeConfigDir = path.join(fixture.root, "claude-config");
  await mkdir(claudeConfigDir);
  await writeScenario(fixture.scenarios, "claude-isolation");

  const result = await runGenerator({
    ...fixture,
    provider: "claude",
    extraEnv: { CLAUDE_CONFIG_DIR: claudeConfigDir },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(fixture.scenarios, "claude-isolation", "claude.md"), "utf8"),
    new RegExp(
      `"configDir":"${claudeConfigDir}",` +
      `"settingSources":"project,local",` +
      `"globalInstructionsExcluded":true,"ghIssueAllowed":true,` +
      `"slashCommandsDisabled":true,"strictMcp":true`,
    ),
  );
});

test("a scenario cannot be selected and skipped", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta");

  const result = await runGenerator({
    ...fixture,
    extraArgs: ["--only", "alpha", "--only", "beta", "--skip", "alpha"],
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Scenario cannot be both --only and --skip: alpha/);
});

test("a worker reuses its clean checkout between scenarios", async (t) => {
  const fixture = await makeFixture(t);
  const checkoutRecord = path.join(fixture.root, "worker-checkout");
  await writeScenario(fixture.scenarios, "alpha", `printf '%s\\n' "$PWD" > ${checkoutRecord}`);
  await writeScenario(
    fixture.scenarios,
    "beta",
    `test "$PWD" = "$(cat ${checkoutRecord})" && test ! -e agent-change.txt && printf command > command.txt`,
  );

  const result = await runGenerator({ ...fixture, extraArgs: ["--jobs", "1"] });

  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(fixture.scenarios, "beta", "codex.md"), "utf8"), /beta\|command\|Fixture beta/);
});

test("provider descendants are terminated before a worker checkout is reused", async (t) => {
  const fixture = await makeFixture(t);
  const descendantPidFile = path.join(fixture.root, "descendant-pid");
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta");

  const result = await runGenerator({
    ...fixture,
    extraArgs: ["--jobs", "1"],
    extraEnv: { DESCENDANT_PID_FILE: descendantPidFile },
  });

  assert.equal(result.status, 0, result.stderr);
  const descendantPid = Number(await readFile(descendantPidFile, "utf8"));
  assert.throws(() => process.kill(descendantPid, 0), { code: "ESRCH" });
});

test("runs include current agent instructions but not unrelated checkout changes", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "dirty-input");
  await writeFile(path.join(fixture.rustRepo, "base.txt"), "modified\n");
  await writeFile(path.join(fixture.rustRepo, "AGENTS.md"), "agent instructions\n");
  await mkdir(path.join(fixture.rustRepo, ".claude"));
  await writeFile(path.join(fixture.rustRepo, ".claude", "rules.md"), "claude instructions\n");

  const result = await runGenerator({ ...fixture });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(fixture.scenarios, "dirty-input", "codex.md"), "utf8"),
    /base,agent instructions,claude instructions/,
  );
  assert.equal(
    git(fixture.rustRepo, "status", "--porcelain"),
    "M base.txt\n?? .claude/\n?? AGENTS.md",
  );
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("snapshotting ignores broken submodule worktrees", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "broken-submodule");
  const head = git(fixture.rustRepo, "rev-parse", "HEAD");
  git(fixture.rustRepo, "rm", "-r", "--cached", "library/backtrace");
  git(fixture.rustRepo, "update-index", "--add", "--cacheinfo", `160000,${head},library/backtrace`);
  await writeFile(
    path.join(fixture.rustRepo, ".gitmodules"),
    `[submodule "library/backtrace"]\n\tpath = library/backtrace\n\turl = ${fixture.rustRepo}\n`,
  );
  git(fixture.rustRepo, "add", ".gitmodules");
  git(fixture.rustRepo, "commit", "-m", "Add submodule gitlink");
  const submodule = path.join(fixture.rustRepo, "library", "backtrace");
  await mkdir(submodule, { recursive: true });
  await writeFile(path.join(submodule, ".git"), "gitdir: ../../../missing/modules/library/backtrace\n");
  await writeFile(path.join(fixture.rustRepo, "AGENTS.md"), "agent instructions\n");

  const result = await runGenerator({ ...fixture, extraEnv: { GIT_ALLOW_PROTOCOL: "file" } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(fixture.scenarios, "broken-submodule", "codex.md"), "utf8"),
    /base,agent instructions,missing/,
  );
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("a failing setup command is reported and its worktree is removed", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "broken", "! true");

  const result = await runGenerator({ ...fixture });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken \(codex\) setup command/);
  assert.match(result.stderr, /failed with status 1/);
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("a provider failure is recorded and its worktree is removed", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "provider-failure");

  const result = await runGenerator({ ...fixture, extraEnv: { FAIL_PROVIDER: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(fixture.scenarios, "provider-failure", "codex.md"), "utf8"),
    /codex exited with status 7/,
  );
  const metadata = JSON.parse(await readFile(path.join(fixture.scenarios, "provider-failure", "codex.meta.json"), "utf8"));
  assert.equal(metadata.turns.length, 1);
  assert.equal(metadata.turns[0].status, 7);
  assert.equal(Number.isInteger(metadata.turns[0].duration_ms), true);
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("rendered transcripts match the golden Markdown fixture", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "commands");

  const result = await runGenerator({ ...fixture, extraEnv: { EMIT_COMMANDS: "1" } });
  assert.equal(result.status, 0, result.stderr);

  const transcript = await readFile(path.join(fixture.scenarios, "commands", "codex.md"), "utf8");
  const expected = await readFile(path.join(sourceScripts, "fixtures", "commands-transcript.md"), "utf8");
  assert.equal(transcript, expected);
});

test("invalid setup schemas fail before creating a worktree", async (t) => {
  const fixture = await makeFixture(t);
  const scenarioDir = path.join(fixture.scenarios, "invalid");
  await mkdir(scenarioDir);
  await writeFile(
    path.join(scenarioDir, "scenario.json"),
    JSON.stringify({ setup: { commands: "not-an-array" }, turns: [{ prompt: "Never runs" }] }),
  );

  const result = await runGenerator({ ...fixture });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /setup\.commands must be an array of non-empty strings/);
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("dry runs include setup commands without requiring or changing a repository", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "dry", null);

  const missingRepo = path.join(fixture.root, "missing-rust");
  const result = await runGenerator({
    ...fixture,
    rustRepo: missingRepo,
    extraArgs: ["--dry-run"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /git.*clone.*--shared.*--no-checkout.*\$RUN_WORKTREE/);
  assert.match(result.stderr, /git.*checkout.*--detach.*\$INPUT_REVISION/);
  assert.match(result.stderr, /git.*apply.*--index.*setup\.patch/);
  assert.doesNotMatch(result.stderr, /'git' 'add' '--all'/);
  assert.match(result.stderr, /git.*commit.*Fixture dry/);
  await assert.rejects(readFile(path.join(fixture.scenarios, "dry", "codex.md")), { code: "ENOENT" });
});

nodeTest("generate transcripts", { concurrency: 4 }, async (t) => {
  fixtureTemplate = await makeFixtureTemplate(t);
  await Promise.all(tests.map(({ name, body }) => t.test(name, body)));
});
