# Bible Verse Lookup (JavaScript)

JavaScript port of the Python `bible_verse_lookup.py` script. Fetches
today's K-LOVE "Verse of the Day" (English) and the corresponding verse in
the BPH ("Bibelen på hverdagsdansk") Danish translation from BibleGateway.

Unlike the Python version, this uses a plain `fetch` + [cheerio](https://cheerio.js.org/)
HTML parse instead of browser automation — both K-LOVE and BibleGateway
server-render the verse content, so no headless browser is needed.

## Setup

Requires Node.js (tested with Node 24 LTS).

```bash
cd bibelvers-js
npm install
```

## Usage

```bash
node bible_verse_lookup.js
```

Prints the K-LOVE verse of the day and its BPH Danish translation to stdout.

## Notes

- If K-LOVE or BibleGateway change their page layout, scraping will break.
  See `KLOVE_VERSE_SELECTOR` / `KLOVE_REFERENCE_SELECTOR` and
  `BIBLEGATEWAY_SELECTOR` in `bible_verse_lookup.js` — update these to
  match the new markup.
- The Python version (using Playwright) lives in `../bibelvers/`.
