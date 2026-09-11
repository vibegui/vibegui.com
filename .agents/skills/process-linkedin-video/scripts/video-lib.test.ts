import { describe, expect, test } from "bun:test";

import {
  alignTranscript,
  buildEditFilterGraph,
  buildKeepSegments,
  cleanTranscript,
  createAss,
  createSrt,
  editedDuration,
  groupCaptions,
  normalizeWord,
  parseSilenceDetect,
  parseWhisperWords,
  slugify,
  tokenizeCanonical,
  wordSimilarity,
} from "./video-lib.ts";

describe("transcript do Wispr", () => {
  test("remove cabeçalho, bullets e rótulo de locutor sem reescrever a fala", () => {
    const transcript = `# Transcrição

Guilherme: Eu demorei dois anos pra aceitar.
- Ferramenta ficou abundante.`;
    expect(cleanTranscript(transcript)).toBe(
      "Eu demorei dois anos pra aceitar. Ferramenta ficou abundante.",
    );
  });

  test("normaliza acentos, pontuação e contrações para alinhamento", () => {
    expect(normalizeWord("Inteligência!")).toBe("inteligencia");
    expect(normalizeWord("pra")).toBe("para");
    expect(wordSimilarity(normalizeWord("pra"), normalizeWord("para"))).toBe(1);
  });
});

describe("jump cuts conservadores", () => {
  test("reduz pausas internas e preserva 280 ms", () => {
    const log = `
[silencedetect] silence_start: 2
[silencedetect] silence_end: 3.2 | silence_duration: 1.2
`;
    const silences = parseSilenceDetect(log, 5);
    const keep = buildKeepSegments(5, silences);
    expect(silences).toHaveLength(1);
    expect(keep).toEqual([
      { start: 0, end: 2.14 },
      { start: 3.06, end: 5 },
    ]);
    expect(editedDuration(keep)).toBeCloseTo(4.08, 5);
  });

  test("apara silêncio de borda e mantém respiro", () => {
    const silences = [
      { start: 0, end: 1, duration: 1 },
      { start: 4, end: 5, duration: 1 },
    ];
    expect(buildKeepSegments(5, silences)).toEqual([
      { start: 0.86, end: 4.14 },
    ]);
  });

  test("gera um grafo com crop 9:16, concat e loudness", () => {
    const graph = buildEditFilterGraph([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ]);
    expect(graph).toContain("concat=n=2:v=1:a=1");
    expect(graph).toContain("scale=1080:1920");
    expect(graph).toContain("crop=1080:1920");
    expect(graph).toContain("setsar=1");
    expect(graph).toContain("loudnorm=I=-16");
  });
});

describe("sincronização local", () => {
  const whisperJson = {
    transcription: [
      {
        offsets: { from: 0, to: 2000 },
        text: " A inteligência trabalha agora.",
        tokens: [
          { text: "[_BEG_]", offsets: { from: 0, to: 0 } },
          { text: " A", offsets: { from: 100, to: 200 } },
          { text: " intelig", offsets: { from: 200, to: 500 } },
          { text: "ência", offsets: { from: 500, to: 800 } },
          { text: " trabalha", offsets: { from: 900, to: 1300 } },
          { text: " agora", offsets: { from: 1400, to: 1800 } },
          { text: ".", offsets: { from: 1800, to: 1800 } },
        ],
      },
    ],
  };

  test("recompõe subwords e anexa pontuação", () => {
    expect(parseWhisperWords(whisperJson).map((word) => word.text)).toEqual([
      "A",
      "inteligência",
      "trabalha",
      "agora.",
    ]);
  });

  test("mantém o texto canônico do Wispr e interpola palavra ausente", () => {
    const sourceWords = parseWhisperWords(whisperJson);
    const aligned = alignTranscript(
      "A inteligência já trabalha agora.",
      sourceWords,
      2,
    );
    expect(aligned.words.map((word) => word.text).join(" ")).toBe(
      "A inteligência já trabalha agora.",
    );
    expect(aligned.matchedWords).toBe(4);
    expect(aligned.confidence).toBeCloseTo(0.8, 5);
    const inserted = aligned.words.find((word) => word.text === "já");
    expect(inserted?.start).toBeGreaterThanOrEqual(0.8);
    expect(inserted?.end).toBeLessThanOrEqual(0.9);
  });

  test("tolera uma palavra ausente em um roteiro maior acima de 85%", () => {
    const canonical =
      "A IA observa sinais escolhe tarefas usa ferramentas verifica resultado e continua";
    const source = tokenizeCanonical(
      "A IA observa sinais escolhe tarefas ferramentas verifica resultado e continua",
    ).map((word, index) => ({
      ...word,
      start: index * 0.25,
      end: index * 0.25 + 0.2,
    }));
    expect(alignTranscript(canonical, source, 3).confidence).toBeGreaterThan(
      0.85,
    );
  });
});

describe("legendas e marca", () => {
  test("agrupa em blocos curtos e no máximo duas linhas", () => {
    const words = tokenizeCanonical(
      "A IA observa sinais reais escolhe tarefas usa ferramentas e verifica o resultado",
    ).map((word, index) => ({
      ...word,
      start: index * 0.22,
      end: index * 0.22 + 0.18,
    }));
    const cues = groupCaptions(words, 3);
    expect(cues.length).toBeGreaterThan(1);
    for (const cue of cues) {
      expect(cue.text.split("\n").length).toBeLessThanOrEqual(2);
      expect(cue.end).toBeGreaterThan(cue.start);
    }
  });

  test("gera SRT monotônico e ASS com fonte e marcas corretas", () => {
    const cues = [
      { start: 0.1, end: 1.2, text: "A IA trabalha" },
      { start: 1.3, end: 2.4, text: "dentro da operação" },
    ];
    const srt = createSrt(cues);
    const ass = createAss(cues, 2.5);
    expect(srt).toContain("00:00:00,100 --> 00:00:01,200");
    expect(ass).toContain("Argent Pixel CF");
    expect(ass).toContain("vibegui.com");
    expect(ass).toContain("decocms.com");
    expect(ass).toContain("&H0038e5c4");
  });

  test("gera slugs estáveis em português", () => {
    expect(slugify("Ninguém quer sua ferramenta de IA")).toBe(
      "ninguem-quer-sua-ferramenta-de-ia",
    );
  });
});
