/**
 * Bridge-deck diagrams, ported from decocms-tanstack `src/routes/bridge.tsx`
 * (DecoHub + FoldLoop / LoopRing). Same structure and behaviour; styled for
 * vibegui story articles via `.story-bridge-*` classes in story.css.
 */
import type { ReactNode } from "react";

type Channel = { name: string; detail: string };
type CapabilityGroup = { group: string; items: string[] };
type LoopStep = { verb: string; rest: string };

type HubCopy = {
  channels: Channel[];
  hubLabel: string;
  capabilities: CapabilityGroup[];
};

type LoopCopy = {
  signals: string;
  signalsCaption: string;
  steps: LoopStep[];
  stepsAside: string;
  memory: { lead: string; strong: string; tail?: string };
};

const HUB_EN: HubCopy = {
  channels: [
    { name: "Site", detail: "Web storefront" },
    { name: "App", detail: "iOS and Android" },
    { name: "Concierge", detail: "Chat, email, WhatsApp" },
  ],
  hubLabel: "One provider",
  capabilities: [
    { group: "Service", items: ["Content", "SEO", "CRO", "QA", "UX"] },
    {
      group: "Software",
      items: ["CMS", "Infra", "Analytics", "Personalization", "Integrations"],
    },
  ],
};

const HUB_PT: HubCopy = {
  channels: [
    { name: "Site", detail: "Loja web" },
    { name: "App", detail: "iOS e Android" },
    { name: "Concierge", detail: "Chat, email, WhatsApp" },
  ],
  hubLabel: "Um provedor",
  capabilities: [
    { group: "Serviço", items: ["Conteúdo", "SEO", "CRO", "QA", "UX"] },
    {
      group: "Software",
      items: ["CMS", "Infra", "Analytics", "Personalização", "Integrações"],
    },
  ],
};

const LOOP_EN: LoopCopy = {
  signals: "389",
  signalsCaption: "signals watched",
  steps: [
    { verb: "Find", rest: "what's costing conversion." },
    { verb: "Fix", rest: "autonomously: code, copy, layout, speed." },
    { verb: "Prove", rest: "it on live traffic with an A/B test." },
    { verb: "Ship", rest: "what wins — then start over." },
  ],
  stepsAside: "Variation, selection, inheritance. Thanks, Darwin.",
  memory: {
    lead: "Every fix is remembered, so the next store runs smarter than the last.",
    strong: "Four times the work in half the time.",
  },
};

const LOOP_PT: LoopCopy = {
  signals: "389",
  signalsCaption: "sinais monitorados",
  steps: [
    { verb: "Acha", rest: "o que custa conversão." },
    { verb: "Faz", rest: "sozinho: código, copy, layout, velocidade." },
    { verb: "Prova", rest: "no tráfego ao vivo com um A/B test." },
    { verb: "Sobe", rest: "o que ganha — e recomeça." },
  ],
  stepsAside: "Variação, seleção, herança. Valeu, Darwin.",
  memory: {
    lead: "Cada fix fica na memória, então a próxima loja roda mais esperta que a anterior.",
    strong: "Quatro vezes o trabalho na metade do tempo.",
  },
};

function Gutter({ count, side }: { count: number; side: "left" | "right" }) {
  const hubEdge = side === "left" ? 10 : 0;
  const chipEdge = side === "left" ? 0 : 10;
  const bendX = chipEdge + (hubEdge - chipEdge) / 3;
  return (
    <div className="story-bridge-gutter" aria-hidden="true">
      <svg viewBox="0 0 10 100" preserveAspectRatio="none">
        {Array.from({ length: count }, (_, i) => {
          const y = ((i + 0.5) / count) * 100;
          return (
            <path
              key={i}
              d={`M ${chipEdge} ${y} Q ${bendX} ${y} ${bendX} ${(y + 50) / 2} Q ${bendX} 50 ${hubEdge} 50`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

function SiteMock() {
  return (
    <span
      className="story-bridge-mock story-bridge-mock-site"
      aria-hidden="true"
    >
      <span className="story-bridge-mock-chrome">
        <i />
        <i />
        <i />
      </span>
      <span className="story-bridge-mock-body">
        <i />
        <i />
      </span>
    </span>
  );
}

function AppMock() {
  return (
    <span
      className="story-bridge-mock story-bridge-mock-app"
      aria-hidden="true"
    >
      <span>
        <i />
        <span>
          <b />
          <b />
          <b />
          <b />
        </span>
        <i />
      </span>
    </span>
  );
}

function ConciergeMock() {
  return (
    <span
      className="story-bridge-mock story-bridge-mock-concierge"
      aria-hidden="true"
    >
      <span>
        <i />
        <i />
        <i />
      </span>
      <b />
    </span>
  );
}

const CHANNEL_MOCK: Record<string, () => ReactNode> = {
  Site: SiteMock,
  App: AppMock,
  Concierge: ConciergeMock,
};

export function BridgeHub({ locale = "en" }: { locale?: "en" | "pt" }) {
  const content = locale === "pt" ? HUB_PT : HUB_EN;
  const { channels, capabilities, hubLabel } = content;

  return (
    <figure className="story-bridge-hub">
      <div className="story-bridge-hub-grid">
        <ul className="story-bridge-channels">
          {channels.map(({ name, detail }) => {
            const Mock = CHANNEL_MOCK[name];
            return (
              <li key={name}>
                <span className="story-bridge-channel-copy">
                  <span className="story-bridge-channel-name">{name}</span>
                  <span className="story-bridge-channel-detail">{detail}</span>
                </span>
                <span className="story-bridge-channel-mock">
                  {Mock ? <Mock /> : null}
                </span>
              </li>
            );
          })}
        </ul>

        <Gutter count={channels.length} side="left" />

        <div className="story-bridge-mark">
          <span className="story-bridge-mark-tile">
            <img
              src="/images/articles/deco-mark.svg"
              alt=""
              width={40}
              height={40}
            />
          </span>
          <span className="story-bridge-mark-label">{hubLabel}</span>
        </div>

        <Gutter count={capabilities.length} side="right" />

        <div className="story-bridge-caps">
          {capabilities.map(({ group, items }) => (
            <div key={group} className="story-bridge-cap-group">
              <p>{group}</p>
              <ul>
                {items.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

function LoopRing({ content }: { content: LoopCopy }) {
  const POSITIONS: Array<[number, number]> = [
    [150, 42],
    [258, 150],
    [150, 258],
    [42, 150],
  ];
  const NODES: Array<[string, number, number]> = content.steps.map(
    ({ verb }, i) => {
      const pos = POSITIONS[i];
      if (!pos) throw new Error(`Missing loop ring position for step ${i}`);
      return [verb, pos[0], pos[1]];
    },
  );

  return (
    <svg
      viewBox="0 0 300 300"
      className="story-bridge-loop-ring"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="story-bridge-loop-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className="story-bridge-loop-ink" />
        </marker>
      </defs>
      <path
        d="M150 42 A108 108 0 1 1 132 44"
        fill="none"
        className="story-bridge-loop-arc"
        strokeWidth="1.5"
        strokeLinecap="round"
        markerEnd="url(#story-bridge-loop-arrow)"
      />
      <text
        x="150"
        y="142"
        textAnchor="middle"
        dominantBaseline="central"
        className="story-bridge-loop-stat story-bridge-loop-ink"
      >
        {content.signals}
      </text>
      <text
        x="150"
        y="174"
        textAnchor="middle"
        className="story-bridge-loop-stat-caption"
      >
        {content.signalsCaption}
      </text>
      {NODES.map(([label, cx, cy]) => (
        <g key={label}>
          <circle
            cx={cx}
            cy={cy}
            r="26"
            className="story-bridge-loop-node-disk"
            strokeWidth="1.5"
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            className="story-bridge-loop-node story-bridge-loop-ink"
          >
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function BridgeLoop({ locale = "en" }: { locale?: "en" | "pt" }) {
  const content = locale === "pt" ? LOOP_PT : LOOP_EN;

  return (
    <figure className="story-bridge-loop">
      <div className="story-bridge-loop-grid">
        <div className="story-bridge-loop-ring-wrap">
          <LoopRing content={content} />
        </div>
        <div className="story-bridge-loop-steps">
          {content.steps.map(({ verb, rest }, i) => (
            <div key={verb} className="story-bridge-loop-step">
              <span>{i + 1}</span>
              <p>
                <strong>{verb}</strong> {rest}
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

type LocaleProp = { locale?: "en" | "pt" };

const DECAY = {
  en: {
    growth: "Work to do",
    efficiency: "What ships",
    leftLabel: "As the brand grows",
    leftTitle: "The work outruns the team",
    rightLabel: "With the factory",
    rightTitle: "The queue keeps pace",
  },
  pt: {
    growth: "Trabalho a fazer",
    efficiency: "O que sobe",
    leftLabel: "Conforme a marca cresce",
    leftTitle: "O trabalho passa o time",
    rightLabel: "Com a fábrica",
    rightTitle: "A fila acompanha",
  },
} as const;

/** Left: growth rises, efficiency falls. Right: both rise; growth steeper. */
function DecayChart({
  mode,
  growth,
  efficiency,
}: {
  mode: "cross" | "pace";
  growth: string;
  efficiency: string;
}) {
  if (mode === "cross") {
    return (
      <svg
        className="story-decay-chart"
        viewBox="0 0 280 168"
        aria-hidden="true"
      >
        <line className="story-decay-axis" x1="16" y1="140" x2="264" y2="140" />
        <path
          className="story-decay-line-growth"
          d="M24 100 C70 96, 110 74, 150 58 S210 36, 248 30"
        />
        <path
          className="story-decay-line-efficiency"
          d="M24 52 C70 64, 110 78, 150 94 S210 122, 248 130"
        />
        <circle className="story-decay-dot-growth" cx="248" cy="30" r="4" />
        <circle
          className="story-decay-dot-efficiency"
          cx="248"
          cy="130"
          r="4"
        />
        <text
          className="story-decay-tag-growth"
          x="242"
          y="18"
          textAnchor="end"
        >
          {growth}
        </text>
        <text
          className="story-decay-tag-efficiency"
          x="242"
          y="156"
          textAnchor="end"
        >
          {efficiency}
        </text>
      </svg>
    );
  }

  return (
    <svg className="story-decay-chart" viewBox="0 0 280 168" aria-hidden="true">
      <line className="story-decay-axis" x1="16" y1="140" x2="264" y2="140" />
      <path
        className="story-decay-line-growth"
        d="M24 124 C80 122, 120 118, 155 100 S205 55, 248 16"
      />
      <path
        className="story-decay-line-efficiency"
        d="M24 130 C82 126, 125 116, 165 96 S215 62, 248 52"
      />
      <circle className="story-decay-dot-growth" cx="248" cy="16" r="4" />
      <circle className="story-decay-dot-efficiency" cx="248" cy="52" r="4" />
      <text className="story-decay-tag-growth" x="242" y="10" textAnchor="end">
        {growth}
      </text>
      <text
        className="story-decay-tag-efficiency"
        x="248"
        y="100"
        textAnchor="end"
      >
        {efficiency}
      </text>
    </svg>
  );
}

export function StoryDecay({ locale = "en" }: LocaleProp) {
  const c = DECAY[locale];
  return (
    <figure className="story-decay">
      <div className="story-decay-grid">
        <div className="story-decay-panel story-decay-bad">
          <span>{c.leftLabel}</span>
          <strong>{c.leftTitle}</strong>
          <DecayChart
            mode="cross"
            growth={c.growth}
            efficiency={c.efficiency}
          />
        </div>
        <div className="story-decay-panel story-decay-good">
          <span>{c.rightLabel}</span>
          <strong>{c.rightTitle}</strong>
          <DecayChart mode="pace" growth={c.growth} efficiency={c.efficiency} />
        </div>
      </div>
    </figure>
  );
}

const CAST = {
  en: {
    beforeLabel: "Legacy agency",
    afterLabel: "Software factory",
    beforeNote: "15 people · meetings · retainer",
    afterNote: "same roles · chat rooms",
    beforeHours: "Mon–Fri, 9 to 5",
    afterHours: "24/7",
    roleRows: [
      ["PO", "SEO", "CRO", "Frontend"],
      ["QA", "UX", "Content"],
    ],
    caption:
      "Same roles on the org chart. What disappears is the waiting between them.",
  },
  pt: {
    beforeLabel: "Agência legada",
    afterLabel: "Fábrica de software",
    beforeNote: "15 pessoas · reunião · retainer",
    afterNote: "mesmos papéis · chat rooms",
    beforeHours: "seg–sex, 9h às 17h",
    afterHours: "24/7",
    roleRows: [
      ["PO", "SEO", "CRO", "Frontend"],
      ["QA", "UX", "Conteúdo"],
    ],
    caption:
      "Mesmos papéis no organograma. O que desaparece é a espera entre eles.",
  },
} as const;

export function StoryCast({ locale = "en" }: LocaleProp) {
  const c = CAST[locale];
  return (
    <figure className="story-cast" aria-labelledby="cast-caption">
      <div className="story-cast-grid">
        <div className="story-cast-side">
          <span>{c.beforeLabel}</span>
          <div className="story-cast-dots" aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => (
              <i key={i} style={{ ["--i" as string]: i }} />
            ))}
          </div>
          <small>{c.beforeNote}</small>
          <small className="story-cast-coverage">{c.beforeHours}</small>
        </div>
        <b aria-hidden="true">→</b>
        <div className="story-cast-side story-cast-after">
          <span>{c.afterLabel}</span>
          <div className="story-cast-roles-rows">
            {c.roleRows.map((row) => (
              <ul className="story-cast-roles" key={row[0]}>
                {row.map((role) => (
                  <li key={role}>{role}</li>
                ))}
              </ul>
            ))}
          </div>
          <small>{c.afterNote}</small>
          <small className="story-cast-coverage story-cast-coverage-full">
            {c.afterHours}
          </small>
        </div>
      </div>
      <figcaption id="cast-caption">{c.caption}</figcaption>
    </figure>
  );
}

const ROOMS = {
  en: {
    rows: [
      {
        left: "Room",
        right: "Repository",
        note: "one conversation surface per codebase",
      },
      { left: "Thread", right: "Branch", note: "the whole story of the work" },
      {
        left: "Sandbox",
        right: "Computer",
        note: "where the agent runs tools",
      },
      {
        left: "Agent",
        right: "Role",
        note: "PO, coding, QA, SEO, content",
      },
      {
        left: "Kanban",
        right: "Shared state",
        note: "I'll take it means the card moves",
      },
    ],
    caption:
      "Rooms, threads, a board: the agency you already know how to talk to.",
  },
  pt: {
    rows: [
      {
        left: "Room",
        right: "Repositório",
        note: "uma superfície de conversa por codebase",
      },
      {
        left: "Thread",
        right: "Branch",
        note: "a história inteira do trabalho",
      },
      {
        left: "Sandbox",
        right: "Computador",
        note: "onde o agent roda as tools",
      },
      {
        left: "Agent",
        right: "Papel",
        note: "PO, coding, QA, SEO, conteúdo",
      },
      {
        left: "Kanban",
        right: "Estado compartilhado",
        note: "eu pego quer dizer que o card andou",
      },
    ],
    caption: "Room, thread, board: a agência com quem você já sabe conversar.",
  },
} as const;

export function StoryRooms({ locale = "en" }: LocaleProp) {
  const c = ROOMS[locale];
  return (
    <figure className="story-rooms" aria-labelledby="rooms-caption">
      <div className="story-rooms-table" role="list">
        {c.rows.map(({ left, right, note }) => (
          <div key={left} className="story-rooms-row" role="listitem">
            <strong>{left}</strong>
            <span aria-hidden="true">→</span>
            <b>{right}</b>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <figcaption id="rooms-caption">{c.caption}</figcaption>
    </figure>
  );
}

const COMPOUND = {
  en: {
    head: "each turn makes the model stronger",
    nodes: [
      { pos: "top", label: "Monitor" },
      { pos: "right", label: "Fix in production" },
      { pos: "bottom", label: "Cross-brand evidence" },
      { pos: "left", label: "Learn and evolve" },
    ],
  },
  pt: {
    head: "cada volta torna o modelo mais forte",
    nodes: [
      { pos: "top", label: "Monitorar" },
      { pos: "right", label: "Fix em produção" },
      { pos: "bottom", label: "Evidência cross-brand" },
      { pos: "left", label: "Aprender e evoluir" },
    ],
  },
} as const;

const NODE_ICON: Record<string, ReactNode> = {
  top: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  right: <path d="M13 2 4 14h7l-2 8 9-12h-7z" />,
  bottom: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </>
  ),
  left: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </>
  ),
};

/** Investor data-room compounding flywheel (diagnostic → fix → evidence → model). */
export function StoryCompound({ locale = "en" }: LocaleProp) {
  const c = COMPOUND[locale];
  const uid = locale === "pt" ? "pt" : "en";

  return (
    <figure className="story-compound">
      <div className="story-compound-wheel">
        <svg
          className="story-compound-ring"
          viewBox="0 0 400 400"
          aria-hidden="true"
        >
          <defs>
            <filter
              id={`scfGlow-${uid}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient
              id={`scfGrad-${uid}`}
              x1="-22"
              y1="0"
              x2="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#D0EC1A" stopOpacity="0" />
              <stop offset="1" stopColor="#8CAA25" stopOpacity=".95" />
            </linearGradient>
          </defs>
          {/* Oval path — track + comet orbit (CSS rotate can't do ellipses) */}
          <path
            id={`scfOrbit-${uid}`}
            className="story-compound-track"
            d="M200,100 A160,100 0 1,1 199.99,100"
            fill="none"
          />
          <g className="story-compound-spin">
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
              <mpath href={`#scfOrbit-${uid}`} />
            </animateMotion>
            <path
              className="story-compound-tail"
              d="M-22,0 H0"
              stroke={`url(#scfGrad-${uid})`}
              filter={`url(#scfGlow-${uid})`}
            />
            <circle
              cx="0"
              cy="0"
              r="6"
              fill="#D0EC1A"
              filter={`url(#scfGlow-${uid})`}
            />
            <circle className="story-compound-comet" cx="0" cy="0" r="2.6" />
          </g>
        </svg>

        <div className="story-compound-hub">
          <div className="story-compound-logo">
            <img
              src="/images/articles/deco-mark.svg"
              alt=""
              width={40}
              height={40}
            />
          </div>
          <div className="story-compound-head">{c.head}</div>
        </div>

        {c.nodes.map(({ pos, label }) => (
          <div
            key={pos}
            className={`story-compound-node story-compound-n-${pos}`}
          >
            <div className="story-compound-chip">
              <svg viewBox="0 0 24 24">{NODE_ICON[pos]}</svg>
            </div>
            <div className="story-compound-lbl">{label}</div>
          </div>
        ))}

        <div className="story-compound-loop" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </div>
      </div>
    </figure>
  );
}

/* ─── "AI Learned to Work": responsibility timeline and factory ─── */

const TIMELINE = {
  en: {
    label: "The transfer of responsibility",
    title: "Answer → Execute → Operate",
    gainedLabel: "The system",
    missingLabel: "The human still",
    entries: [
      {
        when: "2023",
        what: "Answer",
        who: "Prompt + chat",
        gained: "Writes, summarizes, analyzes, and recommends.",
        missing:
          "Finds the work, carries the context, acts, and checks the result.",
      },
      {
        when: "2024–25",
        what: "Execute",
        who: "Tools + agents",
        gained:
          "Plans, uses tools, reads the result, corrects itself, and acts again.",
        missing: "Finds the task and decides what deserves attention next.",
      },
      {
        when: "Now",
        what: "Operate",
        who: "Software factory",
        gained:
          "Watches signals, chooses work against a goal, acts, measures, and remembers.",
        missing:
          "Sets the goal, the constraints, and the boundaries of accountability.",
      },
    ],
    caption:
      "More of the job moved from the person in front of the screen into the system behind it.",
  },
  pt: {
    label: "A transferência de responsabilidade",
    title: "Responder → Executar → Operar",
    gainedLabel: "O sistema",
    missingLabel: "O humano ainda",
    entries: [
      {
        when: "2023",
        what: "Responder",
        who: "Prompt + chat",
        gained: "Escreve, resume, analisa e recomenda.",
        missing:
          "Encontra o trabalho, carrega o contexto, age e confere o resultado.",
      },
      {
        when: "2024–25",
        what: "Executar",
        who: "Ferramentas + agentes",
        gained:
          "Planeja, usa ferramentas, lê o resultado, se corrige e age de novo.",
        missing: "Encontra a tarefa e decide o que merece atenção em seguida.",
      },
      {
        when: "Agora",
        what: "Operar",
        who: "Fábrica de software",
        gained:
          "Observa sinais, escolhe trabalho contra uma meta, age, mede e lembra.",
        missing:
          "Define a meta, as restrições e os limites da responsabilidade.",
      },
    ],
    caption:
      "Mais partes do trabalho saíram da pessoa na frente da tela e foram para o sistema por trás dela.",
  },
} as const;

export function FactoryTimeline({ locale = "en" }: LocaleProp) {
  const c = TIMELINE[locale];
  return (
    <figure
      className="story-factory"
      aria-labelledby={`factory-timeline-cap-${locale}`}
    >
      <span className="story-factory-label">{c.label}</span>
      <strong className="story-factory-title">{c.title}</strong>
      <ol className="story-factory-timeline">
        {c.entries.map((e) => (
          <li key={e.what}>
            <time>{e.when}</time>
            <div className="story-factory-term">
              <b>{e.what}</b>
              <small>{e.who}</small>
            </div>
            <div className="story-factory-chain">
              <p className="story-factory-gained">
                <i>{c.gainedLabel}</i>
                {e.gained}
              </p>
              <p className="story-factory-missing">
                <i>{c.missingLabel}</i>
                {e.missing}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <figcaption id={`factory-timeline-cap-${locale}`}>{c.caption}</figcaption>
    </figure>
  );
}

const PLANT = {
  en: {
    label: "The software factory",
    title: "The system closes the loop around a business result",
    goal: {
      head: "Goal, constraints, accountable human",
      body: "Improve conversion without breaking brand, margin, security, or trust",
    },
    inputs: {
      head: "Signals",
      body: "Work appears before a ticket exists",
      items: [
        "Conversion changes",
        "Catalog drift",
        "Vitals and incidents",
        "Competitor moves",
        "Customer behavior",
      ],
    },
    inside: {
      head: "Internal loops",
      items: [
        { k: "Observe", v: "combine evidence across systems" },
        { k: "Decide", v: "rank work against the goal" },
        { k: "Execute", v: "agents act within tools and permissions" },
        { k: "Verify", v: "test the result and escalate exceptions" },
      ],
    },
    outputs: {
      head: "Actions",
      body: "Work lands in the business",
      items: [
        "Pull request",
        "Deploy",
        "Page or price",
        "Campaign",
        "Escalation",
      ],
    },
    feedback:
      "Measure the outcome · keep what worked · feed it into the next decision",
    caption:
      "People set direction and handle exceptions. The factory keeps the operation moving between those decisions.",
  },
  pt: {
    label: "A fábrica de software",
    title: "O sistema fecha o loop em torno de um resultado de negócio",
    goal: {
      head: "Meta, restrições e humano responsável",
      body: "Melhorar conversão sem quebrar marca, margem, segurança ou confiança",
    },
    inputs: {
      head: "Sinais",
      body: "O trabalho aparece antes de existir um card",
      items: [
        "Mudanças na conversão",
        "Desvio de catálogo",
        "Vitals e incidentes",
        "Movimentos de concorrentes",
        "Comportamento do cliente",
      ],
    },
    inside: {
      head: "Loops internos",
      items: [
        { k: "Observar", v: "combinar evidências de vários sistemas" },
        { k: "Decidir", v: "priorizar trabalho contra a meta" },
        { k: "Executar", v: "agentes agem dentro de ferramentas e permissões" },
        { k: "Verificar", v: "testar o resultado e escalar exceções" },
      ],
    },
    outputs: {
      head: "Ações",
      body: "O trabalho chega ao negócio",
      items: [
        "Pull request",
        "Deploy",
        "Página ou preço",
        "Campanha",
        "Escalação",
      ],
    },
    feedback:
      "Medir o resultado · guardar o que funcionou · usar na próxima decisão",
    caption:
      "Pessoas definem a direção e cuidam das exceções. A fábrica mantém a operação andando entre essas decisões.",
  },
} as const;

export function FactoryPlant({ locale = "en" }: LocaleProp) {
  const c = PLANT[locale];
  return (
    <figure
      className="story-factory story-factory-plant"
      aria-labelledby={`factory-plant-cap-${locale}`}
    >
      <span className="story-factory-label">{c.label}</span>
      <strong className="story-factory-title">{c.title}</strong>

      <div className="story-factory-goal">
        <b>{c.goal.head}</b>
        <small>{c.goal.body}</small>
      </div>

      <div className="story-factory-floor">
        <div className="story-factory-col">
          <span>{c.inputs.head}</span>
          <small>{c.inputs.body}</small>
          <ul>
            {c.inputs.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <b className="story-factory-arrow" aria-hidden="true">
          →
        </b>

        <div className="story-factory-col story-factory-inside">
          <span>{c.inside.head}</span>
          <dl>
            {c.inside.items.map((i) => (
              <div key={i.k}>
                <dt>{i.k}</dt>
                <dd>{i.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <b className="story-factory-arrow" aria-hidden="true">
          →
        </b>

        <div className="story-factory-col">
          <span>{c.outputs.head}</span>
          <small>{c.outputs.body}</small>
          <ul>
            {c.outputs.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="story-factory-feedback">
        <span aria-hidden="true">↺</span>
        {c.feedback}
      </div>

      <figcaption id={`factory-plant-cap-${locale}`}>{c.caption}</figcaption>
    </figure>
  );
}
