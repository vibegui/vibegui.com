import { runPreflight } from "./preflight.ts";

const asJson = process.argv.includes("--json");
const checks = await runPreflight();

if (asJson) {
  console.log(
    JSON.stringify({ ok: checks.every((check) => check.ok), checks }, null, 2),
  );
} else {
  console.log("Pipeline de vídeo VibeGUI\n");
  for (const check of checks) {
    console.log(
      (check.ok ? "✓" : "✗") + " " + check.name + " — " + check.detail,
    );
    if (!check.ok && check.fix) console.log("  " + check.fix);
  }
}

if (checks.some((check) => !check.ok)) process.exitCode = 1;
