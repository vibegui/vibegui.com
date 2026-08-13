#!/usr/bin/env bun
// The project <-> strategic result relationship, both directions.
//
// `serves:` on a project is the single source of truth; the reverse view is
// derived here and never written down, so the two cannot disagree.
//
// Exits non-zero only on a `serves:` id that is not declared — that is a real
// error. Orphans on either side are reported but do not fail: an active project
// serving nothing, or a declared outcome nothing serves, are decisions to make,
// not typos to fix.
import { Glob } from "bun";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const warn = (s: string) => `\x1b[33m${s}\x1b[0m`;
const err = (s: string) => `\x1b[31m${s}\x1b[0m`;

const declared = (await Bun.file("worldview.json").json()).strategicResults as {
  id: string;
  title: string;
}[];
const ids = new Set(declared.map((r) => r.id));

interface Project {
  id: string;
  lifecycle: string;
  serves: string[];
  supersededBy: string;
  competesWith: string[];
}

const projects: Project[] = [];
for await (const file of new Glob("projects/*.md").scan(".")) {
  if (file.endsWith("README.md")) continue;
  const frontmatter = (await Bun.file(file).text()).split("---")[1] ?? "";
  const field = (key: string) =>
    frontmatter
      .match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]
      ?.replace(/\s*#.*/, "")
      .trim() ?? "";
  projects.push({
    id: field("id"),
    lifecycle: field("lifecycle"),
    supersededBy: field("superseded_by"),
    competesWith: (field("competes_with").match(/\[(.*)\]/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    serves: (field("serves").match(/\[(.*)\]/)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
}

let undeclared = 0;

console.log(`\n${bold("PROJECTS → what they serve")}`);
const order = { active: 0, draft: 1, archived: 2 } as Record<string, number>;
for (const p of projects.sort(
  (a, b) => (order[a.lifecycle] ?? 9) - (order[b.lifecycle] ?? 9),
)) {
  const unknown = p.serves.filter((s) => !ids.has(s));
  undeclared += unknown.length;
  const note = unknown.length
    ? err(`  UNDECLARED: ${unknown.join(", ")}`)
    : p.lifecycle === "archived"
      ? dim(`  superseded by ${p.supersededBy || "?"}`)
      : p.serves.length === 0 && p.lifecycle === "active"
        ? warn("  ← active but serves nothing declared")
        : "";
  console.log(
    `  ${p.id.padEnd(17)} ${p.lifecycle.padEnd(9)} ${p.serves.join(", ") || "—"}${note}`,
  );
}

console.log(`\n${bold("DECLARED OUTCOMES → what serves them")}`);
for (const r of declared) {
  const by = projects.filter(
    (p) => p.lifecycle !== "archived" && p.serves.includes(r.id),
  );
  const rivals = by.some((p) => by.some((q) => p.competesWith.includes(q.id)));
  // Several complementary projects on one outcome is normal, not a smell. Only
  // two things are worth flagging: nothing at all, or a declared race.
  const note =
    by.length === 0
      ? warn("  ← nothing serves this")
      : rivals
        ? dim("  ← parallel bets, one wins")
        : "";
  console.log(
    `  ${r.id.padEnd(17)} ${by.map((p) => p.id).join(", ") || "—"}${note}`,
  );
}

// Two projects serving one outcome is a deliberate hedge when they declare each
// other as competitors, and an accident otherwise. Show which.
const byId = new Map(projects.map((p) => [p.id, p]));
const races = new Map<string, string[]>();
for (const p of projects) {
  for (const id of p.competesWith) {
    const rival = byId.get(id);
    if (!rival) continue;
    // Contested = outcomes BOTH serve. A project's other outcomes are its own.
    races.set(
      [p.id, id].sort().join(" vs "),
      p.serves.filter((o) => rival.serves.includes(o)),
    );
  }
}
if (races.size) {
  console.log(`\n${bold("PARALLEL BETS → one wins")}`);
  for (const [pair, contested] of races) {
    console.log(
      `  ${pair.padEnd(28)} contesting: ${contested.join(", ") || "—"}`,
    );
  }
  console.log(
    dim("  a race with no finish line is just two projects — see each file"),
  );
}

const active = projects.filter((p) => p.lifecycle === "active");
const covered = declared.filter((r) =>
  active.some((p) => p.serves.includes(r.id)),
);
console.log(
  `\n  ${covered.length}/${declared.length} declared outcomes have an active project`,
);
console.log(
  `  ${active.filter((p) => p.serves.length).length}/${active.length} active projects serve something declared\n`,
);

if (undeclared) {
  console.error(
    err(`${undeclared} serves: id(s) not declared in worldview.json\n`),
  );
  process.exit(1);
}
