"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  confidence: number;
  aiSummary: string | null;
  externalPeople: string[];
  taskCount: number;
  deadlineCount: number;
  itemCount: number;
  overdueCount: number;
}

interface ProjectDetail extends ProjectSummary {
  tasks: { id: string; title: string; status: string; dueDate: string | null }[];
  deadlines: { id: string; title: string; status: string; dueDate: string }[];
  productions: { id: string; title: string; clientName: string | null }[];
  suggestions: string[];
}

const PERSON_COLORS = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ItemRow({ title, done, meta }: { title: string; done?: boolean; meta?: string | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0 text-gray-300" />
      )}
      <span className={`flex-1 ${done ? "text-gray-400 line-through" : "text-gray-700"}`}>{title}</span>
      {meta && <span className="shrink-0 font-mono text-[10px] text-gray-400">{meta}</span>}
    </div>
  );
}

function ProjectCard({
  project: p,
  expanded,
  detail,
  detailLoading,
  onToggle,
}: {
  project: ProjectSummary;
  expanded: boolean;
  detail: ProjectDetail | null;
  detailLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-purple-50/40 transition-colors ${
        expanded ? "border-purple-300" : "border-purple-100 hover:border-purple-200"
      }`}
    >
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-purple-500"
              style={{ opacity: 0.3 + p.confidence * 0.7 }}
              title="AI confidence"
            />
            <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.brand && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
              {p.brand}
            </span>
          )}
          <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">
            {p.taskCount} task{p.taskCount === 1 ? "" : "s"} · {p.deadlineCount} deadline
            {p.deadlineCount === 1 ? "" : "s"}
          </span>
          {p.overdueCount > 0 && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
              {p.overdueCount} overdue
            </span>
          )}
          <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] capitalize text-gray-400">
            {p.status.toLowerCase()}
          </span>
        </div>

        {p.aiSummary && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">{p.aiSummary}</p>
        )}

        {p.externalPeople.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {p.externalPeople.slice(0, 4).map((name, i) => (
              <span
                key={name}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PERSON_COLORS[i % PERSON_COLORS.length]}`}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-purple-100 px-4 py-3">
          {detailLoading || !detail ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading project...
            </div>
          ) : (
            <div className="space-y-3">
              {detail.tasks.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Tasks
                  </p>
                  <div className="space-y-1">
                    {detail.tasks.map((t) => (
                      <ItemRow
                        key={t.id}
                        title={t.title}
                        done={t.status === "DONE"}
                        meta={t.dueDate ? fmtDate(t.dueDate) : null}
                      />
                    ))}
                  </div>
                </div>
              )}
              {detail.deadlines.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Deadlines
                  </p>
                  <div className="space-y-1">
                    {detail.deadlines.map((d) => (
                      <ItemRow
                        key={d.id}
                        title={d.title}
                        done={d.status === "COMPLETED"}
                        meta={fmtDate(d.dueDate)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {detail.productions.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Productions
                  </p>
                  <div className="space-y-1">
                    {detail.productions.map((pr) => (
                      <ItemRow key={pr.id} title={pr.title} meta={pr.clientName} />
                    ))}
                  </div>
                </div>
              )}
              {detail.suggestions.length > 0 && (
                <div className="rounded-lg bg-purple-50 p-2.5">
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-purple-500">
                    <Sparkles className="h-3 w-3" /> Suggested next actions
                  </p>
                  <ul className="space-y-1">
                    {detail.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-purple-400" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SmartProjectsSection() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence/projects");
      if (res.ok) setProjects(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/intelligence/analyze", { method: "POST" });
      await loadProjects();
    } catch {
      // silent
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/intelligence/projects/${id}?suggest=1`);
      if (res.ok) setDetail(await res.json());
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <section className="card-apple p-6 mb-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <h2 className="text-base font-bold text-gray-900">Projects</h2>
            {!loading && projects.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                {projects.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            AI-grouped tasks, deadlines and threads that belong together.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={analyzing}
          className="flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#C49843] disabled:opacity-60"
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {analyzing ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <Brain className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Your AI assistant will group related tasks into projects automatically
          </p>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="mt-3 text-xs font-medium text-[#D4A853] hover:underline disabled:opacity-50"
          >
            Run analysis now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              expanded={expandedId === p.id}
              detail={expandedId === p.id ? detail : null}
              detailLoading={expandedId === p.id && detailLoading}
              onToggle={() => toggleExpand(p.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
