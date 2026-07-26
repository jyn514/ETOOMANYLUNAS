import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "generate-transcripts.mjs");

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

function git(repo, ...args) {
  const result = execute("git", ["-C", repo, ...args]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function makeFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "generate-transcripts-test-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const rustRepo = path.join(root, "rust");
  const scenarios = path.join(root, "scenarios");
  await mkdir(rustRepo);
  await mkdir(scenarios);
  git(rustRepo, "init");
  git(rustRepo, "config", "user.name", "Test User");
  git(rustRepo, "config", "user.email", "test@example.invalid");
  git(rustRepo, "config", "status.showUntrackedFiles", "normal");
  await writeFile(path.join(rustRepo, "base.txt"), "base\n");
  git(rustRepo, "add", "base.txt");
  git(rustRepo, "commit", "-m", "Base");

  const fakeCodex = path.join(root, "fake-codex.mjs");
  await writeFile(
    fakeCodex,
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
if (process.env.FAIL_PROVIDER === "1") process.exit(7);
const fixture = readFileSync("fixture.txt", "utf8").trim();
const command = readFileSync("command.txt", "utf8").trim();
const subject = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim();
const callerState = ["base.txt", "AGENTS.md", ".claude/rules.md"]
  .map((file) => existsSync(file) ? readFileSync(file, "utf8").trim() : "missing")
  .join(",");
const sqliteIsIsolated =
  process.env.CODEX_SQLITE_HOME === process.env.CODEX_HOME + ${JSON.stringify(path.sep)} + "sqlite";
writeFileSync("agent-change.txt", fixture);
console.log(JSON.stringify({ type: "thread.started", thread_id: "fixture-thread" }));
console.log(JSON.stringify({
  type: "item.completed",
  item: { type: "agent_message", text: [fixture, command, subject, sqliteIsIsolated, callerState].join("|") }
}));
`,
  );
  await chmod(fakeCodex, 0o755);

  return { root, rustRepo, scenarios, fakeCodex };
}

async function writeScenario(scenarios, name, command = "printf command > command.txt") {
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
      turns: [{ prompt: `Run ${name}` }],
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

function runGenerator({ scenarios, rustRepo, fakeCodex, extraArgs = [], extraEnv = {} }) {
  return execute(
    process.execPath,
    [
      runner,
      "--rust-repo",
      rustRepo,
      "--provider",
      "codex",
      "--no-progress",
      ...extraArgs,
    ],
    {
      cwd: scenarios,
      env: { ...process.env, CODEX_BIN: fakeCodex, ...extraEnv },
    },
  );
}

test("repeated --only flags select multiple scenarios", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta");
  await writeScenario(fixture.scenarios, "gamma");

  const result = runGenerator({
    ...fixture,
    extraArgs: ["--only", "alpha", "--only", "gamma", "--jobs", "2"],
  });

  assert.equal(result.status, 0, result.stderr);
  await readFile(path.join(fixture.scenarios, "alpha", "codex.md"));
  await readFile(path.join(fixture.scenarios, "gamma", "codex.md"));
  await assert.rejects(readFile(path.join(fixture.scenarios, "beta", "codex.md")), { code: "ENOENT" });
});

test("a scenario cannot be selected and skipped", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta");

  const result = runGenerator({
    ...fixture,
    extraArgs: ["--only", "alpha", "--only", "beta", "--skip", "alpha"],
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Scenario cannot be both --only and --skip: alpha/);
});

test("setup state is isolated, committed, and visible to parallel runs", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta", "test -f fixture.txt && printf command > command.txt");
  const rustRevision = git(fixture.rustRepo, "rev-parse", "HEAD");

  const result = runGenerator({ ...fixture, extraArgs: ["--jobs", "2"] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(fixture.scenarios, "alpha", "codex.md"), "utf8"), /alpha\|command\|Fixture alpha\|true/);
  assert.match(await readFile(path.join(fixture.scenarios, "beta", "codex.md"), "utf8"), /beta\|command\|Fixture beta\|true/);
  const metadata = JSON.parse(await readFile(path.join(fixture.scenarios, "alpha", "codex.meta.json"), "utf8"));
  assert.equal(metadata.rust_revision, rustRevision);

  assert.equal(git(fixture.rustRepo, "status", "--porcelain"), "");
  await assert.rejects(readFile(path.join(fixture.rustRepo, "fixture.txt")), { code: "ENOENT" });
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("runs include current agent instructions but not unrelated checkout changes", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "dirty-input");
  await writeFile(path.join(fixture.rustRepo, "base.txt"), "modified\n");
  await writeFile(path.join(fixture.rustRepo, "AGENTS.md"), "agent instructions\n");
  await mkdir(path.join(fixture.rustRepo, ".claude"));
  await writeFile(path.join(fixture.rustRepo, ".claude", "rules.md"), "claude instructions\n");

  const result = runGenerator({ ...fixture });
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
  git(fixture.rustRepo, "update-index", "--add", "--cacheinfo", `160000,${head},library/backtrace`);
  git(fixture.rustRepo, "commit", "-m", "Add submodule gitlink");
  const submodule = path.join(fixture.rustRepo, "library", "backtrace");
  await mkdir(submodule, { recursive: true });
  await writeFile(path.join(submodule, ".git"), "gitdir: ../../../missing/modules/library/backtrace\n");
  await writeFile(path.join(fixture.rustRepo, "AGENTS.md"), "agent instructions\n");

  const result = runGenerator({ ...fixture });
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

  const result = runGenerator({ ...fixture });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken \(codex\) setup command/);
  assert.match(result.stderr, /failed with status 1/);
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("a provider failure is recorded and its worktree is removed", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "provider-failure");

  const result = runGenerator({ ...fixture, extraEnv: { FAIL_PROVIDER: "1" } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    await readFile(path.join(fixture.scenarios, "provider-failure", "codex.md"), "utf8"),
    /codex exited with status 7/,
  );
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("progress mode renders provider events to stderr without duplicating the transcript", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "live");

  const result = runGenerator({ ...fixture, extraArgs: ["--progress"] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /⏺ live\|command\|Fixture live\|true/);

  const transcript = await readFile(path.join(fixture.scenarios, "live", "codex.md"), "utf8");
  assert.equal(transcript.match(/live\|command\|Fixture live\|true/g)?.length, 1);
});

test("invalid setup schemas fail before creating a worktree", async (t) => {
  const fixture = await makeFixture(t);
  const scenarioDir = path.join(fixture.scenarios, "invalid");
  await mkdir(scenarioDir);
  await writeFile(
    path.join(scenarioDir, "scenario.json"),
    JSON.stringify({ setup: { commands: "not-an-array" }, turns: [{ prompt: "Never runs" }] }),
  );

  const result = runGenerator({ ...fixture });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /setup\.commands must be an array of non-empty strings/);
  assert.equal(git(fixture.rustRepo, "worktree", "list", "--porcelain").match(/^worktree /gm)?.length, 1);
});

test("dry runs include setup commands without requiring or changing a repository", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "dry", null);

  const missingRepo = path.join(fixture.root, "missing-rust");
  const result = runGenerator({
    ...fixture,
    rustRepo: missingRepo,
    extraArgs: ["--dry-run"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /worktree.*add.*\$RUN_WORKTREE.*\$INPUT_REVISION/);
  assert.match(result.stderr, /git.*apply.*--index.*setup\.patch/);
  assert.doesNotMatch(result.stderr, /'git' 'add' '--all'/);
  assert.match(result.stderr, /git.*commit.*Fixture dry/);
  await assert.rejects(readFile(path.join(fixture.scenarios, "dry", "codex.md")), { code: "ENOENT" });
});
