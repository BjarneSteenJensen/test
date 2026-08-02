# Bible Chapter Lookup

Fetches today's K-LOVE "Verse of the Day" (English) and displays the whole
surrounding chapter in the BPH ("Bibelen på hverdagsdansk") Danish
translation from BibleGateway.

Built on the same K-LOVE/BibleGateway fetch logic as
`../bibelvers-js/bible_verse_lookup.js`, but instead of fetching just the
single verse from BibleGateway, it strips the `:verse` part of the reference
(e.g. "John 3:16" → "John 3") and fetches the full chapter.

## Setup

Requires Node.js (tested with Node 24 LTS).

```bash
cd biblechapter
npm install
```

## Usage

```bash
node bible_chapter_lookup.js
```

Prints the K-LOVE verse of the day, then the full BPH Danish chapter text
(with section headings and verse numbers) to stdout.

## Notes

- If K-LOVE or BibleGateway change their page layout, scraping will break.
  See `KLOVE_VERSE_SELECTOR` / `KLOVE_REFERENCE_SELECTOR` and
  `BIBLEGATEWAY_SELECTOR` in `bible_chapter_lookup.js` — update these to
  match the new markup.
