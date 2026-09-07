#!/usr/bin/env node
/**
 * Generate an image through Cloudflare AI Gateway (Google AI Studio provider).
 *
 * The gateway is the only thing that holds a Google key: BYOK is configured in
 * the dashboard, so this script authenticates to the *gateway* and the gateway
 * injects the provider key server-side. That is why there is no GOOGLE_API_KEY
 * here and why there must never be one.
 *
 *   CF_AI_GATEWAY_TOKEN=... node scripts/ai-gateway-image.mjs \
 *     --prompt-file prompt.txt --out public/images/articles/foo.png
 *
 * Env (defaults match the account these projects already use):
 *   CF_AI_GATEWAY_TOKEN   required — gateway-level auth, never printed
 *   AI_GATEWAY_ACCOUNT_ID default 55dd6d847f366735ef6e0f860c7bdc51
 *   AI_GATEWAY_NAME       default "default"
 */
import { readFileSync, writeFileSync } from "node:fs";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
};

const ACCOUNT =
  process.env.AI_GATEWAY_ACCOUNT_ID ?? "55dd6d847f366735ef6e0f860c7bdc51";
const GATEWAY = process.env.AI_GATEWAY_NAME ?? "default";
const TOKEN = process.env.CF_AI_GATEWAY_TOKEN;
const MODEL = arg("model", "gemini-2.5-flash-image");
const OUT = arg("out");
const ASPECT = arg("aspect", "3:2");

const promptFile = arg("prompt-file");
const prompt = promptFile ? readFileSync(promptFile, "utf8") : arg("prompt");

if (!TOKEN) throw new Error("CF_AI_GATEWAY_TOKEN is not set");
if (!prompt) throw new Error("pass --prompt or --prompt-file");
if (!OUT) throw new Error("pass --out <path>");

const url =
  `https://gateway.ai.cloudflare.com/v1/${ACCOUNT}/${GATEWAY}` +
  `/google-ai-studio/v1beta/models/${MODEL}:generateContent`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "cf-aig-authorization": `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: ASPECT },
    },
  }),
});

const text = await res.text();
if (!res.ok) {
  // The body carries the provider's own error, which is the useful part.
  throw new Error(`gateway ${res.status}: ${text.slice(0, 600)}`);
}

const body = JSON.parse(text);
const parts = body?.candidates?.[0]?.content?.parts ?? [];
const image = parts.find((p) => p.inlineData?.data);
if (!image) {
  const said = parts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .slice(0, 400);
  throw new Error(`no image in response. model said: ${said || "(nothing)"}`);
}

writeFileSync(OUT, Buffer.from(image.inlineData.data, "base64"));
const kb = Math.round(
  Buffer.from(image.inlineData.data, "base64").length / 1024,
);
console.log(`${OUT} (${kb} KB, ${image.inlineData.mimeType}, model ${MODEL})`);
