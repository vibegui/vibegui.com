import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

import {
  DEFAULT_ARCHIVE_DIR,
  DEFAULT_DESKTOP_DIR,
  DEFAULT_FONT_PATH,
  DEFAULT_MODEL_PATH,
  MIN_ALIGNMENT_CONFIDENCE,
  MIN_INTERNAL_SILENCE_SECONDS,
  SILENCE_THRESHOLD_DB,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./config.ts";
import { assertPreflight, runPreflight } from "./preflight.ts";
import {
  alignTranscript,
  buildEditFilterGraph,
  buildKeepSegments,
  cleanTranscript,
  createAss,
  createSrt,
  editedDuration,
  groupCaptions,
  parseSilenceDetect,
  parseWhisperWords,
  sha256File,
  slugify,
  type KeepSegment,
  type SilenceInterval,
} from "./video-lib.ts";

interface CliOptions {
  video: string;
  transcriptFile: string;
  slug?: string;
  archiveDir: string;
  modelPath: string;
  fontPath: string;
  keepWork: boolean;
  noCuts: boolean;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  sample_aspect_ratio?: string;
}

interface ProbeResult {
  streams?: ProbeStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
    size?: string;
  };
}

interface Manifest {
  version: 1;
  id: string;
  status: "processing" | "needs_transcript_review" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  failure?: string;
  source: {
    originalPath: string;
    archivedPath: string;
    sha256?: string;
    durationSeconds?: number;
  };
  transcript: {
    source: "wispr-manual";
    path: string;
    wordCount: number;
  };
  edit?: {
    silenceThresholdDb: number;
    minimumSilenceSeconds: number;
    originalDurationSeconds: number;
    editedDurationSeconds: number;
    removedSeconds: number;
    keepSegments: KeepSegment[];
  };
  alignment?: {
    model: string;
    confidence: number;
    matchedWords: number;
    canonicalWords: number;
  };
  output?: {
    path: string;
    captionsSrt: string;
    captionsAss: string;
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    bitrate: number;
    videoCodec: string;
    audioCodec: string;
  };
}

const HELP = `Processa uma gravação do CleanShot para o LinkedIn.

Uso:
  bun run video:process -- --video newest --transcript-file <arquivo> --slug <slug>
  bun run video:process -- --video <video.mp4> --transcript-file <arquivo>

Opções:
  --archive-dir <pasta>  Padrão: ~/Movies/vibegui-videos
  --model <arquivo>      Modelo GGML multilíngue small
  --font <arquivo>       ArgentPixelCF-Regular.otf
  --keep-work            Preserva intermediários mesmo após sucesso
  --no-cuts              Não remove silêncios; ainda normaliza e enquadra
`;

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = {
    video: "newest",
    transcriptFile: "",
    archiveDir: DEFAULT_ARCHIVE_DIR,
    modelPath: process.env.VIBEGUI_WHISPER_MODEL ?? DEFAULT_MODEL_PATH,
    fontPath: process.env.VIBEGUI_VIDEO_FONT ?? DEFAULT_FONT_PATH,
    keepWork: false,
    noCuts: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (arg === "--keep-work") {
      options.keepWork = true;
      continue;
    }
    if (arg === "--no-cuts") {
      options.noCuts = true;
      continue;
    }

    const value = args[index + 1];
    if (!value) throw new Error("Faltou o valor de " + arg + ".\n\n" + HELP);
    if (arg === "--video") options.video = value;
    else if (arg === "--transcript-file") options.transcriptFile = value;
    else if (arg === "--slug") options.slug = value;
    else if (arg === "--archive-dir") options.archiveDir = value;
    else if (arg === "--model") options.modelPath = value;
    else if (arg === "--font") options.fontPath = value;
    else throw new Error("Opção desconhecida: " + arg + ".\n\n" + HELP);
    index += 1;
  }

  if (!options.transcriptFile) {
    throw new Error(
      "Use --transcript-file com o texto refinado do Wispr.\n\n" + HELP,
    );
  }
  return options;
}

async function selectNewestCleanShot(): Promise<string> {
  const files = await readdir(DEFAULT_DESKTOP_DIR, { withFileTypes: true });
  const candidates = await Promise.all(
    files
      .filter((file) => file.isFile() && /^CleanShot.*\.mp4$/iu.test(file.name))
      .map(async (file) => {
        const path = join(DEFAULT_DESKTOP_DIR, file.name);
        const details = await stat(path);
        return { path, modifiedMs: details.mtimeMs, size: details.size };
      }),
  );
  candidates.sort((a, b) => b.modifiedMs - a.modifiedMs);

  if (candidates.length === 0) {
    throw new Error("Nenhum CleanShot*.mp4 foi encontrado no Desktop.");
  }

  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
  const recent = candidates.filter(
    (candidate) => candidate.modifiedMs >= thirtyMinutesAgo,
  );
  if (recent.length === 1 && recent[0]) return recent[0].path;

  const display = (recent.length > 1 ? recent : candidates.slice(0, 3))
    .map(
      (candidate) =>
        "- " +
        candidate.path +
        " — " +
        new Date(candidate.modifiedMs).toLocaleString("pt-BR") +
        " — " +
        (candidate.size / 1024 / 1024).toFixed(1) +
        " MB",
    )
    .join("\n");
  const reason =
    recent.length > 1
      ? "Há mais de um vídeo novo no Desktop."
      : "Nenhum vídeo foi criado nos últimos 30 minutos.";
  throw new Error(reason + " Use --video com o caminho exato:\n" + display);
}

async function probeVideo(path: string): Promise<ProbeResult> {
  const process = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      path,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error("ffprobe falhou para " + path + ":\n" + stderr.trim());
  }
  return JSON.parse(stdout) as ProbeResult;
}

function durationFromProbe(probe: ProbeResult): number {
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Não foi possível determinar a duração do vídeo.");
  }
  return duration;
}

function validateInputProbe(probe: ProbeResult): void {
  if (!probe.streams?.some((stream) => stream.codec_type === "video")) {
    throw new Error("O arquivo não contém uma faixa de vídeo.");
  }
  if (!probe.streams?.some((stream) => stream.codec_type === "audio")) {
    throw new Error(
      "O arquivo não contém áudio; não é possível gerar cortes ou legendas.",
    );
  }
}

async function runCommand(
  command: string[],
  options?: { capture?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  const child = Bun.spawn(command, {
    stdout: options?.capture ? "pipe" : "inherit",
    stderr: options?.capture ? "pipe" : "inherit",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    options?.capture ? new Response(child.stdout).text() : Promise.resolve(""),
    options?.capture ? new Response(child.stderr).text() : Promise.resolve(""),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      "Comando falhou (" +
        exitCode +
        "): " +
        command.join(" ") +
        (stderr ? "\n" + stderr.trim() : ""),
    );
  }
  return { stdout, stderr };
}

async function detectSilence(
  videoPath: string,
  duration: number,
): Promise<SilenceInterval[]> {
  const result = await runCommand(
    [
      "ffmpeg",
      "-hide_banner",
      "-nostats",
      "-i",
      videoPath,
      "-af",
      "silencedetect=noise=" +
        SILENCE_THRESHOLD_DB +
        "dB:d=" +
        MIN_INTERNAL_SILENCE_SECONDS,
      "-f",
      "null",
      "-",
    ],
    { capture: true },
  );
  return parseSilenceDetect(result.stderr, duration);
}

async function renderEdited(
  sourcePath: string,
  outputPath: string,
  segments: KeepSegment[],
): Promise<void> {
  const filterGraph = buildEditFilterGraph(segments);
  const common = [
    "ffmpeg",
    "-hide_banner",
    "-y",
    "-i",
    sourcePath,
    "-filter_complex",
    filterGraph,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    "-tag:v",
    "avc1",
  ];

  try {
    await runCommand([
      ...common,
      "-c:v",
      "h264_videotoolbox",
      "-b:v",
      "10M",
      "-maxrate",
      "12M",
      "-bufsize",
      "20M",
      outputPath,
    ]);
  } catch (hardwareError) {
    console.warn("VideoToolbox falhou; tentando libx264.");
    await rm(outputPath, { force: true });
    try {
      await runCommand([
        ...common,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        outputPath,
      ]);
    } catch (softwareError) {
      throw new Error(
        "Os dois encoders falharam. VideoToolbox: " +
          String(hardwareError) +
          "\nlibx264: " +
          String(softwareError),
      );
    }
  }
}

function escapeFilterPath(path: string): string {
  return path
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'");
}

async function burnCaptions(
  editedPath: string,
  assPath: string,
  fontPath: string,
  outputPath: string,
): Promise<void> {
  const filter =
    "ass=filename='" +
    escapeFilterPath(assPath) +
    "':fontsdir='" +
    escapeFilterPath(dirname(fontPath)) +
    "'";
  const common = [
    "ffmpeg",
    "-hide_banner",
    "-y",
    "-i",
    editedPath,
    "-vf",
    filter,
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    "-tag:v",
    "avc1",
  ];
  try {
    await runCommand([
      ...common,
      "-c:v",
      "h264_videotoolbox",
      "-b:v",
      "10M",
      "-maxrate",
      "12M",
      "-bufsize",
      "20M",
      outputPath,
    ]);
  } catch (hardwareError) {
    console.warn("VideoToolbox falhou no burn-in; tentando libx264.");
    await rm(outputPath, { force: true });
    try {
      await runCommand([
        ...common,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        outputPath,
      ]);
    } catch (softwareError) {
      throw new Error(
        "Os dois encoders falharam no burn-in. VideoToolbox: " +
          String(hardwareError) +
          "\nlibx264: " +
          String(softwareError),
      );
    }
  }
}

async function createUniqueArchive(base: string, id: string): Promise<string> {
  await mkdir(base, { recursive: true });
  for (let take = 1; take < 100; take += 1) {
    const suffix = take === 1 ? "" : "-take-" + String(take).padStart(2, "0");
    const candidate = join(base, id + suffix);
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(
    "Não foi possível criar uma pasta de take única para " + id + ".",
  );
}

function localDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return value.year + "-" + value.month + "-" + value.day;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function validateFinal(
  path: string,
  expectedDuration: number,
): Promise<{
  duration: number;
  bitrate: number;
  videoCodec: string;
  audioCodec: string;
}> {
  const probe = await probeVideo(path);
  const duration = durationFromProbe(probe);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const videoCodec = video?.codec_name ?? "";
  const audioCodec = audio?.codec_name ?? "";
  const bitrate = Number(probe.format?.bit_rate ?? 0);
  const failures: string[] = [];
  if (videoCodec !== "h264") failures.push("codec de vídeo não é H.264");
  if (audioCodec !== "aac") failures.push("codec de áudio não é AAC");
  if (video?.width !== VIDEO_WIDTH || video.height !== VIDEO_HEIGHT) {
    failures.push("resolução não é 1080x1920");
  }
  if (video?.pix_fmt !== "yuv420p") failures.push("pixel format não é yuv420p");
  if (video?.r_frame_rate !== "30/1") failures.push("frame rate não é 30 fps");
  if (video?.sample_aspect_ratio !== "1:1")
    failures.push("pixel aspect ratio não é 1:1");
  if (bitrate <= 0 || bitrate >= 30_000_000)
    failures.push("bitrate fora do limite");
  if (Math.abs(duration - expectedDuration) > 0.35)
    failures.push("duração final divergiu do edit");
  if (failures.length > 0) {
    throw new Error(
      "Validação do MP4 final falhou: " + failures.join("; ") + ".",
    );
  }
  return {
    duration,
    bitrate,
    videoCodec,
    audioCodec,
  };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  assertPreflight(
    await runPreflight({
      fontPath: options.fontPath,
      modelPath: options.modelPath,
    }),
  );

  const selected =
    options.video === "newest" ? await selectNewestCleanShot() : options.video;
  const sourcePath = resolve(selected);
  if (extname(sourcePath).toLocaleLowerCase() !== ".mp4") {
    throw new Error(
      "A primeira versão aceita somente MP4 para preservar source.mp4 corretamente.",
    );
  }
  const transcriptInput = await readFile(
    resolve(options.transcriptFile),
    "utf8",
  );
  const transcript = cleanTranscript(transcriptInput);
  const wordCount = transcript.split(/\s+/u).filter(Boolean).length;
  if (wordCount < 3)
    throw new Error("O transcript do Wispr está vazio ou curto demais.");

  const inputProbe = await probeVideo(sourcePath);
  validateInputProbe(inputProbe);
  const originalDuration = durationFromProbe(inputProbe);
  const fallbackSlug = basename(sourcePath, extname(sourcePath));
  const cleanSlug = slugify(options.slug ?? fallbackSlug) || "video-linkedin";
  const id = localDate() + "-" + cleanSlug;
  const archivePath = await createUniqueArchive(
    resolve(options.archiveDir),
    id,
  );
  const archivedSource = join(archivePath, "source.mp4");
  const transcriptPath = join(archivePath, "transcript-wispr.md");
  const manifestPath = join(archivePath, "manifest.json");
  const editMapPath = join(archivePath, "edit-map.json");
  const srtPath = join(archivePath, "captions.srt");
  const assPath = join(archivePath, "captions.ass");
  const finalPath = join(archivePath, "final-linkedin.mp4");
  const workPath = join(archivePath, ".work");
  const editedPath = join(workPath, "edited.mp4");
  const audioPath = join(workPath, "timing.wav");
  const whisperPrefix = join(workPath, "whisper");

  await mkdir(workPath, { recursive: true });
  await copyFile(sourcePath, archivedSource);
  await writeFile(transcriptPath, transcript + "\n", "utf8");

  const manifest: Manifest = {
    version: 1,
    id,
    status: "processing",
    createdAt: new Date().toISOString(),
    source: {
      originalPath: sourcePath,
      archivedPath: archivedSource,
      durationSeconds: originalDuration,
    },
    transcript: {
      source: "wispr-manual",
      path: transcriptPath,
      wordCount,
    },
  };
  await writeJson(manifestPath, manifest);

  try {
    console.log("1/6 Detectando pausas…");
    const silences = options.noCuts
      ? []
      : await detectSilence(archivedSource, originalDuration);
    const keepSegments = buildKeepSegments(originalDuration, silences);
    const expectedEditedDuration = editedDuration(keepSegments);
    if (expectedEditedDuration < 1) {
      throw new Error("Os cortes deixariam menos de um segundo de vídeo.");
    }
    await writeJson(editMapPath, {
      version: 1,
      silenceThresholdDb: SILENCE_THRESHOLD_DB,
      minimumSilenceSeconds: MIN_INTERNAL_SILENCE_SECONDS,
      internalPauseKeptSeconds: 0.28,
      edgePauseKeptSeconds: 0.14,
      originalDurationSeconds: originalDuration,
      editedDurationSeconds: expectedEditedDuration,
      removedSeconds: Math.max(0, originalDuration - expectedEditedDuration),
      detectedSilences: silences,
      keepSegments,
    });
    manifest.edit = {
      silenceThresholdDb: SILENCE_THRESHOLD_DB,
      minimumSilenceSeconds: MIN_INTERNAL_SILENCE_SECONDS,
      originalDurationSeconds: originalDuration,
      editedDurationSeconds: expectedEditedDuration,
      removedSeconds: Math.max(0, originalDuration - expectedEditedDuration),
      keepSegments,
    };
    await writeJson(manifestPath, manifest);

    console.log(
      "2/6 Aplicando jump cuts, enquadramento e normalização de áudio…",
    );
    await renderEdited(archivedSource, editedPath, keepSegments);
    const editedProbe = await probeVideo(editedPath);
    const actualEditedDuration = durationFromProbe(editedProbe);

    console.log("3/6 Extraindo áudio para sincronização local…");
    await runCommand([
      "ffmpeg",
      "-hide_banner",
      "-y",
      "-i",
      editedPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      audioPath,
    ]);

    console.log("4/6 Calculando timestamps com Whisper local…");
    await runCommand([
      "whisper-cli",
      "-m",
      options.modelPath,
      "-f",
      audioPath,
      "-l",
      "pt",
      "-ojf",
      "-of",
      whisperPrefix,
      "-np",
    ]);
    const whisperJson = JSON.parse(
      await readFile(whisperPrefix + ".json", "utf8"),
    ) as unknown;
    const whisperWords = parseWhisperWords(whisperJson);
    const alignment = alignTranscript(
      transcript,
      whisperWords,
      actualEditedDuration,
    );
    manifest.alignment = {
      model: options.modelPath,
      confidence: alignment.confidence,
      matchedWords: alignment.matchedWords,
      canonicalWords: alignment.totalCanonicalWords,
    };
    await writeJson(join(archivePath, "alignment-report.json"), {
      ...manifest.alignment,
      minimumConfidence: MIN_ALIGNMENT_CONFIDENCE,
      whisperWordCount: whisperWords.length,
    });
    if (alignment.confidence < MIN_ALIGNMENT_CONFIDENCE) {
      manifest.status = "needs_transcript_review";
      manifest.failure =
        "Confiança de alinhamento " +
        (alignment.confidence * 100).toFixed(1) +
        "% abaixo do mínimo de " +
        (MIN_ALIGNMENT_CONFIDENCE * 100).toFixed(0) +
        "%.";
      await writeJson(manifestPath, manifest);
      throw new Error(
        manifest.failure + " Revise transcript-wispr.md e processe novamente.",
      );
    }

    console.log("5/6 Gerando legendas e identidade visual…");
    const cues = groupCaptions(alignment.words, actualEditedDuration);
    if (cues.length === 0) throw new Error("Nenhuma legenda foi gerada.");
    await writeFile(srtPath, createSrt(cues), "utf8");
    await writeFile(assPath, createAss(cues, actualEditedDuration), "utf8");
    await burnCaptions(editedPath, assPath, options.fontPath, finalPath);

    console.log("6/6 Validando MP4 final…");
    const final = await validateFinal(finalPath, actualEditedDuration);
    manifest.source.sha256 = await sha256File(archivedSource);
    manifest.status = "completed";
    manifest.completedAt = new Date().toISOString();
    manifest.output = {
      path: finalPath,
      captionsSrt: srtPath,
      captionsAss: assPath,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      fps: VIDEO_FPS,
      durationSeconds: final.duration,
      bitrate: final.bitrate,
      videoCodec: final.videoCodec,
      audioCodec: final.audioCodec,
    };
    await writeJson(manifestPath, manifest);
    if (!options.keepWork) await rm(workPath, { recursive: true, force: true });

    console.log("\n✓ Vídeo pronto: " + finalPath);
    console.log("  Legendas: " + srtPath);
    console.log("  Arquivo mestre: " + archivePath);
  } catch (error) {
    if (manifest.status === "processing") {
      manifest.status = "failed";
      manifest.failure = error instanceof Error ? error.message : String(error);
      await writeJson(manifestPath, manifest);
    }
    console.error("\nArtefatos preservados em: " + archivePath);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
