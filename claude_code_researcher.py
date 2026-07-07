#!/usr/bin/env python3
"""
Claude Code Research Agent
Searches the web and synthesizes up-to-date information about Claude Code.

Usage:
    python3 claude_code_researcher.py
    python3 claude_code_researcher.py "what are the latest Claude Code features?"
"""

import sys
import json
import urllib.request
from bs4 import BeautifulSoup
from ddgs import DDGS
import anthropic

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
MAX_SEARCH_RESULTS = 6
MAX_PAGE_CHARS = 8000


# ── Tools ──────────────────────────────────────────────────────────────────────

def web_search(query: str) -> str:
    """Search the web via DuckDuckGo and return top results as JSON."""
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=MAX_SEARCH_RESULTS))
        if not results:
            return json.dumps({"error": "No results found."})
        return json.dumps([
            {"title": r.get("title"), "url": r.get("href"), "snippet": r.get("body")}
            for r in results
        ], indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


def fetch_page(url: str) -> str:
    """Fetch a web page and return its main text content (truncated)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        lines = [l for l in text.splitlines() if l.strip()]
        content = "\n".join(lines)[:MAX_PAGE_CHARS]
        return content or "(empty page)"
    except Exception as e:
        return f"Error fetching {url}: {e}"


TOOLS = [
    {
        "name": "web_search",
        "description": (
            "Search the web for up-to-date information about Claude Code, Anthropic, "
            "or any developer topic. Returns a list of results with titles, URLs, and snippets. "
            "Always search before answering questions about current events or recent releases."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query. Be specific — include 'Claude Code' and the year (2026) for recent news.",
                }
            },
            "required": ["query"],
        },
    },
    {
        "name": "fetch_page",
        "description": (
            "Fetch the full text content of a web page. Use this to read an article or "
            "documentation page after finding its URL via web_search."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "The full URL of the page to fetch.",
                }
            },
            "required": ["url"],
        },
    },
]

SYSTEM_PROMPT = """You are a specialist research agent focused on Claude Code — Anthropic's AI coding assistant.

Your job is to find accurate, up-to-date information by searching the web and reading relevant pages.
Always search before answering; never rely solely on your training data for current news or features.

Guidelines:
- Run 2–3 searches for any non-trivial question to get multiple perspectives.
- Fetch the full page content when a snippet isn't enough.
- Synthesize findings into a clear, structured answer with citations (title + URL).
- Today's date is July 6, 2026. Include the year in searches for recent information.
- Be concise but complete — developers want facts, not filler.
"""


# ── Agent loop ─────────────────────────────────────────────────────────────────

def run_agent(question: str) -> None:
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": question}]

    print(f"\nResearching: {question}\n{'─' * 60}")

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Collect text and tool calls from this response
        tool_uses = []
        text_blocks = []

        for block in response.content:
            if block.type == "text":
                text_blocks.append(block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        # Print any intermediate reasoning the model emits
        for text in text_blocks:
            if text.strip() and response.stop_reason == "tool_use":
                print(f"[thinking] {text.strip()}\n")

        # Done — print final answer
        if response.stop_reason == "end_turn":
            print("\n" + "\n".join(text_blocks))
            break

        # Any other terminal stop reason (max_tokens, stop_sequence, refusal, ...)
        # has no tool_use blocks to execute — print what we have and stop instead
        # of sending an empty tool_results message back to the API.
        if response.stop_reason != "tool_use":
            if text_blocks:
                print("\n" + "\n".join(text_blocks))
            print(f"\n[stopped: {response.stop_reason}]")
            break

        # Execute tool calls
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for tool_use in tool_uses:
            name = tool_use.name
            args = tool_use.input
            print(f"  → {name}({', '.join(f'{k}={repr(v)}' for k, v in args.items())})")

            if name == "web_search":
                result = web_search(args["query"])
            elif name == "fetch_page":
                result = fetch_page(args["url"])
            else:
                result = json.dumps({"error": f"Unknown tool: {name}"})

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    if not __import__("os").environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable is not set.")
        print("  export ANTHROPIC_API_KEY=your-key-here")
        sys.exit(1)

    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
        run_agent(question)
        return

    print("Claude Code Research Agent")
    print("Type your question (or 'quit' to exit)\n")
    while True:
        try:
            question = input("Question: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if question.lower() in ("quit", "exit", "q", ""):
            return
        run_agent(question)


if __name__ == "__main__":
    main()
