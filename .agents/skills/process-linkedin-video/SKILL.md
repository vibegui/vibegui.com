---
name: process-linkedin-video
description: Process short LinkedIn recordings made with CleanShot into branded 9:16 MP4s using a manually pasted Wispr transcript. Use when the user asks to process, render, caption, synchronize, or brand their latest VibeGUI/Deco video.
---

# Process LinkedIn Video

Turn a local CleanShot recording into a reviewable LinkedIn video. The deterministic scripts own media processing; the agent owns input selection, naming, and reporting.

## Required input

- A Wispr transcript pasted by the user. Wispr wording is canonical; never silently replace it with local transcription.
- A source MP4. If no path is given, use the newest `CleanShot*.mp4` on the Desktop.
- A short semantic slug. Prefer the matching file under `content/videos/`; otherwise infer it from the video's thesis.

If the transcript is missing, ask for it. Do not configure Wispr MCP or scrape Wispr application data.

## Workflow

1. Save the pasted transcript to a temporary gitignored file under `.context/`. Preserve wording; only remove transcript headings and speaker labels.
2. Run `bun run video:check`. Stop and surface the exact remediation for any failed dependency.
3. Run:

   ```sh
   bun run video:process -- --video newest --transcript-file <temporary-file> --slug <slug>
   ```

   Use an explicit `--video <path>` when the user provides one or when the script reports multiple candidates.
4. Read `manifest.json` in the generated archive and report the final MP4, SRT, duration, removed silence, and alignment confidence.
5. If a matching editorial file exists and the render completed, change its status from `scripted` or `recorded` to `rendered` and record the archive path. Do not mark it `published` without a LinkedIn URL supplied by the user.

## Boundaries

- Never delete or move the original Desktop recording. The processor copies it into `~/Movies/vibegui-videos/`.
- Never overwrite a previous take; the processor creates `take-02`, `take-03`, and so on.
- Never upload or publish to LinkedIn.
- When alignment confidence is below 85%, preserve diagnostics and ask the user to review the transcript. Do not force a final render.
- Keep the font and Whisper model outside Git. Do not commit raw or rendered video files.
