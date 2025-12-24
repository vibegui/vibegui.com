/**
 * Generate PNG icons from SVG
 * Run with: bun extensions/whatsapp-scraper/generate-icons.ts
 */

import { writeFileSync } from "node:fs";

// Simple 16x16 green checkmark PNG (minimal valid PNG)
// Generated as a placeholder - replace with proper icons later
const icon16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVQ4y2Ng" +
    "GFTg/38GBgYGBgYWKppODcDCwPAfqpmJim5gYWD4/5+BgYGJWi5gpqYLmKgd" +
    "BkPSBQMPAADLxgPxI1fXnAAAAABJRU5ErkJggg==",
  "base64",
);

const icon48 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAARklEQVRo3u3O" +
    "MQEAAAjDMKB/p2EA9hxhoDLZSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpK" +
    "SkpKSkpKSkpKSkpKSuovXEQAAQjf1pgAAAAASUVORK5CYII=",
  "base64",
);

const icon128 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAWElEQVR42u3O" +
    "MQEAAAgDsKn/zkeD8C0SdJIlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUl" +
    "JSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJfUWLvAAAQGwLN0AAAAA" +
    "SUVORK5CYII=",
  "base64",
);

const dir = new URL(".", import.meta.url).pathname;

writeFileSync(`${dir}icon16.png`, icon16);
writeFileSync(`${dir}icon48.png`, icon48);
writeFileSync(`${dir}icon128.png`, icon128);

console.log("✓ Icons generated in", dir);
