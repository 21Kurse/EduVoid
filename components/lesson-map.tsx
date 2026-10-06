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
