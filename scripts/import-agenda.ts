/**
 * One-shot import of the "Agenda Imprescindível 2026" .docx into
 * content/imprescindivel/NN-slug.md — the source for the /imprescindivel
 * mini-site (see scripts/generate-imprescindivel.ts).
 *
 *   bun scripts/import-agenda.ts <caminho-do-.docx>
 *
 * The document carries NO paragraph styles: every semantic distinction is
 * encoded in run properties (<w:sz> in half-points, <w:b w:val="1">, <w:i>)
 * and in real <w:tbl> elements for the boxes. This script decodes that,
 * asserts hard against a known census of the document, and emits markdown
 * that stays hand-editable afterwards.
 *
 * Three things that bite (verified against the XML, do not "simplify"):
 *   1. The <w:t> regex needs `(?: [^>]*)?` — plain `[^>]*` also matches
 *      <w:top .../> inside <w:pBdr> and leaks raw XML into the text.
 *   2. Bold must test w:val="1"; the file emits <w:b w:val="0"/> explicitly.
 *   3. "Rótulo  texto" pairs split on a RUN boundary, not on the double
 *      space. The double space is only a fallback.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalize, slugify } from "../lib/slugify.ts";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT_ROOT, "content/imprescindivel");

// ---------------------------------------------------------------- census
// Everything the importer refuses to disagree with. A mis-parse must throw,
// never ship: this document is imported once and then edited by hand, so a
// silent hole would be invisible forever after.
const ESPERADO = {
  paragrafos: 665,
  filhosTopo: 399,
  tabelas: 16,
  secoes: 18,
  capitulos: 12,
  reguas: 12,
  objetivosPorRegua: [3, 3, 5, 5, 5, 6, 5, 5, 5, 5, 5, 5],
  ideias: 12,
  eixos: ["FUTURO", "PROSPERIDADE", "REALIZAÇÃO", "PESSOAS", "SOBERANIA"],
  integrantes: 150,
  quadros: 1,
  historias: 2,
  numerais: [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ],
};

/** Sumário vs corpo: divergências conhecidas e aceitas (preferimos o corpo). */
const DIVERGENCIAS_ACEITAS = new Set(["VI", "XII"]);

// ------------------------------------------------------------------ docx

function readDocumentXml(docx: string): string {
  const r = spawnSync("unzip", ["-p", docx, "word/document.xml"], {
    maxBuffer: 32 << 20,
  });
  if (r.status !== 0) {
    throw new Error(`unzip falhou (${r.status}): ${r.stderr?.toString()}`);
  }
  // Buffer → utf-8 explícito: passar `encoding` deixaria o locale corromper acento.
  return r.stdout.toString("utf-8");
}

/** &amp; por último, senão "&amp;lt;" vira "<". */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  sz: number;
}
interface Para {
  sz: number;
  bold: boolean;
  italic: boolean;
  runs: Run[];
  text: string;
}
type Node =
  | { kind: "p"; p: Para }
  | { kind: "tbl"; paras: Para[]; grade: string[][] };

const RE_TEXTO = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g;
const RE_RUN = /<w:r[ >][\s\S]*?<\/w:r>/g;

function textoDe(xml: string): string {
  RE_TEXTO.lastIndex = 0;
  let out = "";
  for (const m of xml.matchAll(RE_TEXTO)) out += m[1];
  return unescapeXml(out);
}

function parsePara(xml: string): Para {
  const runs: Run[] = [];
  for (const m of xml.matchAll(RE_RUN)) {
    const rx = m[0];
    const text = textoDe(rx);
    if (!text) continue; // runs vazios existem no fim de quase todo parágrafo
    const sz = rx.match(/<w:sz w:val="(\d+)"/);
    runs.push({
      text,
      bold: /<w:b w:val="1"\/>/.test(rx),
      italic: /<w:i w:val="1"\/>/.test(rx),
      sz: sz ? Number(sz[1]) : 0,
    });
  }
  // Dois parágrafos de corpo abrem com um run sem <w:sz> (herdado); o
  // primeiro run dimensionado é quem define o papel do parágrafo.
  const primeiro = runs.find((r) => r.sz > 0) ?? runs[0];
  return {
    sz: primeiro?.sz ?? 0,
    bold: primeiro?.bold ?? false,
    italic: primeiro?.italic ?? false,
    runs,
    text: runs
      .map((r) => r.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Top-level scan. The alternation with a backreference lets a <w:tbl> match
 * consume the whole table, so its inner <w:p> are never seen as top level.
 */
function parseBody(xml: string): Node[] {
  const body = xml.slice(xml.indexOf("<w:body>"), xml.indexOf("</w:body>"));
  const nodes: Node[] = [];
  for (const m of body.matchAll(/<w:(p|tbl)[ >][\s\S]*?<\/w:\1>/g)) {
    if (m[1] === "p") {
      nodes.push({ kind: "p", p: parsePara(m[0]) });
      continue;
    }
    const grade: string[][] = [];
    const paras: Para[] = [];
    for (const tr of m[0].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) {
      const linha: string[] = [];
      for (const tc of tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) {
        const celula: string[] = [];
        for (const p of tc[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
          const par = parsePara(p[0]);
          if (!par.text) continue;
          paras.push(par);
          celula.push(par.text);
        }
        linha.push(celula.join("\n"));
      }
      grade.push(linha);
    }
    nodes.push({ kind: "tbl", paras, grade });
  }
  return nodes;
}

/**
 * "Objetivo 1 · Produtividade  Elevar…" → { rotulo, texto }.
 * O rótulo é o prefixo de runs que compartilham (sz, bold) com o primeiro.
 */
function splitRuns(p: Para): { rotulo: string; texto: string } {
  const r0 = p.runs[0];
  if (r0) {
    let i = 1;
    while (
      i < p.runs.length &&
      p.runs[i].sz === r0.sz &&
      p.runs[i].bold === r0.bold
    )
      i++;
    if (i < p.runs.length) {
      const rotulo = p.runs
        .slice(0, i)
        .map((r) => r.text)
        .join("")
        .trim();
      const texto = p.runs
        .slice(i)
        .map((r) => r.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (rotulo && texto) return { rotulo, texto };
    }
  }
  const dupl = p.text.match(/^(.+?)\s{2,}(.+)$/); // fallback: espaço duplo
  if (dupl) return { rotulo: dupl[1].trim(), texto: dupl[2].trim() };
  throw new Error(
    `não consegui separar rótulo/texto em: ${p.text.slice(0, 80)}`,
  );
}

// --------------------------------------------------------------- modelo

type Bloco =
  | { t: "lead" | "para" | "destaque"; texto: string }
  | { t: "eixo" | "ideia"; rotulo: string; texto: string }
  | { t: "caixa"; kicker: string; titulo?: string; paras: string[] }
  | {
      t: "regua";
      label: string;
      objetivo: string;
      objetivos: { rotulo: string; texto: string }[];
      quemVerifica: string;
    }
  | { t: "nomes"; nomes: string[] };

interface Secao {
  ordem: number;
  slug: string;
  kicker: string;
  titulo: string;
  subtitulo: string;
  numeral: string | null;
  blocos: Bloco[];
}

function tabelaParaBloco(node: Extract<Node, { kind: "tbl" }>): Bloco {
  const paras = node.paras;
  const primeiro = paras[0]?.text ?? "";

  if (/^RÉGUA DA PROSPERIDADE$/i.test(primeiro)) {
    const label = paras.find((p) => p.sz === 17)?.text ?? "";
    const objetivo = paras.find((p) => p.sz === 22)?.text ?? "";
    const objetivos = paras
      .filter((p) => p.sz === 21)
      .map((p) => {
        const { rotulo, texto } = splitRuns(p);
        // "Objetivo 3 · Economia do conhecimento" → só o rótulo interessa,
        // a numeração vem da lista ordenada no markdown.
        return {
          rotulo: rotulo.replace(/^Objetivo\s+\d+\s*·\s*/i, "").trim(),
          texto,
        };
      });
    const qv = paras.find((p) => p.sz === 20);
    return {
      t: "regua",
      label,
      objetivo,
      objetivos,
      quemVerifica: qv ? splitRuns(qv).texto : "",
    };
  }

  if (paras.some((p) => p.sz === 15)) {
    const kicker = paras.find((p) => p.sz === 15)!.text;
    const titulo = paras.find((p) => p.sz === 26)?.text;
    return {
      t: "caixa",
      kicker,
      titulo,
      paras: paras.filter((p) => p.sz === 21).map((p) => p.text),
    };
  }

  // integrantes: 50×3, ordem de leitura é column-major
  const colunas = Math.max(...node.grade.map((l) => l.length));
  const nomes: string[] = [];
  for (let c = 0; c < colunas; c++) {
    for (const linha of node.grade) if (linha[c]) nomes.push(linha[c].trim());
  }
  return { t: "nomes", nomes };
}

function ehFronteira(n: Node): "capitulo" | "frente" | null {
  if (n.kind !== "p" || !n.p.text) return null;
  if (n.p.sz === 18 && n.p.bold && /^CAPÍTULO\s+[IVX]+$/.test(n.p.text))
    return "capitulo";
  if (n.p.sz === 17 && !n.p.bold) return "frente";
  return null;
}

function construirSecao(
  nodes: Node[],
  tipo: "capitulo" | "frente",
  ordem: number,
): Secao {
  const cabecalho = (nodes[0] as Extract<Node, { kind: "p" }>).p;
  const kicker = cabecalho.text;
  const szTitulo = tipo === "capitulo" ? 52 : 44;

  let i = 1;
  while (
    i < nodes.length &&
    !(nodes[i].kind === "p" && (nodes[i] as any).p.sz === szTitulo)
  )
    i++;
  if (i >= nodes.length)
    throw new Error(`seção sem título (sz ${szTitulo}): ${kicker}`);
  const titulo = (nodes[i] as Extract<Node, { kind: "p" }>).p.text;
  i++;

  // subtítulo: 26-itálico nos capítulos, 24-itálico na Conclusão
  let subtitulo = "";
  while (i < nodes.length && nodes[i].kind === "p" && !(nodes[i] as any).p.text)
    i++;
  const cand = nodes[i];
  if (
    cand?.kind === "p" &&
    (cand.p.sz === 26 || (cand.p.sz === 24 && cand.p.italic))
  ) {
    subtitulo = cand.p.text;
    i++;
  }

  const blocos: Bloco[] = [];
  let temLead = false;
  for (; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind === "tbl") {
      blocos.push(tabelaParaBloco(n));
      continue;
    }
    const p = n.p;
    if (!p.text) continue;
    if (p.sz === 24 && p.bold) blocos.push({ t: "destaque", texto: p.text });
    else if (p.sz === 24 && !temLead) {
      blocos.push({ t: "lead", texto: p.text });
      temLead = true;
    } else if (p.sz === 23 || p.sz === 24)
      blocos.push({ t: "para", texto: p.text });
    else if (p.sz === 19 && p.bold) blocos.push({ t: "eixo", ...splitRuns(p) });
    else if (p.sz === 18 && !p.bold)
      blocos.push({ t: "ideia", ...splitRuns(p) });
    else
      throw new Error(
        `parágrafo não classificado (sz ${p.sz}, bold ${p.bold}): ${p.text.slice(0, 70)}`,
      );
  }

  return {
    ordem,
    slug: slugify(titulo),
    kicker,
    titulo,
    subtitulo,
    numeral: tipo === "capitulo" ? kicker.replace(/^CAPÍTULO\s+/, "") : null,
    blocos,
  };
}

// -------------------------------------------------------------- markdown

function toMarkdown(s: Secao): string {
  const linhas: string[] = [
    "---",
    `slug: ${s.slug}`,
    `title: "${s.titulo.replace(/"/g, "'")}"`,
    `kicker: "${s.kicker}"`,
  ];
  if (s.subtitulo) linhas.push(`subtitle: "${s.subtitulo.replace(/"/g, "'")}"`);
  if (s.numeral) linhas.push(`numeral: ${s.numeral}`);
  linhas.push("---", "");

  let listaAberta: "eixo" | "ideia" | null = null;
  const fechaLista = () => {
    if (listaAberta) linhas.push("");
    listaAberta = null;
  };

  for (const b of s.blocos) {
    if (b.t !== "eixo" && b.t !== "ideia") fechaLista();
    switch (b.t) {
      case "lead":
        linhas.push(`*${b.texto}*`, "");
        break;
      case "para":
        linhas.push(b.texto, "");
        break;
      case "destaque":
        linhas.push(`> ${b.texto}`, "");
        break;
      case "eixo":
        if (listaAberta !== "eixo") listaAberta = "eixo";
        linhas.push(`- **${b.rotulo}** — ${b.texto}`);
        break;
      case "ideia":
        if (listaAberta !== "ideia") listaAberta = "ideia";
        linhas.push(`1. ${b.texto}`);
        break;
      case "caixa":
        linhas.push(`## ${b.kicker}`, "");
        if (b.titulo) linhas.push(`### ${b.titulo}`, "");
        for (const p of b.paras) linhas.push(p, "");
        break;
      case "regua":
        linhas.push("## RÉGUA DA PROSPERIDADE", "");
        linhas.push(`**Objetivo nacional** — ${b.objetivo}`, "");
        for (const o of b.objetivos)
          linhas.push(`1. **${o.rotulo}** — ${o.texto}`);
        linhas.push("", `**Quem verifica** — ${b.quemVerifica}`, "");
        break;
      case "nomes":
        for (const n of b.nomes) linhas.push(`- ${n}`);
        linhas.push("");
        break;
    }
  }
  fechaLista();
  return (
    linhas
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

// ------------------------------------------------------------- asserções

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertAll(
  secoes: Secao[],
  toc: Map<string, string>,
  xml: string,
): void {
  const nParas = [...xml.matchAll(/<w:p[ >]/g)].length;
  check(
    nParas === ESPERADO.paragrafos,
    `<w:p> = ${nParas}, esperado ${ESPERADO.paragrafos}`,
  );
  check(
    secoes.length === ESPERADO.secoes,
    `seções = ${secoes.length}, esperado ${ESPERADO.secoes}`,
  );

  const caps = secoes.filter((s) => s.numeral);
  check(caps.length === ESPERADO.capitulos, `capítulos = ${caps.length}`);
  check(
    caps.map((c) => c.numeral).join(",") === ESPERADO.numerais.join(","),
    `numerais fora de ordem: ${caps.map((c) => c.numeral).join(",")}`,
  );

  const reguas = secoes.flatMap((s) => s.blocos.filter((b) => b.t === "regua"));
  check(reguas.length === ESPERADO.reguas, `réguas = ${reguas.length}`);
  for (const c of caps) {
    const rs = c.blocos.filter((b) => b.t === "regua");
    check(rs.length === 1, `capítulo ${c.numeral} tem ${rs.length} réguas`);
    const r = rs[0] as Extract<Bloco, { t: "regua" }>;
    const a = normalize(r.label);
    const b = normalize(c.titulo);
    // prefixo em qualquer direção: "SEGURANÇA PÚBLICA" vs "Segurança"
    check(
      a.startsWith(b) || b.startsWith(a),
      `régua "${r.label}" não casa com "${c.titulo}"`,
    );
    check(!!r.objetivo, `capítulo ${c.numeral} sem objetivo nacional`);
    check(!!r.quemVerifica, `capítulo ${c.numeral} sem "Quem verifica"`);
    for (const o of r.objetivos)
      check(!!o.rotulo && !!o.texto, `objetivo incompleto em ${c.numeral}`);
  }
  const contagem = caps.map(
    (c) => (c.blocos.find((b) => b.t === "regua") as any).objetivos.length,
  );
  check(
    contagem.join(",") === ESPERADO.objetivosPorRegua.join(","),
    `objetivos por régua = [${contagem}], esperado [${ESPERADO.objetivosPorRegua}]`,
  );

  const ideias = secoes.flatMap((s) => s.blocos.filter((b) => b.t === "ideia"));
  check(ideias.length === ESPERADO.ideias, `ideias = ${ideias.length}`);
  check(
    ideias.map((i: any) => i.rotulo).join(",") ===
      ESPERADO.numerais.map((_, n) => String(n + 1).padStart(2, "0")).join(","),
    `numeração das ideias quebrada: ${ideias.map((i: any) => i.rotulo)}`,
  );

  const eixos = secoes.flatMap((s) => s.blocos.filter((b) => b.t === "eixo"));
  check(
    eixos.map((e: any) => e.rotulo).join(",") === ESPERADO.eixos.join(","),
    `eixos = ${eixos.map((e: any) => e.rotulo)}`,
  );

  const nomes = (
    secoes.flatMap((s) => s.blocos.filter((b) => b.t === "nomes")) as any[]
  ).flatMap((b) => b.nomes);
  check(nomes.length === ESPERADO.integrantes, `integrantes = ${nomes.length}`);
  // A grade é 50×3 lida por coluna. Se a leitura fosse por linha o resultado
  // vinha embaralhado (49 inversões medidas); por coluna sobram só 2, ambas
  // erros de ordenação do próprio documento ("Fernando Gabeira" antes de
  // "Fernando Brigidi"). Tolerar um punhado, não a bagunça.
  const collator = new Intl.Collator("pt-BR");
  const inversoes = nomes.filter(
    (n, i) => i > 0 && collator.compare(nomes[i - 1], n) > 0,
  );
  check(
    inversoes.length <= 3,
    `${inversoes.length} integrantes fora de ordem (${inversoes.slice(0, 3)}) — leitura column-major errada?`,
  );

  const caixas = secoes.flatMap((s) =>
    s.blocos.filter((b) => b.t === "caixa"),
  ) as any[];
  check(
    caixas.filter((c) => /QUADRO/.test(c.kicker)).length === ESPERADO.quadros,
    "quadros != 1",
  );
  check(
    caixas.filter((c) => /HISTÓRIA/.test(c.kicker)).length ===
      ESPERADO.historias,
    "histórias != 2",
  );
  for (const c of caixas)
    check(c.paras.length > 0, `caixa "${c.kicker}" sem corpo`);

  const slugs = new Set(secoes.map((s) => s.slug));
  check(slugs.size === secoes.length, "slugs duplicados");
  for (const s of secoes) {
    check(s.slug.length < 60, `slug truncado (colisão silenciosa): ${s.slug}`);
    check(s.blocos.length > 0, `seção "${s.titulo}" sem corpo`);
    check(!!s.titulo, "seção sem título");
  }

  // Sumário × corpo. Divergência nova = erro; as duas conhecidas só avisam.
  for (const c of caps) {
    const esperado = toc.get(c.numeral!);
    if (esperado === undefined) continue;
    if (normalize(esperado) === normalize(c.subtitulo)) continue;
    check(
      DIVERGENCIAS_ACEITAS.has(c.numeral!),
      `divergência NOVA no capítulo ${c.numeral}: sumário "${esperado}" ≠ corpo "${c.subtitulo}"`,
    );
    console.warn(
      `  ⚠ ${c.numeral}: sumário diz "${esperado}", corpo diz "${c.subtitulo}" — usando o corpo`,
    );
  }
}

function assertSaida(dir: string): void {
  const arquivos = readdirSync(dir).sort();
  check(arquivos.length === ESPERADO.secoes, `arquivos = ${arquivos.length}`);
  arquivos.forEach((f, i) => {
    check(
      f.startsWith(String(i + 1).padStart(2, "0") + "-"),
      `prefixo fora de sequência: ${f}`,
    );
  });
  let total = 0;
  for (const f of arquivos) {
    const txt = require("node:fs").readFileSync(join(dir, f), "utf-8");
    total += txt.length;
    for (const veneno of ["<w:", "&lt;w:", "&amp;", "�", "xml:space"]) {
      check(!txt.includes(veneno), `"${veneno}" vazou em ${f}`);
    }
  }
  check(
    total > 72_000 && total < 100_000,
    `volume total ${total} fora da faixa esperada (~80k)`,
  );
}

// ------------------------------------------------------------------ main

function main(): void {
  const docx = process.argv[2];
  if (!docx) {
    console.error("uso: bun scripts/import-agenda.ts <caminho-do-.docx>");
    process.exit(1);
  }

  const xml = readDocumentXml(docx);
  const nodes = parseBody(xml);
  check(
    nodes.length === ESPERADO.filhosTopo,
    `filhos top-level = ${nodes.length}`,
  );
  check(
    nodes.filter((n) => n.kind === "tbl").length === ESPERADO.tabelas,
    `tabelas = ${nodes.filter((n) => n.kind === "tbl").length}`,
  );

  // Sumário (antes da primeira fronteira): só para cross-check.
  const toc = new Map<string, string>();
  for (const n of nodes) {
    if (ehFronteira(n)) break;
    if (n.kind !== "p" || n.p.sz !== 20) continue;
    const m = n.p.text.match(/^([IVX]+)\s+(.+?)\s+·\s+(.+)$/);
    if (m) toc.set(m[1], m[3]);
  }

  // Fatiar em seções.
  const cortes: { i: number; tipo: "capitulo" | "frente" }[] = [];
  nodes.forEach((n, i) => {
    const t = ehFronteira(n);
    if (t) cortes.push({ i, tipo: t });
  });
  const secoes = cortes.map((c, k) =>
    construirSecao(
      nodes.slice(c.i, cortes[k + 1]?.i ?? nodes.length),
      c.tipo,
      k + 1,
    ),
  );

  assertAll(secoes, toc, xml);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const s of secoes) {
    const nome = `${String(s.ordem).padStart(2, "0")}-${s.slug}.md`;
    writeFileSync(join(OUT_DIR, nome), toMarkdown(s));
  }
  assertSaida(OUT_DIR);

  for (const s of secoes) {
    const n = (t: string) => s.blocos.filter((b) => b.t === t).length;
    const regua = s.blocos.find((b) => b.t === "regua") as any;
    console.log(
      `${String(s.ordem).padStart(2, "0")} ${s.slug.padEnd(52)} ` +
        `${n("lead") ? "lead✓" : "     "} ${String(n("para")).padStart(2)} paras ` +
        `${n("destaque")} destaques ${n("caixa")} caixas ` +
        `${regua ? `régua ${regua.objetivos.length} obj` : ""}`,
    );
  }
  console.log(`\n✓ ${secoes.length} seções em content/imprescindivel/`);
}

main();
