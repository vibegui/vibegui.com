/**
 * Roadmap Page
 *
 * Public roadmap of projects with rich card-like panels.
 * Each project has: cover image, title, description, status, and action plan.
 * Ordered by priority with toggleable completed projects.
 *
 * Projects are loaded from the content database via manifest.json.
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { loadProjects, type Project, type ActionItem } from "../lib/manifest";

// Components
function StatusBadge({ status }: { status: Project["status"] }) {
  const styles: Record<
    Project["status"],
    { bg: string; text: string; label: string }
  > = {
    completed: { bg: "#10b98120", text: "#10b981", label: "Completed" },
    ongoing: { bg: "#f59e0b20", text: "#f59e0b", label: "In Progress" },
    future: { bg: "#6366f120", text: "#6366f1", label: "Planned" },
  };

  const style = styles[status];

  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function ActionPlanItem({ item, index }: { item: ActionItem; index: number }) {
  return (
    <div
      className="flex items-start gap-3 py-2"
      style={{
        borderBottom: "1px solid var(--color-border)",
        opacity: item.completed ? 0.6 : 1,
      }}
    >
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: item.completed
            ? "#10b98120"
            : "var(--color-bg-tertiary)",
          color: item.completed ? "#10b981" : "var(--color-fg-muted)",
        }}
      >
        {item.completed ? "✓" : index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm"
          style={{
            color: "var(--color-fg)",
            textDecoration: item.completed ? "line-through" : "none",
          }}
        >
          {item.task}
        </p>
        {item.dueDate && (
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Target: {item.dueDate}
          </p>
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggle,
}: { project: Project; expanded: boolean; onToggle: () => void }) {
  const isCompleted = project.status === "completed";
  const hasActionPlan = project.actionPlan && project.actionPlan.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border)",
        boxShadow: expanded
          ? "0 20px 40px -12px rgba(0,0,0,0.4)"
          : "0 4px 12px -4px rgba(0,0,0,0.2)",
        transform: expanded ? "scale(1.01)" : "scale(1)",
      }}
    >
      {/* Cover / Header */}
      <div
        className="h-32 relative flex items-end p-6"
        style={{
          background: project.coverImage
            ? `url(${project.coverImage}) center/cover`
            : project.coverGradient ||
              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4 w-full">
          {project.icon && (
            <span className="text-4xl drop-shadow-lg">{project.icon}</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold text-white">{project.title}</h3>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-white/80 mt-1">{project.tagline}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {project.description}
        </p>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  backgroundColor: "var(--color-bg-tertiary)",
                  color: "var(--color-fg-muted)",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Dates */}
        <div
          className="flex items-center gap-4 mt-4 text-xs"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {isCompleted && project.completedDate && (
            <span>✅ Completed {project.completedDate}</span>
          )}
          {!isCompleted && project.startDate && (
            <span>📅 Started {project.startDate}</span>
          )}
          {!isCompleted && project.targetDate && (
            <span>🎯 Target {project.targetDate}</span>
          )}
        </div>

        {/* Action Plan Toggle */}
        {hasActionPlan && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              color: "var(--color-fg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span>{expanded ? "Hide" : "Show"} Action Plan</span>
            <span
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.2s",
              }}
            >
              ▼
            </span>
          </button>
        )}

        {/* Action Plan */}
        {hasActionPlan && expanded && project.actionPlan && (
          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <h4
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--color-fg)" }}
            >
              Action Plan (
              {project.actionPlan.filter((a) => a.completed).length}/
              {project.actionPlan.length} done)
            </h4>
            <div className="space-y-1">
              {project.actionPlan.map((item, i) => (
                <ActionPlanItem key={item.id || i} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Link */}
        {project.url && (
          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            {project.url.startsWith("/") ? (
              <Link
                href={project.url}
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                <span>View Project →</span>
              </Link>
            ) : (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                <span>Visit Site ↗</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Roadmap() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => {
    loadProjects().then((p) => {
      setProjects(p);
      setLoading(false);
      // Auto-expand first ongoing project
      const firstOngoing = p.find((proj) => proj.status === "ongoing");
      if (firstOngoing) {
        setExpandedProject(firstOngoing.id);
      }
    });
  }, []);

  const ongoingProjects = projects.filter((p) => p.status === "ongoing");
  const futureProjects = projects.filter((p) => p.status === "future");
  const completedProjects = projects.filter((p) => p.status === "completed");

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <p style={{ color: "var(--color-fg-muted)" }}>Loading roadmap...</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/"
            className="text-sm transition-colors"
            style={{ color: "var(--color-fg-muted)" }}
          >
            ← Back
          </Link>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--color-fg)" }}>
          Roadmap
        </h1>
        <p className="mt-2" style={{ color: "var(--color-fg-muted)" }}>
          What I'm building, what's next, and what's done. One project at a
          time.
        </p>
      </div>

      {/* Philosophy Banner */}
      <div
        className="rounded-xl p-5 mb-8"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-start gap-4">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--color-fg)" }}>
              Focus Philosophy
            </h3>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-fg-muted)" }}
            >
              One project at a time. Ship before starting the next. Public
              accountability. Every ongoing project has a concrete action plan
              with deadlines.
            </p>
          </div>
        </div>
      </div>

      {/* Ongoing Projects */}
      {ongoingProjects.length > 0 && (
        <section className="mb-10">
          <h2
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-fg)" }}
          >
            <span>🚧</span>
            <span>Currently Building</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: "#f59e0b20", color: "#f59e0b" }}
            >
              {ongoingProjects.length}
            </span>
          </h2>
          <div className="space-y-6">
            {ongoingProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedProject === project.id}
                onToggle={() =>
                  setExpandedProject(
                    expandedProject === project.id ? null : project.id,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Future Projects */}
      {futureProjects.length > 0 && (
        <section className="mb-10">
          <h2
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--color-fg)" }}
          >
            <span>💡</span>
            <span>Up Next</span>
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: "#6366f120", color: "#6366f1" }}
            >
              {futureProjects.length}
            </span>
          </h2>
          <div className="space-y-6">
            {futureProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedProject === project.id}
                onToggle={() =>
                  setExpandedProject(
                    expandedProject === project.id ? null : project.id,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-3 px-4 rounded-lg mb-4 transition-colors"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span
                className="font-semibold"
                style={{ color: "var(--color-fg)" }}
              >
                Completed
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: "#10b98120", color: "#10b981" }}
              >
                {completedProjects.length}
              </span>
            </div>
            <span
              style={{
                color: "var(--color-fg-muted)",
                transform: showCompleted ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.2s",
              }}
            >
              ▼
            </span>
          </button>

          {showCompleted && (
            <div className="space-y-6">
              {completedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  expanded={expandedProject === project.id}
                  onToggle={() =>
                    setExpandedProject(
                      expandedProject === project.id ? null : project.id,
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p style={{ color: "var(--color-fg-muted)" }}>
            No projects yet. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}
