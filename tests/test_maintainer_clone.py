"""Clone validation and an optional real-Git Inspect smoke test."""

import asyncio
from hashlib import sha256
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from inspect_ai import eval
from inspect_ai.log import read_eval_log
from inspect_ai.model import ChatMessageTool, ModelOutput, ModelUsage, get_model
from inspect_ai.tool import ToolError

from maintainer_action import ROOT, maintainer_action
from maintainer_clone import clone

URL = "https://github.com/rust-lang/rust.git"


class CloneTests(unittest.TestCase):
    def test_invalid_urls_fail_before_sandbox_access(self):
        for url in ("file:///etc/passwd", "--upload-pack=bad", "https://[bad",
                    "https://user:password@github.com/rust-lang/rust",
                    URL + "?token=secret"):
            with self.subTest(url=url), self.assertRaises(ToolError):
                asyncio.run(clone()(url=url, destination="checkout"))

    def test_real_clone_through_inspect(self):
        cache = Path(os.environ.get("TRIAL_GIT_CACHE", ROOT / "work/clone-cache/rust.git")).resolve()
        if not shutil.which("git") or not (cache / "HEAD").is_file():
            self.skipTest("requires a local archived Rust Git repository; Docker builds it")
        revision = subprocess.check_output(["git", "-C", str(cache), "rev-parse", "HEAD"], text=True).strip()
        agents_sha = sha256((ROOT / "issue-reporting/maintainer-action/source/web/AGENTS.md").read_bytes()).hexdigest()
        probe = (ROOT / "tests/clone_probe.sh").read_text()

        def output(messages, tools, tool_choice, config):
            results = [m for m in messages if isinstance(m, ChatMessageTool)]
            if not results:
                response = ModelOutput.for_tool_call("mockllm", "clone", {"url": URL, "destination": "checkout"})
            elif len(results) == 1:
                self.assertIsNone(results[-1].error)
                self.assertIn(revision, results[-1].text)
                response = ModelOutput.for_tool_call("mockllm", "clone", {
                    "url": "https://github.com/example/not-archived.git", "destination": "absent-checkout",
                })
            elif len(results) == 2:
                self.assertIsNotNone(results[-1].error)
                self.assertIn("not present in this Git snapshot", results[-1].error.message)
                response = ModelOutput.for_tool_call("mockllm", "clone", {"url": URL, "destination": "checkout"})
            elif len(results) == 3:
                self.assertIsNotNone(results[-1].error)
                self.assertIn("not an empty directory", results[-1].error.message)
                response = ModelOutput.for_tool_call("mockllm", "bash", {"command": probe})
            else:
                self.assertIsNone(results[-1].error)
                self.assertIn("HEAD=" + revision, results[-1].text)
                self.assertIn("SHALLOW=true", results[-1].text)
                self.assertIn("ORIGIN=" + URL, results[-1].text)
                self.assertIn("STATUS_START\nSTATUS_END", results[-1].text)
                self.assertIn(agents_sha, results[-1].text)
                self.assertIn("CLONE_PROBE_COMPLETE", results[-1].text)
                response = ModelOutput.from_content("mockllm", "Clone infrastructure smoke only.")
            response.usage = ModelUsage(input_tokens=1, output_tokens=1, total_tokens=2)
            return response

        with tempfile.TemporaryDirectory() as directory:
            private = Path(directory)
            config = private / "gitconfig"
            subprocess.run(["git", "config", "--file", str(config), "--add",
                            f"url.{cache.as_uri()}.insteadOf", URL], check=True)
            environment = {"GIT_CONFIG_GLOBAL": str(config), "GIT_CONFIG_NOSYSTEM": "1"}
            with patch.dict(os.environ, environment):
                logs = eval(maintainer_action(), model=get_model("mockllm/model", custom_outputs=output),
                            sandbox="local", limit=1, log_dir=str(private / "logs"), display="none")
            log = read_eval_log(logs[0].location)
            self.assertEqual(log.status, "success", str(log.error))
            self.assertIsNone(log.samples[0].error)
            self.assertEqual(log.samples[0].output.completion, "Clone infrastructure smoke only.")


if __name__ == "__main__":
    unittest.main()
