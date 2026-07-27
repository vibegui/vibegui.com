export type OgLocale = "pt-BR" | "en";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const MONTHS = {
  "pt-BR": [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ],
  en: [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ],
} as const;

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function graphemes(value: string): string[] {
  return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment);
}

function textUnits(value: string): number {
  return graphemes(value).reduce((width, character) => {
    if (/\s/u.test(character)) return width + 0.35;
    if (/[ilI1.,:;!'|]/u.test(character)) return width + 0.45;
    if (/[mwMW@%&]/u.test(character)) return width + 1.25;
    return width + 1;
  }, 0);
}

function trimToUnits(value: string, maxUnits: number): string {
  const result: string[] = [];
  let width = 0;
  for (const character of graphemes(value)) {
    const nextWidth = textUnits(character);
    if (width + nextWidth > maxUnits) break;
    result.push(character);
    width += nextWidth;
  }
  return result.join("").trimEnd();
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function localeMarker(locale: OgLocale): "PT" | "EN" {
  return locale === "pt-BR" ? "PT" : "EN";
}

export function formatOgDate(date: string, locale: OgLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid article date: ${date}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  ) {
    throw new Error(`Invalid article date: ${date}`);
  }

  const monthName = MONTHS[locale][month - 1];
  return locale === "pt-BR"
    ? `${String(day).padStart(2, "0")} ${monthName} ${year}`
    : `${monthName} ${String(day).padStart(2, "0")}, ${year}`;
}

export interface WrappedTitle {
  lines: string[];
  truncated: boolean;
}

export function wrapTitle(
  title: string,
  maxUnits: number,
  maxLines = 3,
): WrappedTitle {
  const words = title.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let wordIndex = 0;

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex] ?? "";
    const candidate = line ? `${line} ${word}` : word;
    if (textUnits(candidate) <= maxUnits) {
      line = candidate;
      wordIndex++;
      continue;
    }

    if (line) {
      lines.push(line);
      line = "";
      continue;
    }

    lines.push(trimToUnits(word, maxUnits));
    words[wordIndex] = graphemes(word)
      .slice(graphemes(lines.at(-1) ?? "").length)
      .join("");
    if (!words[wordIndex]) wordIndex++;
  }

  if (line && lines.length < maxLines) lines.push(line);
  const truncated = wordIndex < words.length;
  if (truncated && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${trimToUnits(lines[last] ?? "", maxUnits - 1.2)}…`;
  }

  return { lines, truncated };
}

export interface TitleLayout extends WrappedTitle {
  fontSize: number;
}

export function layoutTitle(title: string): TitleLayout {
  const titleWidth = 920;
  for (const fontSize of [84, 76, 68, 60, 54]) {
    const wrapped = wrapTitle(title, titleWidth / (fontSize * 0.54));
    if (!wrapped.truncated) return { ...wrapped, fontSize };
  }
  return {
    ...wrapTitle(title, titleWidth / (54 * 0.54)),
    fontSize: 54,
  };
}

export interface OgTemplateInput {
  title: string;
  locale: OgLocale;
  date: string;
  tag?: string;
}

export function renderOgSvg(input: OgTemplateInput): string {
  const layout = layoutTitle(input.title);
  const lineHeight = Math.round(layout.fontSize * 1.03);
  const titleY = 224 - Math.max(0, layout.lines.length - 2) * 20;
  const title = layout.lines
    .map(
      (line, index) =>
        `<text x="92" y="${titleY + index * lineHeight}" class="title">${escapeXml(line)}</text>`,
    )
    .join("");
  const tag = input.tag?.trim()
    ? `<text x="600" y="554" text-anchor="middle" class="meta">${escapeXml(input.tag.trim().toUpperCase())}</text>`
    : "";
  const dots = Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 12 }, (_, column) => {
      const radius = 1.3 + ((row + column) % 3) * 0.65;
      return `<circle cx="${902 + column * 22}" cy="${82 + row * 22}" r="${radius.toFixed(2)}" />`;
    }).join(""),
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="1200" height="630" fill="#121310"/>
  <g stroke="#a6bda8" stroke-width="1" opacity=".075">
    <path d="M0 72H1200M0 144H1200M0 216H1200M0 288H1200M0 360H1200M0 432H1200M0 504H1200M0 576H1200"/>
    <path d="M72 0V630M144 0V630M216 0V630M288 0V630M360 0V630M432 0V630M504 0V630M576 0V630M648 0V630M720 0V630M792 0V630M864 0V630M936 0V630M1008 0V630M1080 0V630M1152 0V630"/>
  </g>
  <rect x="0" y="0" width="16" height="630" fill="#07401a"/>
  <rect x="16" y="0" width="4" height="142" fill="#d0ec1a"/>
  <g fill="#a6bda8" opacity=".14">${dots}</g>
  <style>
    .brand { font: 600 29px Inter, Arial, sans-serif; letter-spacing: 1px; fill: #a6bda8; }
    .marker { font: 700 18px Inter, Arial, sans-serif; letter-spacing: 2px; fill: #121310; }
    .title { font: 500 ${layout.fontSize}px Newsreader, Georgia, "Times New Roman", serif; letter-spacing: -1.5px; fill: #eeede7; }
    .meta { font: 600 18px "JetBrains Mono", Menlo, monospace; letter-spacing: 1.4px; fill: #a29f96; }
  </style>
  <text x="92" y="91" class="brand">vibegui</text>
  <rect x="1036" y="55" width="72" height="52" rx="2" fill="#a6bda8"/>
  <text x="1073" y="88" text-anchor="middle" class="marker">${localeMarker(input.locale)}</text>
  ${title}
  <path d="M92 504H1108" stroke="#2b2e27" stroke-width="2"/>
  <circle cx="99" cy="554" r="5" fill="#d0ec1a"/>
  <text x="119" y="560" class="meta">${escapeXml(formatOgDate(input.date, input.locale))}</text>
  ${tag}
  <text x="1108" y="560" text-anchor="end" class="meta">VIBEGUI.COM</text>
</svg>`;
}
