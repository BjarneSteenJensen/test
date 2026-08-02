#!/usr/bin/env node
/**
 * Bible Chapter Lookup
 * Fetches today's K-LOVE "Verse of the Day" (English) and displays the
 * whole surrounding chapter in the BPH ("Bibelen på hverdagsdansk") Danish
 * translation from BibleGateway.
 *
 * K-LOVE/BibleGateway fetch logic is ported from bible_verse_lookup.js in
 * ../bibelvers-js.
 *
 * Setup:
 *   npm install
 *
 * Usage:
 *   node bible_chapter_lookup.js
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

/** Turn "John 3:16" or "1 Corinthians 13:4-7" into "John 3" / "1 Corinthians 13". */
function chapterReferenceOf(reference) {
  return reference.split(":")[0].trim();
}

/** Return the whole BPH Danish chapter text for the given chapter reference. */
async function fetchBphChapter(chapterReference) {
  const encodedRef = encodeURIComponent(chapterReference).replace(/%20/g, "+");
  const url = BIBLEGATEWAY_URL.replace("{ref}", encodedRef);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const container = $(BIBLEGATEWAY_SELECTOR).first();
  if (!container.length) {
    throw new Error(
      `Could not find the BPH chapter text for '${chapterReference}'. ` +
        "BibleGateway's layout may have changed — inspect it manually and " +
        "update BIBLEGATEWAY_SELECTOR."
    );
  }

  container.find(".footnotes").remove();
  container.find(".full-chap-link").remove();
  container.find("sup.footnote, sup.crossreference").remove();

  const blocks = [];
  container.children().each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (el.tagName === "h3" || el.tagName === "h4") {
      blocks.push(`\n${text}\n`);
    } else {
      blocks.push(text);
    }
  });

  return blocks.join("\n\n").trim();
}

async function main() {
  try {
    const { reference, verseText } = await fetchKloveVerse();
    console.log(`Today's verse (${reference}):\n${verseText}\n`);

    const chapterReference = chapterReferenceOf(reference);
    const chapterText = await fetchBphChapter(chapterReference);
    console.log(`BPH — Bibelen på hverdagsdansk, ${chapterReference}:\n\n${chapterText}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
