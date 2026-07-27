import { describe, expect, test } from "bun:test";
import {
  escapeXml,
  formatOgDate,
  layoutTitle,
  localeMarker,
  renderOgSvg,
  wrapTitle,
} from "./og-template";

describe("OG template", () => {
  test("escapes every XML-sensitive character", () => {
    expect(escapeXml(`AI & "software" < futuro > 'agora'`)).toBe(
      "AI &amp; &quot;software&quot; &lt; futuro &gt; &apos;agora&apos;",
    );
  });

  test("formats dates and markers by locale", () => {
    expect(formatOgDate("2026-07-26", "pt-BR")).toBe("26 JUL 2026");
    expect(formatOgDate("2026-07-26", "en")).toBe("JUL 26, 2026");
    expect(localeMarker("pt-BR")).toBe("PT");
    expect(localeMarker("en")).toBe("EN");
    expect(() => formatOgDate("2026-02-30", "en")).toThrow(
      "Invalid article date",
    );
  });

  test("wraps Unicode titles to three lines with an ellipsis", () => {
    const title =
      "A geração anime e a construção de futuros extraordinários 🚀 sem perder a esperança coletiva";
    const wrapped = wrapTitle(title, 18, 3);

    expect(wrapped.lines).toHaveLength(3);
    expect(wrapped.truncated).toBe(true);
    expect(wrapped.lines[2]?.endsWith("…")).toBe(true);
    expect(wrapped.lines.join("")).not.toContain("\uFFFD");
  });

  test("reduces title size before truncating long titles", () => {
    const short = layoutTitle("Software gardening");
    const long = layoutTitle(
      "A evolução da plataforma e como agentes de inteligência artificial podem eliminar erros em produção",
    );

    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(long.lines.length).toBeLessThanOrEqual(3);
  });

  test("escapes dynamic SVG values", () => {
    const svg = renderOgSvg({
      title: "AI & o futuro <agora>",
      locale: "pt-BR",
      date: "2026-07-26",
      tag: "Liderança & IA",
    });

    expect(svg).toContain("AI &amp; o futuro &lt;agora&gt;");
    expect(svg).toContain("LIDERANÇA &amp; IA");
    expect(svg).not.toContain("AI & o futuro <agora>");
  });
});
