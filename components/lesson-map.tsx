"use client";

/**
 * Left lesson column (G3 F1 restructure): the mastery mindmap with its
 * loading state, plus the agent-activity panel overlay. Extracted from
 * live-lesson to keep both files small.
 */
import type { CurriculumSpec } from "@/lib/spec";
import type { LearningState } from "@/lib/store";
import { ActivityPanel, type ActivityFeed } from "./activity-panel";
import { Mindmap } from "./mindmap";

/**
 * Full-width lesson header: topic + status badge (kept here for size).
 * `cached` must be set whenever the cached demo run is on screen, so the
 * badge never claims live generation (§7, §15.3).
 */
export function LessonHeader({ topic, done, cached = false }: { topic: string; done: boolean; cached?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 text-[12px]">
      <span className="font-medium text-zinc-700">{topic}</span>
      <span
        className={`rounded-full px-2 py-0.5 ${cached ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
        data-testid={cached ? "cached-badge" : "live-badge"}
      >
        {cached ? "cached run · ready" : `live generation${done ? " · ready" : " · running"}`}
      </span>
    </div>
  );
}

export function LessonMap({
  spec,
  stage,
  learning,
  onSelect,
  feed,
}: {
  spec: CurriculumSpec | null;
  stage: string;
  learning: LearningState;
  onSelect: (conceptId: string | null) => void;
  feed: ActivityFeed;
}) {
  return (
    <div className="relative h-[46vh] border-b border-border-subtle lg:h-auto lg:flex-1 lg:border-b-0">
      {spec ? (
        <Mindmap spec={spec} learning={learning} onSelect={onSelect} />
      ) : (
        <div className="flex h-full items-center justify-center text-[13px] text-zinc-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-500" />
            {stage}…
          </span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 right-3 lg:right-auto">
        <ActivityPanel feed={feed} />
      </div>
    </div>
  );
}
