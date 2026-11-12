"""Four unscored Inspect trials using genuine rustc defects and offline issue records."""

from hashlib import sha256
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.agent import as_solver, react
from inspect_ai.dataset import Sample
from inspect_ai.solver import solver
from inspect_ai.tool import bash, skill

from maintainer_clone import clone
from maintainer_web import documents, open as open_web, search

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "issue-reporting" / "maintainer-action"
SOURCE = FIXTURES / "source"
SKILL = ROOT / ".agents" / "skills" / "rust-issue-reporting"
NIGHTLY = "nightly-2026-11-12"
PROMPT = "Running `sh reproduce.sh` crashes. Help me report it."

# These references and source identities are evaluator metadata, not model input.
CASES = {
    "fixed": ("codegen", "codegen", "parser", "No new issue."),
    "duplicate": ("codegen", "codegen", "codegen", "Neither file nor comment."),
    "comment": ("parser", "parser-2021", "parser", "Comment with the verified edition-2021 reproduction."),
    "new": ("parser", "parser", "codegen", "New issue within the supplied offline snapshot."),
}
REPRODUCERS = {"codegen": "repro.rs", "parser": "parser.rs"}


def samples() -> list[Sample]:
    result = []
    for case, (reproducer, command, record, recommendation) in CASES.items():
        files = {
            file.name: str(file)
            for file in sorted((SOURCE / "common").iterdir())
            if file.is_file()
        }
        files.update({
            "repro.rs": str(SOURCE / REPRODUCERS[reproducer]),
            "reproduce.sh": str(SOURCE / f"{command}.sh"),
        })
        result.append(Sample(
            id=case,
            input=PROMPT,
            files=files,
            setup=str(FIXTURES / "preflight.sh"),
            metadata={
                "expected_recommendation": recommendation,
                "web_record": record,
                "web_sha256": {url: sha256(page["text"].encode()).hexdigest()
                               for url, page in documents(record).items()},
                "compiler_issue": 165741 if reproducer == "codegen" else 165690,
                "skill_sha256": sha256((SKILL / "SKILL.md").read_bytes()).hexdigest(),
                "file_sha256": {
                    destination: sha256(Path(source).read_bytes()).hexdigest()
                    for destination, source in files.items()
                },
            },
        ))
    return result


@solver
def reporting_agent():
    async def solve(state, generate):
        pages = documents(state.metadata["web_record"])
        agent = react(
            tools=[bash(timeout=60), skill([SKILL], dir=".agents/skills"),
                   search(pages), open_web(pages), clone()],
            submit=False,
        )
        return await as_solver(agent)(state, generate)
    return solve


@task
def maintainer_action() -> Task:
    return Task(
        dataset=samples(),
        solver=reporting_agent(),
        sandbox=("docker", str(FIXTURES / "compose.yaml")),
        scorer=None,
        message_limit=100,
        time_limit=300,
        metadata={
            "scope": "Real compiler defects; query-driven archived upstream tools, not live browsing.",
            "snapshot_date": "2026-11-12",
            "instruction_delivery": "Unchanged skill available through Inspect's skill tool.",
        },
    )
