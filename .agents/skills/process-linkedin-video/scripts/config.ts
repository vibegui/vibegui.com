import { homedir } from "node:os";
import { join } from "node:path";

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

export const BRAND_LIME = "#c4e538";
export const BRAND_FOREST = "#1a4d3e";
export const FONT_FAMILY = "Argent Pixel CF";

export const DEFAULT_ARCHIVE_DIR = join(homedir(), "Movies", "vibegui-videos");
export const DEFAULT_DESKTOP_DIR = join(homedir(), "Desktop");
export const DEFAULT_FONT_PATH = join(
  homedir(),
  "Library",
  "Fonts",
  "ArgentPixelCF-Regular.otf",
);
export const DEFAULT_MODEL_PATH = join(
  homedir(),
  "Library",
  "Caches",
  "vibegui-video",
  "models",
  "ggml-small.bin",
);

export const MODEL_SHA256 =
  "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b";
export const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";

export const SILENCE_THRESHOLD_DB = -38;
export const MIN_INTERNAL_SILENCE_SECONDS = 0.7;
export const INTERNAL_SILENCE_TO_KEEP_SECONDS = 0.28;
export const EDGE_SILENCE_TO_KEEP_SECONDS = 0.14;
export const MIN_ALIGNMENT_CONFIDENCE = 0.85;
