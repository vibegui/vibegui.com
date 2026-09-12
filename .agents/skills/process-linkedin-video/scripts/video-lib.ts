import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import {
  BRAND_FOREST,
  BRAND_LIME,
  EDGE_SILENCE_TO_KEEP_SECONDS,
  FONT_FAMILY,
  INTERNAL_SILENCE_TO_KEEP_SECONDS,
} from "./config.ts";

export interface SilenceInterval {
  start: number;
  end: number;
  duration: number;
}

export interface KeepSegment {
  start: number;
  end: number;
}

export interface TimedWord {
  text: string;
  normalized: string;
  start: number;
  end: number;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface AlignmentResult {
  confidence: number;
  matchedWords: number;
  totalCanonicalWords: number;
  words: TimedWord[];
}

interface WhisperToken {
  text?: unknown;
  offsets?: {
    from?: unknown;
    to?: unknown;
  };
}

interface WhisperSegment {
  text?: unknown;
  offsets?: {
    from?: unknown;
    to?: unknown;
  };
  tokens?: unknown;
}

const WORD_ALIASES = new Map([
  ["pra", "para"],
  ["pras", "paraas"],
  ["pro", "parao"],
  ["pros", "paraos"],
  ["ta", "esta"],
  ["tava", "estava"],
]);

export function cleanTranscript(input: string): string {
  return input
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(?:#{1,6}\s*)?(?:transcript|transcrição)$/iu.test(line),
    )
    .map((line) => line.replace(/^[-*]\s+/u, ""))
    .map((line) =>
      line.replace(
        /^(?:\[[^\]]+\]\s*)?(?:speaker\s+\d+|you|você|gui|guilherme(?:\s+[\p{L}-]+){0,3})\s*:\s*/iu,
        "",
      ),
    )
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeWord(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]/gu, "");
  return WORD_ALIASES.get(normalized) ?? normalized;
}

export function tokenizeCanonical(transcript: string): TimedWord[] {
  return cleanTranscript(transcript)
    .split(/\s+/u)
    .map((text) => ({
      text,
      normalized: normalizeWord(text),
      start: 0,
      end: 0,
    }))
    .filter((word) => word.normalized.length > 0);
}

export function parseSilenceDetect(
  output: string,
  totalDuration: number,
): SilenceInterval[] {
  const intervals: SilenceInterval[] = [];
  let pendingStart: number | null = null;

  for (const line of output.split("\n")) {
    const startMatch = line.match(/silence_start:\s*(-?\d+(?:\.\d+)?)/u);
    if (startMatch?.[1] !== undefined) {
      pendingStart = Math.max(0, Number(startMatch[1]));
    }

    const endMatch = line.match(
      /silence_end:\s*(-?\d+(?:\.\d+)?)\s*\|\s*silence_duration:\s*(\d+(?:\.\d+)?)/u,
    );
    if (endMatch?.[1] !== undefined) {
      const end = Math.min(totalDuration, Number(endMatch[1]));
      const reportedDuration = Number(endMatch[2] ?? 0);
      const start = pendingStart ?? Math.max(0, end - reportedDuration);
      if (end > start) {
        intervals.push({ start, end, duration: end - start });
      }
      pendingStart = null;
    }
  }

  if (pendingStart !== null && totalDuration > pendingStart) {
    intervals.push({
      start: pendingStart,
      end: totalDuration,
      duration: totalDuration - pendingStart,
    });
  }

  return intervals.sort((a, b) => a.start - b.start);
}

export function buildKeepSegments(
  totalDuration: number,
  silences: SilenceInterval[],
): KeepSegment[] {
  const cuts: KeepSegment[] = [];

  for (const silence of silences) {
    if (silence.duration < 0.7) continue;

    if (silence.start <= 0.05) {
      const cutEnd = silence.end - EDGE_SILENCE_TO_KEEP_SECONDS;
      if (cutEnd > 0.05) cuts.push({ start: 0, end: cutEnd });
      continue;
    }

    if (silence.end >= totalDuration - 0.05) {
      const cutStart = silence.start + EDGE_SILENCE_TO_KEEP_SECONDS;
      if (totalDuration - cutStart > 0.05) {
        cuts.push({ start: cutStart, end: totalDuration });
      }
      continue;
    }

    const halfPause = INTERNAL_SILENCE_TO_KEEP_SECONDS / 2;
    const cutStart = silence.start + halfPause;
    const cutEnd = silence.end - halfPause;
    if (cutEnd - cutStart > 0.05) {
      cuts.push({ start: cutStart, end: cutEnd });
    }
  }

  const mergedCuts: KeepSegment[] = [];
  for (const cut of cuts.sort((a, b) => a.start - b.start)) {
    const previous = mergedCuts.at(-1);
    if (previous && cut.start <= previous.end) {
      previous.end = Math.max(previous.end, cut.end);
    } else {
      mergedCuts.push({ ...cut });
    }
  }

  const keep: KeepSegment[] = [];
  let cursor = 0;
  for (const cut of mergedCuts) {
    if (cut.start - cursor >= 0.05) {
      keep.push({ start: cursor, end: cut.start });
    }
    cursor = Math.max(cursor, cut.end);
  }
  if (totalDuration - cursor >= 0.05) {
    keep.push({ start: cursor, end: totalDuration });
  }

  return keep.length > 0 ? keep : [{ start: 0, end: totalDuration }];
}

export function editedDuration(segments: KeepSegment[]): number {
  return segments.reduce(
    (total, segment) => total + segment.end - segment.start,
    0,
  );
}

export function buildEditFilterGraph(segments: KeepSegment[]): string {
  const graph: string[] = [];
  const inputs: string[] = [];

  segments.forEach((segment, index) => {
    const start = segment.start.toFixed(3);
    const end = segment.end.toFixed(3);
    graph.push(
      "[0:v]trim=start=" +
        start +
        ":end=" +
        end +
        ",setpts=PTS-STARTPTS[v" +
        index +
        "]",
    );
    graph.push(
      "[0:a]atrim=start=" +
        start +
        ":end=" +
        end +
        ",asetpts=PTS-STARTPTS[a" +
        index +
        "]",
    );
    inputs.push("[v" + index + "][a" + index + "]");
  });

  graph.push(
    inputs.join("") +
      "concat=n=" +
      segments.length +
      ":v=1:a=1[joinedv][joineda]",
  );
  graph.push(
    "[joinedv]scale=1080:1920:force_original_aspect_ratio=increase," +
      "crop=1080:1920,setsar=1,fps=30,format=yuv420p[vout]",
  );
  graph.push("[joineda]loudnorm=I=-16:LRA=11:TP=-1.5,aresample=48000[aout]");

  return graph.join(";");
}

function appendWhisperToken(
  words: TimedWord[],
  rawText: string,
  start: number,
  end: number,
): void {
  if (/^\s*\[[^\]]+\]\s*$/u.test(rawText)) return;

  const pieces = rawText.match(/\s+|[^\s]+/gu) ?? [];
  let startsNewWord = /^\s/u.test(rawText) || words.length === 0;

  for (const piece of pieces) {
    if (/^\s+$/u.test(piece)) {
      startsNewWord = true;
      continue;
    }

    const normalized = normalizeWord(piece);
    const previous = words.at(-1);
    if (normalized.length === 0) {
      if (previous && /^[\p{P}\p{S}]+$/u.test(piece)) {
        previous.text += piece;
        previous.end = Math.max(previous.end, end);
      }
      continue;
    }

    if (startsNewWord || !previous) {
      words.push({ text: piece, normalized, start, end: Math.max(start, end) });
    } else {
      previous.text += piece;
      previous.normalized = normalizeWord(previous.text);
      previous.end = Math.max(previous.end, end);
    }
    startsNewWord = false;
  }
}

export function parseWhisperWords(input: unknown): TimedWord[] {
  if (!input || typeof input !== "object") return [];
  const transcription = (input as { transcription?: unknown }).transcription;
  if (!Array.isArray(transcription)) return [];

  const words: TimedWord[] = [];
  for (const rawSegment of transcription) {
    if (!rawSegment || typeof rawSegment !== "object") continue;
    const segment = rawSegment as WhisperSegment;
    const segmentStart = Number(segment.offsets?.from ?? 0) / 1000;
    const segmentEnd =
      Number(segment.offsets?.to ?? segmentStart * 1000) / 1000;
    const tokens = Array.isArray(segment.tokens)
      ? (segment.tokens as WhisperToken[])
      : [];
    const before = words.length;

    for (const token of tokens) {
      if (typeof token.text !== "string") continue;
      const start = Number(token.offsets?.from ?? segmentStart * 1000) / 1000;
      const end = Number(token.offsets?.to ?? start * 1000) / 1000;
      appendWhisperToken(words, token.text, start, end);
    }

    if (words.length === before && typeof segment.text === "string") {
      const fallback = segment.text.trim().split(/\s+/u).filter(Boolean);
      const step =
        fallback.length > 0 ? (segmentEnd - segmentStart) / fallback.length : 0;
      fallback.forEach((text, index) => {
        appendWhisperToken(
          words,
          " " + text,
          segmentStart + index * step,
          segmentStart + (index + 1) * step,
        );
      });
    }
  }

  return words.filter((word) => word.normalized.length > 0);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return Math.max(0, 1 - levenshtein(a, b) / longest);
}

export function alignTranscript(
  transcript: string,
  whisperWords: TimedWord[],
  totalDuration: number,
): AlignmentResult {
  const canonical = tokenizeCanonical(transcript);
  if (canonical.length === 0) {
    throw new Error("O transcript do Wispr não contém palavras.");
  }
  if (whisperWords.length === 0) {
    throw new Error("O Whisper local não encontrou fala no vídeo editado.");
  }

  const rows = canonical.length + 1;
  const columns = whisperWords.length + 1;
  const costs = new Float64Array(rows * columns);
  const moves = new Uint8Array(rows * columns);
  const gap = 0.75;
  const at = (i: number, j: number) => i * columns + j;

  for (let i = 1; i < rows; i += 1) {
    costs[at(i, 0)] = i * gap;
    moves[at(i, 0)] = 2;
  }
  for (let j = 1; j < columns; j += 1) {
    costs[at(0, j)] = j * gap;
    moves[at(0, j)] = 3;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const canonicalWord = canonical[i - 1];
      const whisperWord = whisperWords[j - 1];
      if (!canonicalWord || !whisperWord) continue;
      const similarity = wordSimilarity(
        canonicalWord.normalized,
        whisperWord.normalized,
      );
      const substitution = similarity >= 0.5 ? 1 - similarity : 1.2;
      const diagonal = (costs[at(i - 1, j - 1)] ?? 0) + substitution;
      const up = (costs[at(i - 1, j)] ?? 0) + gap;
      const left = (costs[at(i, j - 1)] ?? 0) + gap;
      const best = Math.min(diagonal, up, left);
      costs[at(i, j)] = best;
      moves[at(i, j)] = best === diagonal ? 1 : best === up ? 2 : 3;
    }
  }

  const matched = new Map<number, { source: TimedWord; similarity: number }>();
  let i = canonical.length;
  let j = whisperWords.length;
  while (i > 0 || j > 0) {
    const move = moves[at(i, j)];
    if (move === 1 && i > 0 && j > 0) {
      const canonicalWord = canonical[i - 1];
      const whisperWord = whisperWords[j - 1];
      if (canonicalWord && whisperWord) {
        const similarity = wordSimilarity(
          canonicalWord.normalized,
          whisperWord.normalized,
        );
        if (similarity >= 0.58) {
          matched.set(i - 1, { source: whisperWord, similarity });
        }
      }
      i -= 1;
      j -= 1;
    } else if (move === 2 && i > 0) {
      i -= 1;
    } else if (j > 0) {
      j -= 1;
    } else {
      break;
    }
  }

  const similarityTotal = [...matched.values()].reduce(
    (total, item) => total + item.similarity,
    0,
  );
  const confidence = similarityTotal / canonical.length;
  const words = canonical.map((word, index) => {
    const match = matched.get(index);
    return match
      ? { ...word, start: match.source.start, end: match.source.end }
      : { ...word };
  });

  let cursor = 0;
  while (cursor < words.length) {
    if (matched.has(cursor)) {
      cursor += 1;
      continue;
    }
    const runStart = cursor;
    while (cursor < words.length && !matched.has(cursor)) cursor += 1;
    const runEnd = cursor;
    const count = runEnd - runStart;
    const previous = runStart > 0 ? words[runStart - 1] : undefined;
    const next = runEnd < words.length ? words[runEnd] : undefined;
    const left = previous?.end ?? 0;
    const right = next?.start ?? Math.max(totalDuration, left + count * 0.18);
    const span = Math.max(0, right - left);
    const step = count > 0 ? span / count : 0;
    for (let index = 0; index < count; index += 1) {
      const word = words[runStart + index];
      if (!word) continue;
      word.start = left + step * index;
      word.end = left + step * (index + 1);
    }
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) continue;
    const previous = words[index - 1];
    word.start = Math.max(0, Math.min(totalDuration, word.start));
    if (previous && word.start < previous.start) word.start = previous.start;
    word.end = Math.max(word.start + 0.04, word.end);
    word.end = Math.min(totalDuration, word.end);
  }

  return {
    confidence,
    matchedWords: matched.size,
    totalCanonicalWords: canonical.length,
    words,
  };
}

function wrapCaption(text: string): string {
  if (text.length <= 32) return text;
  const words = text.split(" ");
  let bestIndex = Math.ceil(words.length / 2);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    const right = words.slice(index).join(" ");
    const overflow =
      Math.max(0, left.length - 34) + Math.max(0, right.length - 34);
    const score = overflow * 100 + Math.abs(left.length - right.length);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return (
    words.slice(0, bestIndex).join(" ") +
    "\n" +
    words.slice(bestIndex).join(" ")
  );
}

export function groupCaptions(
  words: TimedWord[],
  totalDuration: number,
): CaptionCue[] {
  if (words.length === 0) return [];
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];

  for (const word of words) {
    const previous = current.at(-1);
    const candidateText = [...current, word].map((item) => item.text).join(" ");
    const shouldBreak =
      current.length > 0 &&
      (current.length >= 7 ||
        candidateText.length > 64 ||
        word.end - (current[0]?.start ?? word.start) > 2.8 ||
        (previous !== undefined && word.start - previous.end > 0.5) ||
        (previous !== undefined &&
          /[.!?…]$/u.test(previous.text) &&
          current.length >= 3));

    if (shouldBreak) {
      groups.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length > 0) groups.push(current);

  const cues = groups.map((group) => ({
    start: Math.max(0, (group[0]?.start ?? 0) - 0.08),
    end: Math.min(totalDuration, (group.at(-1)?.end ?? 0) + 0.16),
    text: wrapCaption(group.map((word) => word.text).join(" ")),
  }));

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (!cue) continue;
    const next = cues[index + 1];
    if (next) cue.end = Math.min(cue.end, next.start - 0.04);
    if (cue.end - cue.start < 0.55) {
      cue.end = Math.min(totalDuration, cue.start + 0.55);
      if (next) cue.end = Math.min(cue.end, next.start - 0.02);
    }
    cue.end = Math.max(cue.start + 0.04, cue.end);
  }

  return cues;
}

function formatSrtTimestamp(seconds: number): string {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0") +
    "," +
    String(millis).padStart(3, "0")
  );
}

function formatAssTimestamp(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6000);
  const secs = Math.floor((centiseconds % 6000) / 100);
  const cents = centiseconds % 100;
  return (
    String(hours) +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0") +
    "." +
    String(cents).padStart(2, "0")
  );
}

export function createSrt(cues: CaptionCue[]): string {
  return (
    cues
      .map(
        (cue, index) =>
          String(index + 1) +
          "\n" +
          formatSrtTimestamp(cue.start) +
          " --> " +
          formatSrtTimestamp(cue.end) +
          "\n" +
          cue.text +
          "\n",
      )
      .join("\n") + "\n"
  );
}

function toAssColor(hex: string, alpha = "00"): string {
  const clean = hex.replace("#", "");
  const red = clean.slice(0, 2);
  const green = clean.slice(2, 4);
  const blue = clean.slice(4, 6);
  return "&H" + alpha + blue + green + red;
}

function escapeAssText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", "\\N");
}

export function createAss(
  cues: CaptionCue[],
  totalDuration: number,
  fontFamily = FONT_FAMILY,
): string {
  const lime = toAssColor(BRAND_LIME);
  const forest = toAssColor(BRAND_FOREST);
  const translucentForest = toAssColor(BRAND_FOREST, "70");
  const end = formatAssTimestamp(totalDuration);
  const events = cues.map(
    (cue) =>
      "Dialogue: 1," +
      formatAssTimestamp(cue.start) +
      "," +
      formatAssTimestamp(cue.end) +
      ",Captions,,0,0,0,," +
      escapeAssText(cue.text),
  );
  events.push(
    "Dialogue: 2,0:00:00.00," + end + ",FooterLeft,,0,0,0,,vibegui.com",
    "Dialogue: 2,0:00:00.00," + end + ",FooterRight,,0,0,0,,decocms.com",
  );

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1080",
    "PlayResY: 1920",
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    "Style: Captions," +
      fontFamily +
      ",72," +
      lime +
      "," +
      lime +
      "," +
      forest +
      "," +
      translucentForest +
      ",0,0,0,0,100,100,0,0,3,4,0,2,96,96,390,1",
    "Style: FooterLeft," +
      fontFamily +
      ",30," +
      lime +
      "," +
      lime +
      "," +
      forest +
      "," +
      forest +
      ",0,0,0,0,100,100,1,0,1,2,0,1,72,72,170,1",
    "Style: FooterRight," +
      fontFamily +
      ",30," +
      lime +
      "," +
      lime +
      "," +
      forest +
      "," +
      forest +
      ",0,0,0,0,100,100,1,0,1,2,0,3,72,72,170,1",
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...events,
    "",
  ].join("\n");
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}
