import { existsSync, statSync } from "node:fs";

import {
  DEFAULT_FONT_PATH,
  DEFAULT_MODEL_PATH,
  MODEL_DOWNLOAD_URL,
  MODEL_SHA256,
} from "./config.ts";
import { sha256File } from "./video-lib.ts";

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

function commandPath(command: string): string | null {
  const result = Bun.spawnSync(["which", command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) return null;
  const path = result.stdout.toString().trim();
  return path.length > 0 ? path : null;
}

export async function runPreflight(options?: {
  fontPath?: string;
  modelPath?: string;
}): Promise<PreflightCheck[]> {
  const fontPath = options?.fontPath ?? DEFAULT_FONT_PATH;
  const modelPath = options?.modelPath ?? DEFAULT_MODEL_PATH;
  const ffmpeg = commandPath("ffmpeg");
  const ffprobe = commandPath("ffprobe");
  const whisper = commandPath("whisper-cli");
  const checks: PreflightCheck[] = [
    {
      name: "macOS",
      ok: process.platform === "darwin",
      detail: process.platform,
      fix: "Execute este pipeline no Mac usado para gravar com o CleanShot.",
    },
    {
      name: "ffmpeg",
      ok: ffmpeg !== null,
      detail: ffmpeg ?? "não encontrado",
      fix: "brew install ffmpeg",
    },
    {
      name: "ffprobe",
      ok: ffprobe !== null,
      detail: ffprobe ?? "não encontrado",
      fix: "brew install ffmpeg",
    },
    {
      name: "whisper-cli",
      ok: whisper !== null,
      detail: whisper ?? "não encontrado",
      fix: "brew install whisper-cpp",
    },
    {
      name: "fonte Argent Pixel CF",
      ok: existsSync(fontPath),
      detail: fontPath,
      fix: "Instale ArgentPixelCF-Regular.otf em ~/Library/Fonts/.",
    },
  ];

  if (ffmpeg) {
    const filters = Bun.spawnSync([ffmpeg, "-hide_banner", "-filters"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = filters.stdout.toString();
    const missing = ["ass", "silencedetect", "loudnorm", "concat"].filter(
      (filter) => !new RegExp("\\b" + filter + "\\b", "u").test(output),
    );
    checks.push({
      name: "filtros FFmpeg",
      ok: filters.exitCode === 0 && missing.length === 0,
      detail:
        missing.length === 0
          ? "ass, silencedetect, loudnorm, concat"
          : "faltando: " + missing.join(", "),
      fix: "Instale uma distribuição do FFmpeg com libass habilitado.",
    });
  }

  let modelOk = false;
  let modelDetail = modelPath;
  if (existsSync(modelPath) && statSync(modelPath).size > 400_000_000) {
    if (modelPath === DEFAULT_MODEL_PATH) {
      const checksum = await sha256File(modelPath);
      modelOk = checksum === MODEL_SHA256;
      modelDetail += modelOk ? " (checksum válido)" : " (checksum inválido)";
    } else {
      modelOk = true;
      modelDetail += " (modelo customizado)";
    }
  }
  checks.push({
    name: "modelo Whisper small",
    ok: modelOk,
    detail: modelDetail,
    fix:
      "mkdir -p ~/Library/Caches/vibegui-video/models && curl -fL -o ~/Library/Caches/vibegui-video/models/ggml-small.bin " +
      MODEL_DOWNLOAD_URL,
  });

  return checks;
}

export function assertPreflight(checks: PreflightCheck[]): void {
  const failures = checks.filter((check) => !check.ok);
  if (failures.length === 0) return;
  const details = failures
    .map(
      (check) =>
        "- " + check.name + ": " + check.detail + "\n  Correção: " + check.fix,
    )
    .join("\n");
  throw new Error("Preflight do pipeline falhou:\n" + details);
}
