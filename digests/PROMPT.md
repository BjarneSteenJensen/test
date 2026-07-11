# Claude Code News Digest — Routine Prompt

This is the prompt used by the scheduled cloud routine **"Daily Claude Code News Digest"** (`trig_015kM64tiRkb5xvH5U1Kuy3y`), which runs daily at 05:00 UTC (7am Copenhagen summer time) and writes the digests in this directory plus a Google Doc.

Routine settings: model `claude-sonnet-4-6`, tools Bash/WebSearch/WebFetch/Read/Write, Google Drive MCP connector, repo `BjarneSteenJensen/test`.

Manage it at: https://claude.ai/code/routines/trig_015kM64tiRkb5xvH5U1Kuy3y

---

Your task is to collect, summarize, and save a daily news digest focused exclusively on Claude Code — Anthropic's AI coding assistant CLI.

Step 1: Get today's date by running `date +%Y-%m-%d` in Bash.

Step 2: Search for Claude Code news using WebSearch with these queries (substitute today's date/month):
- "Claude Code news [date]"
- "Claude Code new features [month year]"
- "Claude Code release update [month year]"
- "Anthropic Claude Code announcement [month year]"
- "Claude Code MCP [month year]"
- "Claude Code IDE extension [month year]"
- "Claude Code agent SDK [month year]"

Step 3: Use WebFetch to read the 3-5 most relevant articles, changelogs, or blog posts.

Step 4: Organize findings into these categories:
- New Features & Releases
- Integrations & Extensions (IDE plugins, MCP servers, SDK)
- Bug Fixes & Performance
- Community & Ecosystem (tutorials, third-party tools)
- Roadmap & Announcements

Step 5: Write the digest in this format:

# Claude Code News Digest — [DATE]

## Overview
[2-3 sentences on today's biggest Claude Code developments]

## New Features & Releases
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Integrations & Extensions
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Bug Fixes & Performance
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Community & Ecosystem
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Roadmap & Announcements
- **[Headline]**: [2-3 sentence summary]. Source: [URL]

## Key Takeaway
[1-2 sentences on the single most important Claude Code development today]

If there is little or no Claude Code news for the day, note that clearly and include any relevant Anthropic announcements that may affect Claude Code users.

Step 6: Save the digest as a new Google Doc via the Google Drive MCP tool. Title it: "Claude Code News Digest — [DATE]" (e.g. "Claude Code News Digest — 2026-06-29").

Step 7: Also publish the digest to GitHub. A git checkout of https://github.com/BjarneSteenJensen/test is already mounted in your working directory. Write the same digest content to `digests/[DATE].md` in that repository (create the `digests/` directory if it doesn't exist yet), then run:
- `git add digests/[DATE].md`
- `git commit -m "Daily Claude Code digest for [DATE]"`
- `git push`

Cite all sources with links. Be factual and concise.
