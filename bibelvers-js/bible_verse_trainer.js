#!/usr/bin/env node
/**
 * Bible Verse Trainer
 * Picks a random verse in BPH ("Bibelen på hverdagsdansk") from
 * BibleGateway and trains you to memorise it: first one word is hidden,
 * then two, then three ... until you can type the whole verse from memory.
 *
 * Uses fetchBphPassage() from bible_verse_lookup.js for the verse lookup.
 *
 * Usage:
 *   node bible_verse_trainer.js                  # random verse
 *   node bible_verse_trainer.js "John 3:16"      # specific verse
 *   node bible_verse_trainer.js --step 2         # hide 2 more words per round
 */

import * as cheerio from "cheerio";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  BIBLEGATEWAY_SELECTOR,
  BIBLEGATEWAY_URL,
  fetchBphPassage,
  fetchHtml,
} from "./bible_verse_lookup.js";

// [English book name as BibleGateway accepts it, number of chapters]
const BOOKS = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36],
  ["Deuteronomy", 34], ["Joshua", 24], ["Judges", 21], ["Ruth", 4],
  ["1 Samuel", 31], ["2 Samuel", 24], ["1 Kings", 22], ["2 Kings", 25],
  ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10], ["Nehemiah", 13],
  ["Esther", 10], ["Job", 42], ["Psalm", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Songs", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14],
  ["Joel", 3], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7],
  ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2],
  ["Zechariah", 14], ["Malachi", 4],
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
  ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13],
  ["Galatians", 6], ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4],
  ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
  ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13],
  ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1],
  ["3 John", 1], ["Jude", 1], ["Revelation", 22],
];

const MIN_WORDS = 6; // skip verses too short to be worth training
const MAX_ATTEMPTS = 5;
const BLANK = "_____";

function randomInt(n) {
  return Math.floor(Math.random() * n);
}

/** Pick a random chapter, every chapter in the Bible equally likely. */
function randomChapter() {
  const total = BOOKS.reduce((sum, [, chapters]) => sum + chapters, 0);
  let pick = randomInt(total);
  for (const [book, chapters] of BOOKS) {
    if (pick < chapters) return `${book} ${pick + 1}`;
    pick -= chapters;
  }
}

/** Return the verse numbers BPH has for a chapter, e.g. [1, 2, ..., 6]. */
async function fetchVerseNumbers(chapterReference) {
  const encodedRef = encodeURIComponent(chapterReference).replace(/%20/g, "+");
  const html = await fetchHtml(BIBLEGATEWAY_URL.replace("{ref}", encodedRef));
  const $ = cheerio.load(html);

  const verses = new Set();
  $(BIBLEGATEWAY_SELECTOR).first().find("span.text").each((_, el) => {
    // class looks like "text Ps-23-4"
    const match = ($(el).attr("class") || "").match(/-(\d+)-(\d+)\b/);
    if (match) verses.add(Number(match[2]));
  });
  return [...verses];
}

/** Strip the leading verse/chapter number and repair joined poetry lines. */
function cleanVerse(text) {
  return text
    .replace(/^\s*\d+\s*/, "")
    .replace(/([,.;:!?])(?=\p{L})/gu, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchRandomVerse() {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const chapter = randomChapter();
    const verses = await fetchVerseNumbers(chapter);
    if (!verses.length) continue;

    const reference = `${chapter}:${verses[randomInt(verses.length)]}`;
    const text = cleanVerse(await fetchBphPassage(reference));
    if (text.split(" ").length >= MIN_WORDS) return { reference, text };
  }
  throw new Error("Could not find a suitable random verse — try again.");
}

/** Split "frygte," into { pre: "", word: "frygte", post: "," }. */
function tokenize(text) {
  return text.split(" ").map((token) => {
    const [, pre, word, post] = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return { pre, word, post };
  });
}

function normalize(word) {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function render(tokens, hidden) {
  return tokens
    .map((t, i) => t.pre + (hidden.has(i) ? BLANK : t.word) + t.post)
    .join(" ");
}

/** Return the indexes (in order) of the blanks the user got wrong. */
function check(tokens, blanks, answer) {
  const typed = answer.split(/\s+/).map(normalize).filter(Boolean);
  return blanks.filter((index, n) => typed[n] !== normalize(tokens[index].word));
}

async function train(rl, reference, text, step) {
  const tokens = tokenize(text);
  // Hide words in a fixed random order, so each round keeps the earlier blanks.
  const order = shuffle(tokens.map((_, i) => i).filter((i) => tokens[i].word));

  console.log(`\n${reference} — Bibelen på hverdagsdansk:\n\n  ${text}\n`);
  await rl.question("Read it a few times, then press Enter to start training...");

  let count = Math.min(1, order.length);
  while (count <= order.length) {
    const hidden = new Set(order.slice(0, count));
    const blanks = [...hidden].sort((a, b) => a - b);
    const allHidden = count === order.length;

    console.log(`\nRound: ${count}/${order.length} words hidden\n\n  ${render(tokens, hidden)}\n`);
    const answer = await rl.question(
      allHidden ? "Type the whole verse: " : `Type the ${blanks.length} missing word(s) in order: `
    );
    if (answer.trim().toLowerCase() === "q") return false;

    const wrong = check(tokens, blanks, answer);
    if (wrong.length === 0) {
      console.log("✔ Correct!");
      if (allHidden) break;
      count = Math.min(count + step, order.length);
    } else {
      const shown = blanks
        .map((i) => (wrong.includes(i) ? `[${tokens[i].word}]` : tokens[i].word))
        .join(" ");
      console.log(`✘ ${wrong.length} wrong. Missing words were: ${shown}`);
      console.log("Same round again.");
    }
  }

  console.log(`\n🎉 You know ${reference} by heart!\n\n  ${text}\n`);
  return true;
}

function parseArgs(argv) {
  let step = 1;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--step") step = Math.max(1, parseInt(argv[++i], 10) || 1);
    else rest.push(argv[i]);
  }
  return { step, reference: rest.join(" ").trim() || null };
}

async function main() {
  const { step, reference } = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input: stdin, output: stdout });
  rl.on("close", () => process.exit(0));

  try {
    console.log("Bibelvers-træner (BPH). Type 'q' to quit.");
    let verse = reference
      ? { reference, text: cleanVerse(await fetchBphPassage(reference)) }
      : await fetchRandomVerse();

    while (await train(rl, verse.reference, verse.text, step)) {
      const again = await rl.question("Train another random verse? [Y/n] ");
      if (again.trim().toLowerCase().startsWith("n")) break;
      verse = await fetchRandomVerse();
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    rl.removeAllListeners("close");
    rl.close();
  }
}

main();
