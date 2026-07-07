# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Claude Code research agent that answers questions about Claude Code by searching the web (DuckDuckGo) and fetching page content, then synthesizing findings using the Anthropic API.

## Running the agent

```bash
# Activate the project venv (created with the user's own Python)
source /home/bird/Dokumenter/claude/myenv/bin/activate

# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# One-shot question
python3 claude_code_researcher.py "what are the latest Claude Code features?"

# Interactive mode
python3 claude_code_researcher.py
```

## Dependencies

Install into the user's venv (not system Python — Debian externally managed):

```bash
python3 -m venv myenv
source myenv/bin/activate
pip install anthropic ddgs beautifulsoup4 lxml
```

The `venv/` and `my_anthropic_env/` directories are broken (Python version mismatch — created in Claude Code's Python 3.13 environment, not the user's system Python). Use `myenv/` only.

## Architecture

`claude_code_researcher.py` is a single-file agentic loop:

- **`run_agent(question)`** — the main loop. Sends messages to `claude-sonnet-4-6`, checks `stop_reason`, dispatches tool calls, feeds results back, repeats until `end_turn`.
- **`web_search(query)`** — calls DuckDuckGo via `duckduckgo_search.DDGS`, returns JSON list of results.
- **`fetch_page(url)`** — fetches a URL with `urllib.request`, strips nav/footer/scripts with BeautifulSoup, returns truncated plain text.
- **`TOOLS`** — the tool schema passed to the API, defining `web_search` and `fetch_page`.
- **`SYSTEM_PROMPT`** — instructs the model to always search before answering and cite sources. Contains a hardcoded date — update when needed.

The loop pattern: `create → tool_use? → execute tools → append results → create → ... → end_turn → print`.

## Notes

- `apikey/claudecodeapikey.txt` contains a credential — do not commit this file or expose its contents.
- The hardcoded date in `SYSTEM_PROMPT` (line 105) should be kept current.
