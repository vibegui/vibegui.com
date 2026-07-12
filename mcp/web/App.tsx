import { type ReactNode, useEffect, useRef } from "react";
import { useMcp } from "./mcp";

type JsonRecord = Record<string, unknown>;

const NAV_ITEMS = [
  { label: "Projects", tool: "GET_PORTFOLIO" },
  { label: "Goals", tool: "LIST_GOALS" },
  { label: "Inbox", tool: "GET_INBOX" },
  { label: "Memory", tool: "RECALL_MEMORY" },
  { label: "Declaration", tool: "GET_DECLARATION" },
] as const;

export function App() {
  const { connected, loading, toolName, toolResult, error, callTool } =
    useMcp();
  const initialized = useRef(false);

  useEffect(() => {
    if (!connected || toolResult || initialized.current) return;
    initialized.current = true;
    void callTool("GET_PORTFOLIO");
  }, [callTool, connected, toolResult]);

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
        prepareBrief={() => void callTool("GET_DAILY_BRIEF_INPUT")}
      />
    );
  }
  if ("project" in result) {
    return (
      <ProjectView
        result={result}
        back={() => void callTool("GET_PORTFOLIO")}
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
  if (toolName === "GET_DECLARATION" || "markdown" in result) {
    return (
      <DeclarationView
        markdown={text(result.markdown)}
        source={text(result.source)}
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
  prepareBrief,
}: {
  result: JsonRecord;
  openProject: (id: string) => void;
  prepareBrief: () => void;
}) {
  const projects = asRecords(result.projects);
  const dailyBrief = asNullableRecord(result.daily_brief);

  return (
    <>
      <DailyBriefHomeCard brief={dailyBrief} prepare={prepareBrief} />

      <div className="section-heading">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{projects.length} projects</h2>
        </div>
      </div>

      {projects.length === 0 ? (
        <Empty message="Your map is empty. Ask the agent to add your first project." />
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <button
              type="button"
              className="project-card"
              key={text(project.id)}
              onClick={() => openProject(text(project.id))}
            >
              <div className="project-identity">
                <div className="project-title">
                  <span className={`lifecycle ${text(project.lifecycle)}`}>
                    {text(project.lifecycle)}
                  </span>
                  <h3>{text(project.name)}</h3>
                </div>
                <p className="spirit">
                  {text(project.spirit) || text(project.description)}
                </p>
                <footer>
                  <span>{number(project.active_goal_count)} active goals</span>
                  <span>{number(project.open_work_item_count)} open items</span>
                  <span>{relativeTime(project.last_activity_at)}</span>
                </footer>
              </div>
              <div className="project-outcome">
                <span className="project-label">Current outcome</span>
                <p>{text(project.current_outcome) || "Outcome not declared"}</p>
              </div>
              <ProjectProgress project={project} />
              <span className="project-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function DailyBriefHomeCard({
  brief,
  prepare,
}: {
  brief: JsonRecord | null;
  prepare: () => void;
}) {
  return (
    <section className="daily-brief-card">
      <header>
        <div>
          <p className="eyebrow">Daily brief</p>
          <h2>{brief ? text(brief.brief_date) : "Start the day oriented"}</h2>
        </div>
        <button type="button" onClick={prepare}>
          {brief ? "Refresh evidence" : "Prepare brief"}
        </button>
      </header>
      {brief ? (
        <p className="daily-brief-copy">{text(brief.content)}</p>
      ) : (
        <p className="daily-brief-empty">
          No brief has been saved yet. Prepare the current evidence, then ask
          your Studio agent to synthesize and save today’s brief.
        </p>
      )}
    </section>
  );
}

function ProjectProgress({ project }: { project: JsonRecord }) {
  const rawProgress = project.progress_percent;
  const assessed =
    typeof rawProgress === "number" ||
    (typeof rawProgress === "string" && rawProgress !== "");
  const progress = assessed
    ? Math.min(100, Math.max(0, number(rawProgress)))
    : 0;

  return (
    <div className="project-progress">
      <div className="progress-heading">
        <span className="project-label">Progress</span>
        <strong>{assessed ? `${progress}%` : "Unscored"}</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${text(project.name)} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={assessed ? progress : undefined}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>{text(project.progress_note) || "Set an honest assessment"}</p>
    </div>
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
  const workItems = asRecords(result.work_items);
  const activity = asRecords(result.activity);

  return (
    <>
      <button type="button" className="back" onClick={back}>
        ← All projects
      </button>
      <section className="hero-card">
        <span className={`lifecycle ${text(project.lifecycle)}`}>
          {text(project.lifecycle)}
        </span>
        <h2>{text(project.name)}</h2>
        <p>{text(project.spirit) || text(project.description)}</p>
        <div className="declared-outcome">
          <strong>Current outcome</strong>
          <span>{text(project.current_outcome) || "Not declared"}</span>
        </div>
        <ProjectProgress project={project} />
      </section>
      <section className="project-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Where you are</p>
            <h2>Current state</h2>
          </div>
        </div>
        <div className="current-state-grid">
          <article className="panel">
            <p className="project-label">Current outcome</p>
            <strong>{text(project.current_outcome) || "Not declared"}</strong>
          </article>
          <article className="panel">
            <p className="project-label">Latest activity</p>
            <strong>
              {activity.length > 0
                ? relativeTime(activity[0]?.occurred_at)
                : "No activity yet"}
            </strong>
          </article>
          <article className="panel">
            <p className="project-label">Next review</p>
            <strong>{text(project.next_review) || "Not scheduled"}</strong>
          </article>
        </div>
      </section>

      <section className="project-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Overall project plan</p>
            <h2>Next steps</h2>
          </div>
        </div>
        {goals.length > 0 ? (
          <GoalsView goals={goals} />
        ) : (
          <Empty message="No project goals yet. Ask the agent to define the next concrete outcome." />
        )}
      </section>

      <section className="project-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GitHub</p>
            <h2>Open issues and pull requests</h2>
          </div>
          <span className="muted">{workItems.length} open</span>
        </div>
        <WorkItemsView items={workItems} />
      </section>

      <div className="columns project-context">
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

function WorkItemsView({ items }: { items: JsonRecord[] }) {
  if (items.length === 0) {
    return <Empty message="No open GitHub issues or pull requests." />;
  }

  return (
    <div className="work-items">
      {items.map((item) => (
        <a
          href={text(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="work-item"
          key={text(item.id)}
        >
          <span className="mode maintain">
            {text(item.kind) === "pull_request" ? "PR" : "Issue"} #
            {number(item.number)}
          </span>
          <strong>{text(item.title)}</strong>
          <span className="work-item-author">
            {text(item.author) || "GitHub"} ↗
          </span>
        </a>
      ))}
    </div>
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

function DeclarationView({
  markdown,
  source,
}: {
  markdown: string;
  source: string;
}) {
  if (!markdown) {
    return <Empty message="The declaration could not be loaded." />;
  }

  return (
    <article className="declaration">
      {renderDeclaration(markdown)}
      {source && (
        <footer>
          <a href={source} target="_blank" rel="noopener noreferrer">
            View canonical declaration on GitHub ↗
          </a>
        </footer>
      )}
    </article>
  );
}

function renderDeclaration(markdown: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${key++}`}>
        {listItems.map((item) => (
          <li key={item}>{cleanMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const sourceLine of markdown.split("\n")) {
    const line = sourceLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    if (line.startsWith("# ")) {
      nodes.push(
        <header className="declaration-header" key={`title-${key++}`}>
          <p className="eyebrow">The future we are building</p>
          <h2>{cleanMarkdown(line.slice(2))}</h2>
        </header>,
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h2 className="declaration-section" key={`section-${key++}`}>
          {cleanMarkdown(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      nodes.push(
        <h3 className="declaration-outcome" key={`outcome-${key++}`}>
          {cleanMarkdown(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("**") && line.endsWith("**")) {
      nodes.push(
        <p className="charter-statement" key={`statement-${key++}`}>
          {cleanMarkdown(line)}
        </p>,
      );
    } else {
      nodes.push(<p key={`paragraph-${key++}`}>{cleanMarkdown(line)}</p>);
    }
  }
  flushList();
  return nodes;
}

function cleanMarkdown(value: string): string {
  return value.replace(/\*\*/g, "").replace(/`/g, "");
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
