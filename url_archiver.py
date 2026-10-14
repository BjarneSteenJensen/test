#!/usr/bin/env python3
"""
URL Archiver
Reads an HTML file, fetches every URL linked in it, stores the raw HTML in
MongoDB, and stores an AI-written summary of each page in MongoDB too.

Usage:
    python3 url_archiver.py links.html
    python3 url_archiver.py links.html --mongo mongodb://localhost:27017 --db url_archive
    python3 url_archiver.py links.html --language Danish --force

Collections:
    pages      one document per URL: raw HTML, status, title, fetch time
    summaries  one document per URL: AI summary, model, creation time
"""

import argparse
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urldefrag, urljoin, urlparse

import anthropic
from bs4 import BeautifulSoup
from pymongo import MongoClient

MODEL = "claude-opus-5-5"
MAX_TOKENS = 4096
FETCH_TIMEOUT = 20
MAX_SUMMARY_INPUT_CHARS = 400_000   # ~100K tokens of page text per summary
MAX_HTML_BYTES = 15 * 1024 * 1024   # MongoDB documents are capped at 16 MB
USER_AGENT = "Mozilla/5.0 (compatible; UrlArchiver/1.0)"

SYSTEM_PROMPT = """You summarize web pages. Given the text content of a page, write a concise \
summary (3-8 sentences) covering what the page is, its main points, and any key facts, \
names, dates or numbers. Write plain prose without headings. {language_rule}"""


# ── Input ──────────────────────────────────────────────────────────────────────

def extract_urls(html_path: str) -> list[str]:
    """Return the unique http(s) URLs linked from an HTML file, in document order."""
    with open(html_path, encoding="utf-8", errors="replace") as f:
        soup = BeautifulSoup(f.read(), "lxml")

    base_tag = soup.find("base", href=True)
    base = base_tag["href"] if base_tag else ""

    urls, seen = [], set()
    for a in soup.find_all("a", href=True):
        url, _ = urldefrag(urljoin(base, a["href"].strip()))
        if urlparse(url).scheme in ("http", "https") and url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


# ── Fetch ──────────────────────────────────────────────────────────────────────

def fetch(url: str) -> dict:
    """Fetch a URL and return a page document for MongoDB."""
    doc = {"url": url, "fetched_at": datetime.now(timezone.utc)}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            raw = resp.read(MAX_HTML_BYTES + 1)
            charset = resp.headers.get_content_charset() or "utf-8"
            doc.update(
                final_url=resp.geturl(),
                status=resp.status,
                content_type=resp.headers.get("Content-Type", ""),
            )
        if len(raw) > MAX_HTML_BYTES:
            doc["error"] = f"Page larger than {MAX_HTML_BYTES} bytes; HTML not stored"
            return doc
        html = raw.decode(charset, errors="replace")
        soup = BeautifulSoup(html, "lxml")
        doc["html"] = html
        doc["title"] = soup.title.get_text(strip=True) if soup.title else None
    except Exception as e:
        doc["error"] = str(e)
    return doc


def page_text(html: str) -> str:
    """Strip scripts, navigation and boilerplate, returning the readable text."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "svg"]):
        tag.decompose()
    lines = (l.strip() for l in soup.get_text(separator="\n").splitlines())
    return "\n".join(l for l in lines if l)


# ── Summarize ──────────────────────────────────────────────────────────────────

def summarize(client: anthropic.Anthropic, page: dict, language: str | None) -> dict:
    """Ask Claude for a summary of a fetched page and return a summary document."""
    text = page_text(page["html"])
    truncated = len(text) > MAX_SUMMARY_INPUT_CHARS
    text = text[:MAX_SUMMARY_INPUT_CHARS]

    language_rule = (f"Write the summary in {language}." if language
                     else "Write the summary in the same language as the page.")
    prompt = (f"URL: {page['url']}\nTitle: {page.get('title') or '(none)'}\n\n"
              f"<page_text>\n{text}\n</page_text>")

    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT.format(language_rule=language_rule),
        output_config={"effort": "low"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
    )

    if response.stop_reason == "refusal":
        raise RuntimeError("Model declined to summarize this page")
    summary = "".join(b.text for b in response.content if b.type == "text").strip()

    return {
        "url": page["url"],
        "title": page.get("title"),
        "summary": summary,
        "model": response.model,
        "input_truncated": truncated,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "created_at": datetime.now(timezone.utc),
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Archive and summarize every URL in an HTML file.")
    parser.add_argument("html_file", help="HTML file containing the links")
    parser.add_argument("--mongo", default="mongodb://localhost:27017", help="MongoDB connection URI")
    parser.add_argument("--db", default="url_archive", help="MongoDB database name")
    parser.add_argument("--language", help="Summary language (default: same as the page)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel page fetches")
    parser.add_argument("--force", action="store_true", help="Re-fetch and re-summarize URLs already stored")
    args = parser.parse_args()

    urls = extract_urls(args.html_file)
    if not urls:
        sys.exit(f"No http(s) links found in {args.html_file}")

    db = MongoClient(args.mongo)[args.db]
    pages, summaries = db["pages"], db["summaries"]
    pages.create_index("url", unique=True)
    summaries.create_index("url", unique=True)

    if not args.force:
        done = {d["url"] for d in summaries.find({"url": {"$in": urls}}, {"url": 1})}
        if done:
            print(f"Skipping {len(done)} URL(s) already summarized (use --force to redo)")
        urls = [u for u in urls if u not in done]

    print(f"Processing {len(urls)} URL(s)\n")
    client = anthropic.Anthropic()
    ok = failed = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for i, page in enumerate(pool.map(fetch, urls), 1):
            url = page["url"]
            pages.replace_one({"url": url}, page, upsert=True)

            if "error" in page:
                print(f"[{i}/{len(urls)}] FETCH FAILED {url}: {page['error']}")
                failed += 1
                continue

            try:
                summary = summarize(client, page, args.language)
                summaries.replace_one({"url": url}, summary, upsert=True)
                print(f"[{i}/{len(urls)}] OK {url}")
                ok += 1
            except anthropic.APIConnectionError as e:
                print(f"[{i}/{len(urls)}] SUMMARY FAILED {url}: network error: {e}")
                failed += 1
            except anthropic.APIStatusError as e:
                print(f"[{i}/{len(urls)}] SUMMARY FAILED {url}: API error {e.status_code}: {e.message}")
                failed += 1
                if isinstance(e, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)):
                    sys.exit("Stopping: check ANTHROPIC_API_KEY")
            except RuntimeError as e:
                print(f"[{i}/{len(urls)}] SUMMARY FAILED {url}: {e}")
                failed += 1

    print(f"\nDone: {ok} summarized, {failed} failed. Database: {args.db} (pages, summaries)")


if __name__ == "__main__":
    main()
