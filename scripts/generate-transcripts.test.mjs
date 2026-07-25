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
  await writeFile(path.join(rustRepo, "base.txt"), "base\n");
  git(rustRepo, "add", "base.txt");
  git(rustRepo, "commit", "-m", "Base");

  const fakeCodex = path.join(root, "fake-codex.mjs");
  await writeFile(
    fakeCodex,
    `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
if (process.env.FAIL_PROVIDER === "1") process.exit(7);
const fixture = readFileSync("fixture.txt", "utf8").trim();
const command = readFileSync("command.txt", "utf8").trim();
const subject = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim();
writeFileSync("agent-change.txt", fixture);
console.log(JSON.stringify({ type: "thread.started", thread_id: "fixture-thread" }));
console.log(JSON.stringify({
  type: "item.completed",
  item: { type: "agent_message", text: [fixture, command, subject].join("|") }
}));
`,
  );
  await chmod(fakeCodex, 0o755);

  return { root, rustRepo, scenarios, fakeCodex };
}

async function writeScenario(scenarios, name, command = "printf command > command.txt") {
  const scenarioDir = path.join(scenarios, name);
  await mkdir(scenarioDir);
  await writeFile(
    path.join(scenarioDir, "scenario.json"),
    JSON.stringify({
      setup: {
        patch: "setup.patch",
        commands: [command],
        commit: { message: `Fixture ${name}` },
      },
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

test("setup state is isolated, committed, and visible to parallel runs", async (t) => {
  const fixture = await makeFixture(t);
  await writeScenario(fixture.scenarios, "alpha");
  await writeScenario(fixture.scenarios, "beta", "test -f fixture.txt && printf command > command.txt");

  const result = runGenerator({ ...fixture, extraArgs: ["--jobs", "2"] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(fixture.scenarios, "alpha", "codex.md"), "utf8"), /alpha\|command\|Fixture alpha/);
  assert.match(await readFile(path.join(fixture.scenarios, "beta", "codex.md"), "utf8"), /beta\|command\|Fixture beta/);

  assert.equal(git(fixture.rustRepo, "status", "--porcelain"), "");
  await assert.rejects(readFile(path.join(fixture.rustRepo, "fixture.txt")), { code: "ENOENT" });
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
  await writeScenario(fixture.scenarios, "dry");

  const missingRepo = path.join(fixture.root, "missing-rust");
  const result = runGenerator({
    ...fixture,
    rustRepo: missingRepo,
    extraArgs: ["--dry-run"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /worktree.*add.*\$RUN_WORKTREE/);
  assert.match(result.stderr, /git.*apply.*setup\.patch/);
  assert.match(result.stderr, /git.*commit.*Fixture dry/);
  await assert.rejects(readFile(path.join(fixture.scenarios, "dry", "codex.md")), { code: "ENOENT" });
});
