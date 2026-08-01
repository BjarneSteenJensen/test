#!/usr/bin/env python3
"""
Bible Verse Lookup
Fetches today's K-LOVE "Verse of the Day" (English) and the corresponding
verse in the BPH ("Bibelen på hverdagsdansk") Danish translation from
BibleGateway.

Uses Playwright instead of requests/BeautifulSoup because verse-of-the-day
widgets are commonly rendered client-side with JavaScript.

Setup:
    pip install playwright
    playwright install chromium

Usage:
    python3 bible_verse_lookup.py
"""

import re
import sys

from playwright.sync_api import sync_playwright

KLOVE_URL = "https://www.klove.com/faith/votd"
BIBLEGATEWAY_URL = "https://www.biblegateway.com/passage/?search={ref}&version=BPH"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Matches references like "John 3:16" or "1 Corinthians 13:4-7"
REF_PATTERN = re.compile(r"\b((?:[1-3]\s)?[A-Z][a-zA-Z]+)\s(\d{1,3}:\d{1,3}(?:-\d{1,3})?)\b")

KLOVE_VERSE_SELECTOR = '[aria-label^="Verse:"]'
KLOVE_REFERENCE_SELECTOR = '[aria-label^="Reference:"]'
BIBLEGATEWAY_SELECTORS = [".passage-text .text-html"]


def fetch_klove_verse(page) -> tuple[str, str]:
    """Return (reference, verse_text) from K-LOVE's verse of the day."""
    page.goto(KLOVE_URL, wait_until="domcontentloaded", timeout=30000)

    verse_el = page.query_selector(KLOVE_VERSE_SELECTOR)
    ref_el = page.query_selector(KLOVE_REFERENCE_SELECTOR)
    if verse_el and ref_el:
        verse_text = verse_el.inner_text().strip()
        ref_label = ref_el.inner_text().strip()
        match = REF_PATTERN.search(ref_label)
        reference = match.group(0) if match else ref_label
        return reference, verse_text

    # Fallback: scan the full rendered page text for a reference-shaped string.
    body_text = page.inner_text("body")
    match = REF_PATTERN.search(body_text)
    if not match:
        raise RuntimeError(
            "Could not locate a verse reference on the K-LOVE page. "
            "The page layout may have changed — inspect it manually and "
            "update KLOVE_VERSE_SELECTOR/KLOVE_REFERENCE_SELECTOR."
        )

    reference = match.group(0)
    start = max(match.start() - 20, 0)
    snippet = body_text[start : match.end() + 400].strip()
    return reference, snippet


def fetch_bph_passage(page, reference: str) -> str:
    """Return the BPH Danish text for the given English reference."""
    url = BIBLEGATEWAY_URL.format(ref=reference.replace(" ", "+"))
    page.goto(url, wait_until="networkidle", timeout=30000)

    for selector in BIBLEGATEWAY_SELECTORS:
        el = page.query_selector(selector)
        if el:
            return el.evaluate(
                "node => { "
                "node.querySelectorAll('.full-chap-link').forEach(a => a.remove()); "
                "return node.innerText; "
                "}"
            ).strip()

    raise RuntimeError(
        f"Could not find the BPH passage text for '{reference}'. "
        "BibleGateway's layout may have changed — inspect it manually and "
        "update BIBLEGATEWAY_SELECTORS."
    )


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)

        try:
            reference, english_text = fetch_klove_verse(page)
            print(f"Today's verse ({reference}):\n{english_text}\n")

            danish_text = fetch_bph_passage(page, reference)
            print(f"BPH — Bibelen på hverdagsdansk:\n{danish_text}\n")
        except RuntimeError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
        finally:
            browser.close()


if __name__ == "__main__":
    main()