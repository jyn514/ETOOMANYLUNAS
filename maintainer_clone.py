"""On-demand Git checkouts using the sandbox image's archived remotes."""

from urllib.parse import urlsplit

from inspect_ai.tool import Tool, ToolError, tool
from inspect_ai.util import sandbox


@tool
def clone() -> Tool:
    async def execute(url: str, destination: str) -> str:
        """Clone a shallow archived Git repository into the current sandbox.

        Args:
            url: HTTPS repository URL.
            destination: Directory for the new checkout. It must not already contain files.
        """
        try:
            parsed = urlsplit(url)
        except ValueError as error:
            raise ToolError("Invalid repository URL.") from error
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username
                or parsed.password or parsed.query or parsed.fragment):
            raise ToolError("Expected an HTTPS repository URL without credentials, query, or fragment.")
        if not destination:
            raise ToolError("A destination directory is required.")

        # Git owns URL rewriting. Check its configured remote without network access.
        remote = await sandbox().exec(["git", "ls-remote", "--get-url", "--", url], timeout=15)
        if not remote.success:
            raise ToolError(f"Cannot resolve archived remote: {remote.stderr}")
        if urlsplit(remote.stdout.strip()).scheme != "file":
            raise ToolError("Repository is not present in this Git snapshot. No live clone was attempted.")

        result = await sandbox().exec(
            ["git", "clone", "--depth", "1", "--", url, destination], timeout=120,
        )
        if not result.success:
            raise ToolError(f"Git clone failed: {result.stderr}")
        revision = await sandbox().exec(["git", "-C", destination, "rev-parse", "HEAD"], timeout=15)
        if not revision.success:
            raise ToolError(f"Checkout created at {destination}, but reading HEAD failed: {revision.stderr}")
        return f"Cloned {url} into {destination}\nCommit: {revision.stdout.strip()}\n{result.stderr}"
    return execute
