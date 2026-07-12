import { type FormEvent, useEffect, useRef, useState } from "react";
import { useMcp } from "./mcp";

type JsonRecord = Record<string, unknown>;

const NAV_ITEMS = [
  { label: "Projects", tool: "GET_PORTFOLIO" },
  { label: "Goals", tool: "LIST_GOALS" },
  { label: "Daily brief", tool: "GET_DAILY_BRIEF" },
  { label: "Inbox", tool: "GET_INBOX" },
  { label: "Memory", tool: "RECALL_MEMORY" },
] as const;

export function App() {
  const { connected, loading, toolName, toolResult, error, callTool } =
    useMcp();
  const initialized = useRef(false);
  const [captureText, setCaptureText] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!connected || toolResult || initialized.current) return;
    initialized.current = true;
    void callTool("GET_PORTFOLIO");
  }, [callTool, connected, toolResult]);

  async function submitCapture(event: FormEvent) {
    event.preventDefault();
    const content = captureText.trim();
    if (!content || capturing) return;

    setCapturing(true);
    try {
      await callTool("CAPTURE", { content, kind: "idea" });
      setCaptureText("");
      await callTool("GET_INBOX");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">VibeGui</p>
          <h1>Personal AI OS</h1>
        </div>
        <span className={`connection ${connected ? "online" : ""}`}>
          {connected ? "Private Studio" : "Connecting"}
        </span>
      </header>

      <form className="capture" onSubmit={submitCapture}>
        <input
          aria-label="Capture an idea"
          value={captureText}
          onChange={(event) => setCaptureText(event.target.value)}
          placeholder="Capture something before it disappears…"
        />
        <button type="submit" disabled={!captureText.trim() || capturing}>
          {capturing ? "Saving" : "Capture"}
        </button>
      </form>

      <nav className="nav" aria-label="Personal AI OS views">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.tool}
            className={toolName === item.tool ? "active" : ""}
            onClick={() => void callTool(item.tool)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="content" aria-live="polite">
        {loading && <Loading />}
        {error && <div className="error">{error}</div>}
        {!loading && !error && (
          <ResultView
            toolName={toolName}
            result={asRecord(toolResult)}
            callTool={callTool}
          />
        )}
      </section>
    </main>
  );
}

function ResultView({
  toolName,
  result,
  callTool,
}: {
  toolName?: string;
  result: JsonRecord;
  callTool: <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
}) {
  if (toolName === "GET_PORTFOLIO" || Array.isArray(result.projects)) {
    return (
      <PortfolioView
        result={result}
        openProject={(id) => void callTool("GET_PROJECT", { id })}
      />
    );
  }
  if (toolName === "LIST_GOALS" || Array.isArray(result.goals)) {
    return <GoalsView goals={asRecords(result.goals)} />;
  }
  if (toolName === "GET_INBOX" || Array.isArray(result.captures)) {
    return <InboxView captures={asRecords(result.captures)} />;
  }
  if (toolName === "RECALL_MEMORY" || Array.isArray(result.memories)) {
    return <MemoryView memories={asRecords(result.memories)} />;
  }
  if (toolName === "GET_DAILY_BRIEF" || "brief" in result) {
    return (
      <BriefView
        brief={asNullableRecord(result.brief)}
        prepare={() => void callTool("GET_DAILY_BRIEF_INPUT")}
      />
    );
  }
  if (toolName === "GET_DAILY_BRIEF_INPUT") {
    return <BriefInputView result={result} />;
  }
  if ("project" in result) {
    return (
      <ProjectView
        result={result}
        back={() => void callTool("GET_PORTFOLIO")}
      />
    );
  }
  if (Object.keys(result).length === 0) {
    return <Empty message="Choose a view to begin." />;
  }
  return <JsonFallback value={result} />;
}

function PortfolioView({
  result,
  openProject,
}: {
  result: JsonRecord;
  openProject: (id: string) => void;
}) {
  const projects = asRecords(result.projects);
  const focus = asNullableRecord(result.focus);

  return (
    <>
      <section className="hero-card">
        <p className="eyebrow">Declared focus</p>
        <h2>{text(focus?.project_name) || "No focus declared yet"}</h2>
        <p>
          {text(focus?.statement) ||
            "Map every project, then choose what deserves concentrated investment."}
        </p>
      </section>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{projects.length} projects</h2>
        </div>
      </div>

      {projects.length === 0 ? (
        <Empty message="Your map is empty. Ask the agent to add your first project." />
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <button
              type="button"
              className="project-card"
              key={text(project.id)}
              onClick={() => openProject(text(project.id))}
            >
              <span className={`mode ${text(project.investment_mode)}`}>
                {text(project.investment_mode)}
              </span>
              <h3>{text(project.name)}</h3>
              <p className="spirit">
                {text(project.spirit) || text(project.description)}
              </p>
              <p className="outcome">
                {text(project.current_outcome) || "Outcome not declared"}
              </p>
              <footer>
                <span>{number(project.active_goal_count)} active goals</span>
                <span>{relativeTime(project.last_activity_at)}</span>
              </footer>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ProjectView({
  result,
  back,
}: {
  result: JsonRecord;
  back: () => void;
}) {
  const project = asRecord(result.project);
  const goals = asRecords(result.goals);
  const memories = asRecords(result.memories);
  const decisions = asRecords(result.decisions);

  return (
    <>
      <button type="button" className="back" onClick={back}>
        ← All projects
      </button>
      <section className="hero-card">
        <span className={`mode ${text(project.investment_mode)}`}>
          {text(project.investment_mode)}
        </span>
        <h2>{text(project.name)}</h2>
        <p>{text(project.spirit) || text(project.description)}</p>
        <div className="declared-outcome">
          <strong>Current outcome</strong>
          <span>{text(project.current_outcome) || "Not declared"}</span>
        </div>
      </section>
      <div className="columns">
        <ListPanel
          title="Goals"
          items={goals}
          primary="title"
          secondary="desired_outcome"
        />
        <ListPanel
          title="Memory"
          items={memories}
          primary="content"
          secondary="source"
        />
        <ListPanel
          title="Decisions"
          items={decisions}
          primary="title"
          secondary="decision"
        />
      </div>
    </>
  );
}

function GoalsView({ goals }: { goals: JsonRecord[] }) {
  if (goals.length === 0) {
    return <Empty message="No active goals. Ask the agent to declare one." />;
  }
  return (
    <div className="stack">
      {goals.map((goal) => (
        <article className="list-card" key={text(goal.id)}>
          <header>
            <span className="mode maintain">
              {text(goal.project_name) || "Portfolio"}
            </span>
            <span className="muted">
              {text(goal.next_review) || text(goal.horizon)}
            </span>
          </header>
          <h3>{text(goal.title)}</h3>
          <p>{text(goal.desired_outcome)}</p>
          {text(goal.current_assessment) && (
            <blockquote>{text(goal.current_assessment)}</blockquote>
          )}
        </article>
      ))}
    </div>
  );
}

function InboxView({ captures }: { captures: JsonRecord[] }) {
  if (captures.length === 0) {
    return <Empty message="Inbox zero. There is space to think." />;
  }
  return (
    <div className="stack">
      {captures.map((capture) => (
        <article className="list-card" key={text(capture.id)}>
          <header>
            <span className="mode incubate">{text(capture.kind)}</span>
            <span className="muted">{relativeTime(capture.created_at)}</span>
          </header>
          <p>{text(capture.content)}</p>
          <small>{text(capture.project_name) || "Unassigned"}</small>
        </article>
      ))}
    </div>
  );
}

function MemoryView({ memories }: { memories: JsonRecord[] }) {
  if (memories.length === 0) {
    return <Empty message="No durable memories yet." />;
  }
  return (
    <div className="stack">
      {memories.map((memory) => (
        <article className="list-card" key={text(memory.id)}>
          <header>
            <span className="mode maintain">{text(memory.kind)}</span>
            <span className="muted">
              {Math.round(number(memory.confidence) * 100)}% confidence
            </span>
          </header>
          <p>{text(memory.content)}</p>
          <small>Source: {text(memory.source)}</small>
        </article>
      ))}
    </div>
  );
}

function BriefView({
  brief,
  prepare,
}: {
  brief: JsonRecord | null;
  prepare: () => void;
}) {
  if (!brief) {
    return (
      <Empty
        message="No daily brief yet."
        action="Prepare today's evidence"
        onAction={prepare}
      />
    );
  }
  return (
    <article className="brief">
      <p className="eyebrow">{text(brief.brief_date)}</p>
      <div className="brief-copy">{text(brief.content)}</div>
    </article>
  );
}

function BriefInputView({ result }: { result: JsonRecord }) {
  return (
    <article className="brief">
      <p className="eyebrow">Evidence ready · {text(result.brief_date)}</p>
      <h2>Ask your agent to write today’s brief.</h2>
      <p>
        The state packet is now in model context: goals, attention evidence,
        stale projects, decisions, and inbox.
      </p>
    </article>
  );
}

function ListPanel({
  title,
  items,
  primary,
  secondary,
}: {
  title: string;
  items: JsonRecord[];
  primary: string;
  secondary: string;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">{title}</p>
      {items.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        items.slice(0, 6).map((item) => (
          <div className="panel-item" key={text(item.id)}>
            <strong>{text(item[primary])}</strong>
            <span>{text(item[secondary])}</span>
          </div>
        ))
      )}
    </section>
  );
}

function Empty({
  message,
  action,
  onAction,
}: {
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <p>{message}</p>
      {action && onAction && (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <span />
      <span />
      <span />
    </div>
  );
}

function JsonFallback({ value }: { value: JsonRecord }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asNullableRecord(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : null;
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function relativeTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "No activity yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
