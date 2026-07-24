#!/usr/bin/env bun
/**
 * Import Irene's poems into content/irene/*.md (one-time, local-only).
 *
 * Sources:
 *   1. A folder of .docx files (her full archive) — converted via macOS `textutil`.
 *   2. Optionally, the WhatsApp-extracted poems from the poesia-da-irene project
 *      (markdown files with frontmatter). Used to fill in dates and to add poems
 *      missing from the archive. On title collision the .docx version wins.
 *
 * Poem format inside the documents (same convention everywhere):
 *   TITLE    dd.mm.yyyy        <- date optional, sometimes on the next line
 *   verse lines...
 *   Irene Diaz Rodrigues       <- signature, stripped
 *
 * Usage:
 *   bun scripts/import-irene.ts "<docx-dir>" ["<whatsapp-poems-dir>"]
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const OUT_DIR = join(ROOT, "content/irene");

const docxDir = process.argv[2];
const whatsappDir = process.argv[3];
if (!docxDir || !existsSync(docxDir)) {
  console.error(
    'Usage: bun scripts/import-irene.ts "<docx-dir>" ["<whatsapp-poems-dir>"]',
  );
  process.exit(1);
}

interface Poem {
  title: string;
  date: string | null; // YYYY-MM-DD
  dateFromHeader: boolean; // true when the date was written in the poem itself
  text: string;
  source: "arquivo" | "whatsapp";
}

const DATE_RE = /(\d{1,2})[./](\d{1,2})[.,/](\d{4})/;
const SIGNATURE_RE = /^\s*Irene\s+Diaz\s+Rodrigues\.?\s*$/i;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slugify(s: string): string {
  return (
    normalize(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "sem-titulo"
  );
}

function isoDate(m: RegExpMatchArray): string {
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Parse title/date/body out of plain poem text. */
function parsePoem(
  raw: string,
  fallbackDate: string | null,
): Omit<Poem, "source"> | null {
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter(
      (l, i, arr) => !(l.trim() === "" && (arr[i - 1] ?? "").trim() === ""),
    );

  // strip signature (and trailing blanks) from the end
  while (
    lines.length &&
    (SIGNATURE_RE.test(lines[lines.length - 1]) ||
      !lines[lines.length - 1].trim())
  ) {
    lines.pop();
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  if (!lines.length) return null;

  let title = lines[0].replace(/\s+/g, " ").trim();
  let date: string | null = null;
  let bodyStart = 1;

  const inTitle = title.match(DATE_RE);
  if (inTitle) {
    date = isoDate(inTitle);
    title = title.replace(DATE_RE, "").trim();
  } else if (lines[1]) {
    const nextLine = lines[1].trim().match(DATE_RE);
    if (nextLine && lines[1].trim().replace(DATE_RE, "").trim() === "") {
      date = isoDate(nextLine);
      bodyStart = 2;
    }
  }

  title = title.replace(/[.\s*_]+$/, "").trim() || "Sem título";
  const text = lines
    .slice(bodyStart)
    .map((l) => l.replace(/^\t+/, ""))
    .join("\n")
    .trim();
  if (!text) return null;
  return {
    title,
    date: date ?? fallbackDate,
    dateFromHeader: date !== null,
    text,
  };
}

// -- 1. Read .docx archive --------------------------------------------------

// Same title can be two different poems (distinct header dates) or the same
// poem saved twice. Variants are kept per normalized title.
const poems = new Map<string, Poem[]>();

function addPoem(poem: Poem): boolean {
  const key = normalize(poem.title);
  const variants = poems.get(key);
  if (!variants) {
    poems.set(key, [poem]);
    return true;
  }
  const isDuplicate = variants.some(
    (v) =>
      v.date === poem.date ||
      !v.dateFromHeader ||
      !poem.dateFromHeader ||
      normalize(v.text) === normalize(poem.text),
  );
  if (isDuplicate) return false;
  variants.push(poem); // same title, different dated poem
  return true;
}

const docxFiles = readdirSync(docxDir).filter((f) => f.endsWith(".docx"));
let converted = 0;
let skipped = 0;
for (const file of docxFiles) {
  const path = join(docxDir, file);
  const out = spawnSync("textutil", ["-convert", "txt", "-stdout", path], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (out.status !== 0 || !out.stdout.trim()) {
    console.warn(`  ⚠️ conversão falhou: ${file}`);
    skipped++;
    continue;
  }
  // file mtime is the original save date in this archive — good fallback
  const mtime = statSync(path).mtime.toISOString().slice(0, 10);
  const poem = parsePoem(out.stdout, mtime);
  if (!poem) {
    console.warn(`  ⚠️ vazio após parse: ${file}`);
    skipped++;
    continue;
  }
  if (addPoem({ ...poem, source: "arquivo" })) converted++;
  else console.warn(`  cópia ignorada: ${poem.title} (${file})`);
}

// -- 2. Merge WhatsApp poems ------------------------------------------------

let waAdded = 0;
let waDated = 0;
if (whatsappDir && existsSync(whatsappDir)) {
  for (const file of readdirSync(whatsappDir).filter((f) =>
    f.endsWith(".md"),
  )) {
    const raw = readFileSync(join(whatsappDir, file), "utf-8");
    const m = raw.match(/^---\n([\s\S]*?)\n---\n+([\s\S]*)$/);
    if (!m) continue;
    const title = m[1].match(/^title:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
    const date = m[1].match(/^date:\s*(\S+)/m)?.[1] ?? null;
    const text = m[2].trim();
    if (!title || !text) continue;
    const variants = poems.get(normalize(title));
    if (variants) {
      // archive version wins; WhatsApp date is reliable when archive had none
      const match =
        variants.find((v) => v.date === date) ??
        variants.find((v) => !v.dateFromHeader);
      if (match && date && !match.dateFromHeader) {
        match.date = date;
        match.dateFromHeader = true;
        waDated++;
      }
    } else {
      poems.set(normalize(title), [
        {
          title,
          date,
          dateFromHeader: date !== null,
          text,
          source: "whatsapp",
        },
      ]);
      waAdded++;
    }
  }
}

// -- 3. Write content/irene/*.md ---------------------------------------------

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const slugs = new Set<string>();
const allPoems = [...poems.values()].flat();
for (const poem of allPoems) {
  let slug = slugify(poem.title);
  for (let i = 2; slugs.has(slug); i++) slug = `${slugify(poem.title)}-${i}`;
  slugs.add(slug);

  const front = [
    "---",
    `slug: ${slug}`,
    `title: "${poem.title.replace(/"/g, "'")}"`,
    poem.date ? `date: ${poem.date}` : null,
    `source: ${poem.source}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
  writeFileSync(join(OUT_DIR, `${slug}.md`), `${front}\n\n${poem.text}\n`);
}

console.log(
  `\n✅ ${allPoems.length} poesias em content/irene/ ` +
    `(${converted} do arquivo, +${waAdded} só do WhatsApp, ${waDated} datas completadas, ${skipped} puladas)`,
);
