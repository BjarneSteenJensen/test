# Bible Verse Lookup (Python)

Fetches today's K-LOVE "Verse of the Day" (English) and the corresponding
verse in the BPH ("Bibelen på hverdagsdansk") Danish translation from
BibleGateway.

Uses Playwright to drive a real (headless) browser to load the K-LOVE and
BibleGateway pages before scraping the verse text.

## Setup

Uses the shared project venv at `/home/bird/Dokumenter/claude/myenv`.

```bash
source /home/bird/Dokumenter/claude/myenv/bin/activate
pip install playwright
playwright install chromium
```

Playwright's Chromium build also needs a handful of OS-level libraries to
launch (Ubuntu/Debian-based systems, e.g. Zorin OS):

```bash
sudo playwright install-deps
# or, equivalently:
sudo apt-get install libx11-xcb1 libxrandr2 libxcomposite1 libxcursor1 \
    libxdamage1 libxi6 libxfixes3 libgtk-3-0t64 libpangocairo-1.0-0 \
    libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libgdk-pixbuf-2.0-0 \
    libasound2t64
```

## Usage

```bash
source /home/bird/Dokumenter/claude/myenv/bin/activate
python3 bible_verse_lookup.py
```

Prints the K-LOVE verse of the day and its BPH Danish translation to stdout.

## Notes

- If K-LOVE or BibleGateway change their page layout, scraping will break.
  See `KLOVE_VERSE_SELECTOR` / `KLOVE_REFERENCE_SELECTOR` and
  `BIBLEGATEWAY_SELECTORS` in `bible_verse_lookup.py` — update these to
  match the new markup.
- A JavaScript port that doesn't require a browser (both source pages are
  server-rendered) lives in `../bibelvers-js/`.
