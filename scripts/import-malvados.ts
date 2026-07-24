#!/usr/bin/env bun
/**
 * Import Malvados strips (one-time, local-only).
 *
 * Sources (from the local scrape of malvados.com.br):
 *   <src>/tirinhas/manifest.csv   — numero,arquivo,url_pagina
 *   <src>/tirinhas/*.{gif,jpg}    — strip images
 *   <src>/ocr/<arquivo>.txt       — OCR'd text of each strip (for search)
 *
 * Outputs:
 *   public/malvados/tirinhas/*    — images, served as-is
 *   content/malvados/strips.json  — [{ n, file, url, text }] consumed by generate
 *
 * Usage: bun scripts/import-malvados.ts <src-dir>
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const IMG_OUT = join(ROOT, "public/malvados/tirinhas");
const DATA_OUT = join(ROOT, "content/malvados");

const srcDir = process.argv[2];
if (!srcDir || !existsSync(join(srcDir, "tirinhas/manifest.csv"))) {
  console.error("Usage: bun scripts/import-malvados.ts <src-dir>");
  process.exit(1);
}

const tirinhasDir = join(srcDir, "tirinhas");
const ocrDir = join(srcDir, "ocr");

interface Strip {
  n: number;
  file: string;
  url: string;
  text: string;
}

function cleanOcr(raw: string): string {
  return (
    raw
      // oxlint-disable-next-line no-control-regex -- stripping OCR control chars is the point
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const strips: Strip[] = [];
const manifest = readFileSync(join(tirinhasDir, "manifest.csv"), "utf-8");
let missingImg = 0;
let missingOcr = 0;

for (const line of manifest.split("\n").slice(1)) {
  if (!line.trim()) continue;
  const [numero, arquivo, url] = line.split(",").map((s) => s.trim());
  const n = Number(numero);
  if (!Number.isInteger(n) || !arquivo) {
    console.warn(`  ⚠️ linha inválida no manifest: ${line}`);
    continue;
  }
  if (!existsSync(join(tirinhasDir, arquivo))) {
    missingImg++;
    continue;
  }
  const ocrPath = join(ocrDir, `${arquivo}.txt`);
  let text = "";
  if (existsSync(ocrPath)) {
    text = cleanOcr(readFileSync(ocrPath, "utf-8"));
  } else {
    missingOcr++;
  }
  strips.push({ n, file: arquivo, url: url || "", text });
}

strips.sort((a, b) => a.n - b.n);

// copy images
mkdirSync(IMG_OUT, { recursive: true });
let copied = 0;
for (const entry of readdirSync(tirinhasDir)) {
  if (entry === "manifest.csv") continue;
  copyFileSync(join(tirinhasDir, entry), join(IMG_OUT, entry));
  copied++;
}

mkdirSync(DATA_OUT, { recursive: true });
writeFileSync(join(DATA_OUT, "strips.json"), JSON.stringify(strips, null, 1));

console.log(
  `\n✅ ${strips.length} tirinhas em content/malvados/strips.json, ${copied} imagens em public/malvados/tirinhas/` +
    (missingImg ? `\n  ⚠️ ${missingImg} sem imagem` : "") +
    (missingOcr ? `\n  ⚠️ ${missingOcr} sem OCR` : ""),
);
