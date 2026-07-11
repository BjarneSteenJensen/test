# Peter A. Levine Digest — Routine Prompt

This is the prompt used by the scheduled cloud routine **"Daily Peter A. Levine (Somatic Experiencing) Digest"** (`trig_0166E8FALHL2tx2QCaToX19B`), which runs daily at 05:00 UTC (7am Copenhagen summer time) and writes the digests in this directory plus a Google Doc.

Routine settings: model `claude-sonnet-5`, tools Bash/WebSearch/WebFetch/Read/Write, Google Drive MCP connector, repo `BjarneSteenJensen/test`.

Manage it at: https://claude.ai/code/routines/trig_0166E8FALHL2tx2QCaToX19B

---

Your task is to collect, summarize, and save a daily news digest focused specifically on Peter A. Levine — the creator of Somatic Experiencing (SE) — covering three things: (1) news mentions of him, (2) his books, and (3) newsgroups/forums/communities discussing his work.

Step 1: Get today's date by running `date +%Y-%m-%d` in Bash.

Step 2: Search for relevant material using WebSearch with these queries (substitute today's date/month/year):
- "Peter A. Levine news [month year]"
- "Peter Levine Somatic Experiencing interview [month year]"
- "Peter Levine book [year]" (e.g. Waking the Tiger, In an Unspoken Voice, Trauma and Memory, Healing Trauma)
- "Peter Levine new book OR reprint OR translation [year]"
- "Peter Levine podcast OR lecture OR event [month year]"
- "Somatic Experiencing forum Peter Levine discussion"
- "Peter Levine Reddit OR newsgroup OR mailing list"
- "site:reddit.com Peter Levine somatic experiencing"

Step 3: Use WebFetch to read the 3-5 most relevant articles, book listings/reviews, interviews, or forum/newsgroup threads. For newsgroups/forums, prioritize actual discussion threads (Reddit, dedicated SE/trauma-therapy forums, mailing lists) over generic marketing pages.

Step 4: Organize findings into these categories:
- News & Media Mentions of Peter A. Levine
- Books (new editions, translations, reviews, notable mentions of his existing books: Waking the Tiger, In an Unspoken Voice, Healing Trauma, Trauma and Memory, etc.)
- Newsgroups, Forums & Online Discussion (Reddit threads, SE community forums, mailing lists, social media discussion about his work)
- Talks, Interviews & Events (podcasts, lectures, workshops featuring him)

Step 5: Write the digest in this format:

# Peter A. Levine Digest — [DATE]

## Overview
[2-3 sentences on today's most notable mentions, book news, or discussion involving Peter A. Levine]

## News & Media Mentions
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Books
- **[Book title / headline]**: [2-3 sentence summary]. Source: [URL]

## Newsgroups, Forums & Online Discussion
- **[Thread/forum title]**: [2-3 sentence summary of what's being discussed]. Source: [URL]

## Talks, Interviews & Events
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Key Takeaway
[1-2 sentences on the single most important item today]

If there is little or no news specific to Peter A. Levine on a given day, note that clearly. Do not pad the digest with generic Somatic Experiencing or trauma-therapy news that doesn't mention him or his books directly — keep the focus on Levine himself, his books, and discussion of his work.

Step 6: Save the digest as a new Google Doc via the Google Drive MCP tool. Title it: "Peter A. Levine Digest — [DATE]" (e.g. "Peter A. Levine Digest — 2026-07-11").

Step 7: Also publish the digest to GitHub. A git checkout of https://github.com/BjarneSteenJensen/test is already mounted in your working directory. Write the same digest content to `digests/somatic-experiencing/[DATE].md` in that repository (create the directory if it doesn't exist yet), then run:
- `git add digests/somatic-experiencing/[DATE].md`
- `git commit -m "Daily Peter A. Levine digest for [DATE]"`
- `git push`

Cite all sources with links. Be factual and concise — this concerns a mental-health treatment modality and its author, so avoid overstating research conclusions or making unverified claims about him personally.
