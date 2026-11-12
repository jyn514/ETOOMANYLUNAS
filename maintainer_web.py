"""Query-driven archived upstream access for the maintainer-action samples."""

import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from inspect_ai.tool import Tool, tool

SOURCE = Path(__file__).resolve().parent / "issue-reporting/maintainer-action/source"
DOCS = (
    ("https://github.com/rust-lang/rust", "rust-lang/rust", "README.md"),
    ("https://github.com/rust-lang/rust/blob/main/CONTRIBUTING.md", "Contributing to Rust", "CONTRIBUTING.md"),
    ("https://github.com/rust-lang/rust/blob/main/AGENTS.md", "Rust AGENTS.md", "AGENTS.md"),
    ("https://github.com/rust-lang/rust/blob/main/.github/ISSUE_TEMPLATE/ice.md", "Rust internal compiler error report form", "ice.md"),
    ("https://github.com/rust-lang/rust/blob/main/.github/ISSUE_TEMPLATE/regression.md", "Rust regression report form", "regression.md"),
    ("https://rustc-dev-guide.rust-lang.org/contributing.html", "Contributing to rustc: bug reports", "contributing-guide.md"),
    ("https://rustc-dev-guide.rust-lang.org/llm-guidance.html", "Rustc LLM guidance", "llm-guidance.md"),
    ("https://forge.rust-lang.org/policies/llm-usage.html", "Rust LLM usage policy", "llm-usage.md"),
)
ISSUES = {"codegen": (165741, "repro.rs"), "parser": (165690, "parser.rs")}
STOPWORDS = frozenset("a an and are at by for from i in is it of on or the to was with".split())


def documents(record: str) -> dict[str, dict[str, str]]:
    """Construct one sample's corpus. Nothing here is copied into its sandbox."""
    pages = {url: {"title": title, "text": (SOURCE / "web" / file).read_text()}
             for url, title, file in DOCS}
    number, source = ISSUES[record]
    text = (SOURCE / "issues" / f"{record}.md").read_text()
    text = text.replace("[Source](repro.rs)", "```rust\n" + (SOURCE / source).read_text() + "```\n")
    text = text.replace("[Compiler output excerpt](stderr.txt)",
                        "```text\n" + (SOURCE / f"{record}.stderr").read_text() + "```\n")
    pages[f"https://github.com/rust-lang/rust/issues/{number}"] = {
        "title": text.splitlines()[0].removeprefix("# "), "text": text,
    }
    return pages


def canonical_url(url: str) -> str:
    try:
        parts = urlsplit(url)
    except ValueError:
        return ""
    path = parts.path.rstrip("/")
    host = parts.netloc.lower()
    if host == "rustc-dev-guide.rust-lang.org" and path.endswith(".md"):
        path = path[:-3] + ".html"
    if host == "raw.githubusercontent.com" and path.startswith("/rust-lang/rust/"):
        path = path.replace("/rust-lang/rust/", "/rust-lang/rust/blob/", 1)
        host = "github.com"
    path = path.replace("/blob/master/", "/blob/main/").replace("/blob/HEAD/", "/blob/main/")
    if host == "github.com" and path in {
        "/rust-lang/rust/blob/main/README.md", "/rust-lang/rust/tree/main",
    }:
        path = "/rust-lang/rust"
    return urlunsplit((parts.scheme.lower(), host, path, "", ""))


def search_pages(pages: dict[str, dict[str, str]], query: str, limit: int = 5) -> list[dict[str, str]]:
    """Literal token ranking, not a case-specific answer selector."""
    candidate = query.strip().strip("\"'")
    if candidate.lower().startswith(("https://", "http://")) and not any(c.isspace() for c in candidate):
        url = canonical_url(candidate)
        page = pages.get(url)
        return [] if page is None else [{
            "title": page["title"], "url": url,
            "snippet": " ".join(page["text"][:300].split()),
        }]
    filters = re.findall(r"(?:site|repo):([^\s]+)", query, re.IGNORECASE)
    words = re.sub(r"(?:site|repo):[^\s]+", " ", query, flags=re.IGNORECASE)
    terms = set(re.findall(r"[a-z0-9_]+", words.lower())) - STOPWORDS
    if not terms and not filters:
        return []
    results = []
    for url, page in pages.items():
        if any(value.strip('\"').lower() not in url.lower() for value in filters):
            continue
        title_terms = set(re.findall(r"[a-z0-9_]+", page["title"].lower()))
        text_terms = set(re.findall(r"[a-z0-9_]+", (url + " " + page["text"]).lower()))
        hits = terms & (title_terms | text_terms)
        if terms and not hits:
            continue
        score = len(hits) + 2 * len(terms & title_terms)
        positions = [page["text"].lower().find(term) for term in sorted(hits)]
        start = max(0, min(p for p in positions if p >= 0) - 60) if any(p >= 0 for p in positions) else 0
        snippet = " ".join(page["text"][start:start + 300].split())
        results.append((score, {"title": page["title"], "url": url, "snippet": snippet}))
    results.sort(key=lambda item: (-item[0], item[1]["url"]))
    return [result for _, result in results[:max(1, min(limit, 10))]]


def open_page(pages: dict[str, dict[str, str]], url: str) -> str:
    page = pages.get(canonical_url(url))
    if page is None:
        return "Page not present in this archived snapshot. No live request was made."
    return f"URL: {canonical_url(url)}\nTitle: {page['title']}\n\n{page['text']}"


@tool
def search(pages: dict[str, dict[str, str]]) -> Tool:
    async def execute(query: str, limit: int = 5) -> str:
        """Search an archived upstream web snapshot dated November 12, 2026.

        Args:
            query: Search terms, optionally including site: or repo: filters.
            limit: Maximum number of results, from 1 to 10.
        """
        return json.dumps(search_pages(pages, query, limit), ensure_ascii=False)
    return execute


@tool
def open(pages: dict[str, dict[str, str]]) -> Tool:
    async def execute(url: str) -> str:
        """Read an archived upstream page by URL.

        Args:
            url: The page's URL.
        """
        return open_page(pages, url)
    return execute
