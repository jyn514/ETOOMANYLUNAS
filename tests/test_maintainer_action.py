"""Fixture checks and an optional native-compiler smoke test through Inspect."""

import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from inspect_ai import eval
from inspect_ai.log import read_eval_log
from inspect_ai.model import ChatMessageTool, ModelOutput, ModelUsage, get_model
import yaml

from maintainer_action import CASES, FIXTURES, NIGHTLY, PROMPT, ROOT, SKILL, maintainer_action, samples
from maintainer_web import canonical_url, documents, open_page, search_pages


class MaintainerActionTests(unittest.TestCase):
    def test_four_cases_have_the_same_brief_request(self):
        dataset = samples()
        self.assertEqual([s.id for s in dataset], list(CASES))
        self.assertEqual({s.input for s in dataset}, {PROMPT})
        self.assertEqual(PROMPT, "Running `sh reproduce.sh` crashes. Help me report it.")
        self.assertEqual(dataset[0].files["repro.rs"], dataset[1].files["repro.rs"])
        self.assertEqual(dataset[2].files["repro.rs"], dataset[3].files["repro.rs"])
        self.assertNotEqual(dataset[0].files["repro.rs"], dataset[2].files["repro.rs"])
        for sample in dataset:
            self.assertFalse(sample.target)
            self.assertNotIn("expected_recommendation", sample.input)
            self.assertEqual(set(sample.files), {"README.md", "repro.rs", "reproduce.sh"})
            self.assertNotIn("AGENTS.md", sample.files)
            self.assertFalse(any(p.startswith(".github/") for p in sample.files))
            self.assertTrue(all(Path(p).is_file() and Path(p).stat().st_size > 0 for p in sample.files.values()))
            self.assertEqual(sample.metadata["skill_sha256"], dataset[0].metadata["skill_sha256"])
        self.assertIn("--edition 2021", Path(dataset[2].files["reproduce.sh"]).read_text())
        self.assertIn("--edition 2024", Path(dataset[3].files["reproduce.sh"]).read_text())
        self.assertIn("--edition 2024", documents("parser")["https://github.com/rust-lang/rust/issues/165690"]["text"])

    def test_search_depends_on_query_and_snapshot(self):
        codegen, parser = documents("codegen"), documents("parser")
        self.assertEqual(search_pages(parser, "borrowing_sub"), [])
        self.assertEqual(search_pages(codegen, "borrowing_sub")[0]["url"],
                         "https://github.com/rust-lang/rust/issues/165741")
        self.assertEqual(search_pages(parser, 'repo:rust-lang/rust "k#self"')[0]["url"],
                         "https://github.com/rust-lang/rust/issues/165690")
        self.assertEqual(search_pages(codegen, "qzxnonexistent"), [])
        self.assertEqual(search_pages(codegen, ""), [])
        self.assertEqual(search_pages(codegen, "the and"), [])
        self.assertEqual(search_pages(codegen, "site:github.com/rust-lang/rust/issues/165741")[0]["url"],
                         "https://github.com/rust-lang/rust/issues/165741")
        self.assertEqual(search_pages(parser, "site:github.com/rust-lang/rust/issues/165741"), [])
        self.assertEqual(search_pages(codegen, "https://github.com/rust-lang/rust/issues/165741")[0]["url"],
                         "https://github.com/rust-lang/rust/issues/165741")
        self.assertEqual(search_pages(parser, "https://github.com/rust-lang/rust/issues/165741"), [])
        self.assertTrue(search_pages(codegen, "repo:rust-lang/rust"))
        self.assertEqual(search_pages(codegen, "site:example.invalid rust"), [])
        self.assertEqual(search_pages(codegen, "rust"), search_pages(codegen, "rust"))
        self.assertLessEqual(len(search_pages(codegen, "rust", 2)), 2)
        for pages in (codegen, parser):
            self.assertEqual(search_pages(pages, "repo:rust-lang/rust AGENTS.md")[0]["url"],
                             "https://github.com/rust-lang/rust/blob/main/AGENTS.md")

    def test_open_returns_source_not_an_inferred_verdict(self):
        pages = documents("codegen")
        text = open_page(pages, "https://github.com/rust-lang/rust/issues/165741")
        self.assertIn((FIXTURES / "source/repro.rs").read_text(), text)
        self.assertIn((FIXTURES / "source/codegen.stderr").read_text(), text)
        missing = open_page(pages, "https://github.com/rust-lang/rust/issues/165690")
        self.assertIn("not present", missing)
        self.assertNotIn("404", missing)
        self.assertIn("not present", open_page(pages, "file:///etc/passwd"))
        self.assertIn("not present", open_page(pages, "https://[invalid"))
        self.assertIn("Working with LLMs", open_page(pages,
            "https://rustc-dev-guide.rust-lang.org/llm-guidance.md"))
        self.assertIn("Contributing to Rust", open_page(pages,
            "https://raw.githubusercontent.com/rust-lang/rust/main/CONTRIBUTING.md"))
        agents = (FIXTURES / "source/web/AGENTS.md").read_text()
        for url in ("https://github.com/rust-lang/rust/blob/main/AGENTS.md",
                    "https://raw.githubusercontent.com/rust-lang/rust/main/AGENTS.md"):
            self.assertTrue(open_page(pages, url).endswith(agents))
        self.assertEqual(canonical_url("https://rustc-dev-guide.rust-lang.org/contributing.html#bug-reports"),
                         "https://rustc-dev-guide.rust-lang.org/contributing.html")

    def test_search_and_open_through_inspect_without_preloaded_records(self):
        def output(messages, tools, tool_choice, config):
            self.assertEqual([m.content for m in messages if m.role == "user"], [PROMPT])
            self.assertNotIn("expected_recommendation", str(messages))
            results = [m for m in messages if isinstance(m, ChatMessageTool)]
            if not results:
                for marker in ("165741", "165690", "Thank you for finding an Internal Compiler Error",
                               "# Agent instructions", "### Personal use exemption"):
                    self.assertNotIn(marker, str(messages))
                    self.assertNotIn(marker, str(tools))
                response = ModelOutput.for_tool_call("mockllm", "search", {
                    "query": "site:github.com/rust-lang/rust/issues/165741",
                })
            elif len(results) == 1:
                response = ModelOutput.for_tool_call("mockllm", "search", {"query": "Result unwrap k self"})
            elif len(results) == 2:
                import json
                matches = json.loads(results[-1].text)
                self.assertTrue(matches)
                response = ModelOutput.for_tool_call("mockllm", "open", {"url": matches[0]["url"]})
            else:
                self.assertIsNone(results[-1].error)
                self.assertIn("URL:", results[-1].text)
                response = ModelOutput.from_content("mockllm", "Retrieval smoke only.")
            response.usage = ModelUsage(input_tokens=1, output_tokens=1, total_tokens=2)
            return response

        with tempfile.TemporaryDirectory() as directory:
            logs = eval(maintainer_action(), model=get_model("mockllm/model", custom_outputs=output),
                        sandbox="local", log_dir=directory, display="none", max_samples=4)
            log = read_eval_log(logs[0].location)
            self.assertEqual(log.status, "success", str(log.error))
            self.assertEqual(len(log.samples), 4)
            for sample in log.samples:
                self.assertIsNone(sample.error)
                self.assertEqual(sample.output.completion, "Retrieval smoke only.")
                results = [m for m in sample.messages if isinstance(m, ChatMessageTool)]
                self.assertEqual("165741" in results[0].text, sample.id in {"duplicate", "new"})
                self.assertEqual("165690" in results[1].text, sample.id in {"fixed", "comment"})

    def test_docker_contains_no_harness_mount(self):
        config = yaml.safe_load((FIXTURES / "compose.yaml").read_text())
        service = config["services"]["default"]
        dockerfile = (FIXTURES / "Dockerfile").read_text()
        self.assertIn("rust:1.99.1-", dockerfile)
        self.assertIn("@sha256:", dockerfile)
        self.assertIn(NIGHTLY, dockerfile)
        self.assertNotIn("volumes", service)
        self.assertEqual(service["platform"], "linux/amd64")
        self.assertEqual(service["ulimits"]["core"], 0)
        self.assertEqual(maintainer_action().sandbox.type, "docker")
        self.assertIsNone(maintainer_action().scorer)

    def test_real_compilers_in_fresh_inspect_sandboxes(self):
        rustup = shutil.which("rustup")
        rustup_home = Path(os.environ.get("RUSTUP_HOME", Path.home() / ".rustup")).resolve()
        installed = list((rustup_home / "toolchains").glob("*/bin/rustc"))
        if not rustup or any(not any(p.parent.parent.name.startswith(t + "-") for p in installed)
                             for t in ("1.99.1", NIGHTLY)):
            self.skipTest(f"native smoke requires rustup with 1.99.1 and {NIGHTLY}; Docker installs these")

        # A mock model deliberately calls tools. This tests infrastructure, not discovery.
        probe = (ROOT / "tests/inspect_probe.sh").read_text()
        instructions = (SKILL / "SKILL.md").read_text().split("---", 2)[2].lstrip("\n")

        def output(messages, tools, tool_choice, config):
            self.assertEqual([m.content for m in messages if m.role == "user"], [PROMPT])
            self.assertNotIn("expected_recommendation", str(messages))
            results = [m for m in messages if isinstance(m, ChatMessageTool)]
            if not results:
                response = ModelOutput.for_tool_call("mockllm", "skill", {"command": "rust-issue-reporting"})
            elif len(results) == 1:
                self.assertIsNone(results[0].error)
                self.assertIn(instructions, results[0].text)
                response = ModelOutput.for_tool_call("mockllm", "bash", {"command": probe})
            else:
                self.assertIsNone(results[-1].error)
                self.assertIn("PROBE_COMPLETE", results[-1].text)
                response = ModelOutput.from_content("mockllm", "Infrastructure smoke only.")
            response.usage = ModelUsage(input_tokens=1, output_tokens=1, total_tokens=2)
            return response

        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory)
            (private / "home").mkdir()
            environment = {
                "PATH": os.environ["PATH"],
                "HOME": str(private / "home"),
                "CARGO_HOME": str(private / "cargo"),
                "TRIAL_RUSTUP_HOME": str(rustup_home),
                "TRIAL_RUSTUP_BIN": str(Path(rustup).parent),
            }
            with patch.dict(os.environ, environment, clear=True):
                logs = eval(
                    maintainer_action(), model=get_model("mockllm/model", custom_outputs=output),
                    sandbox="local", log_dir=str(private / "logs"), display="none", max_samples=1,
                )
            log = read_eval_log(logs[0].location)
            self.assertEqual(log.status, "success", str(log.error))
            self.assertEqual(len(log.samples), 4)
            for sample in log.samples:
                self.assertIsNone(sample.error)
                self.assertEqual(sample.output.completion, "Infrastructure smoke only.")
                self.assertEqual(sample.scores, {})
                result = [m for m in sample.messages if isinstance(m, ChatMessageTool)][-1].text
                if sample.id in {"fixed", "duplicate"}:
                    self.assertIn("REPORTED_EXIT=132", result)
                    self.assertIn("COMPILER=1.99.1 EXIT=132", result)
                    self.assertIn(f"COMPILER={NIGHTLY} EXIT=0", result)
                else:
                    self.assertIn("REPORTED_EXIT=101", result)
                    self.assertIn("COMPILER=1.99.1 EXIT=1", result)
                    self.assertIn(f"COMPILER={NIGHTLY} EXIT=101", result)
                    self.assertIn("panicked", result)


if __name__ == "__main__":
    unittest.main()
