#!/usr/bin/env node
/**
 * Bible Verse Lookup (JavaScript port of bible_verse_lookup.py)
 * Fetches today's K-LOVE "Verse of the Day" (English) and the corresponding
 * verse in the BPH ("Bibelen på hverdagsdansk") Danish translation from
 * BibleGateway.
 *
 * Both pages are server-rendered, so this uses a plain fetch + cheerio
 * (no browser automation needed).
 *
 * Setup:
 *   npm install
 *
 * Usage:
 *   node bible_verse_lookup.js
 */

import * as cheerio from "cheerio";

const KLOVE_URL = "https://www.klove.com/faith/votd";
const BIBLEGATEWAY_URL = "https://www.biblegateway.com/passage/?search={ref}&version=BPH";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Matches references like "John 3:16" or "1 Corinthians 13:4-7"
const REF_PATTERN = /\b((?:[1-3]\s)?[A-Z][a-zA-Z]+)\s(\d{1,3}:\d{1,3}(?:-\d{1,3})?)\b/;

const KLOVE_VERSE_SELECTOR = '[aria-label^="Verse:"]';
const KLOVE_REFERENCE_SELECTOR = '[aria-label^="Reference:"]';
const BIBLEGATEWAY_SELECTOR = ".passage-text .text-html";

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/** Return { reference, verseText } from K-LOVE's verse of the day. */
async function fetchKloveVerse() {
  const html = await fetchHtml(KLOVE_URL);
  const $ = cheerio.load(html);

  const verseEl = $(KLOVE_VERSE_SELECTOR).first();
  const refEl = $(KLOVE_REFERENCE_SELECTOR).first();

  if (verseEl.length && refEl.length) {
    const verseText = verseEl.text().trim();
    const refLabel = refEl.text().trim();
    const match = refLabel.match(REF_PATTERN);
    const reference = match ? match[0] : refLabel;
    return { reference, verseText };
  }

  // Fallback: scan the full page text for a reference-shaped string.
  const bodyText = $("body").text();
  const match = bodyText.match(REF_PATTERN);
  if (!match) {
    throw new Error(
      "Could not locate a verse reference on the K-LOVE page. " +
        "The page layout may have changed — inspect it manually and " +
        "update KLOVE_VERSE_SELECTOR/KLOVE_REFERENCE_SELECTOR."
    );
  }

  const reference = match[0];
  const start = Math.max(match.index - 20, 0);
  const snippet = bodyText.slice(start, match.index + match[0].length + 400).trim();
  return { reference, verseText: snippet };
}

/** Return the BPH Danish text for the given English reference. */
async function fetchBphPassage(reference) {
  const encodedRef = encodeURIComponent(reference).replace(/%20/g, "+");
  const url = BIBLEGATEWAY_URL.replace("{ref}", encodedRef);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const el = $(BIBLEGATEWAY_SELECTOR).first();
  if (el.length) {
    el.find(".full-chap-link").remove();
    return el.text().trim();
  }

  throw new Error(
    `Could not find the BPH passage text for '${reference}'. ` +
      "BibleGateway's layout may have changed — inspect it manually and " +
      "update BIBLEGATEWAY_SELECTOR."
  );
}

async function main() {
  try {
    const { reference, verseText } = await fetchKloveVerse();
    console.log(`Today's verse (${reference}):\n${verseText}\n`);

    const danishText = await fetchBphPassage(reference);
    console.log(`BPH — Bibelen på hverdagsdansk:\n${danishText}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
