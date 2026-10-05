"use client";

/**
 * Mastery mindmap (AGENTS.md §5.1 — the centerpiece).
 * React Flow with a computed layered layout: prerequisite edges flow
 * downward, mastery color per node. No external layout lib needed.
 */

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CurriculumSpec } from "@/lib/spec";
import { masteryLevel, MASTERY_COLORS, MASTERY_STROKE } from "@/lib/mastery";
import type { LearningState } from "@/lib/store";

export const NODE_W = 208;
const NODE_H = 64;
const LEVEL_GAP = 92;
const SIBLING_GAP = 24;

type ConceptNodeData = {
  title: string;
  level: ReturnType<typeof masteryLevel>;
  selected: boolean;
};

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const fill = MASTERY_COLORS[data.level];
  const stroke = data.selected
    ? "var(--accent)"
    : MASTERY_STROKE[data.level];
  return (
    <div
      className="flex h-16 w-52 items-center justify-center rounded-xl px-3 text-center text-[13px] leading-snug shadow-sm transition-shadow"
      style={{
        background: fill,
        border: `1.5px solid ${stroke}`,
        boxShadow: data.selected ? "0 0 0 3px rgba(124,58,237,0.18)" : undefined,
      }}
    >
      <span className="line-clamp-2 text-zinc-800">{data.title}</span>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

export function Mindmap({
  spec,
  learning,
  onSelect,
}: {
  spec: CurriculumSpec;
  learning: LearningState;
  onSelect: (conceptId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    // Layer = longest path from a root (simple layered layout).
    const prereqOf = new Map<string, string[]>();
    for (const e of spec.edges) {
      prereqOf.set(e.to, [...(prereqOf.get(e.to) ?? []), e.from]);
    }
    const layerOf = new Map<string, number>();
    const depth = (id: string): number => {
      if (layerOf.has(id)) return layerOf.get(id) as number;
      const ps = prereqOf.get(id) ?? [];
      const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(depth));
      layerOf.set(id, d);
      return d;
    };
    spec.concepts.forEach((c) => depth(c.id));

    const byLayer = new Map<number, string[]>();
    for (const c of spec.concepts) {
      const l = layerOf.get(c.id) ?? 0;
      byLayer.set(l, [...(byLayer.get(l) ?? []), c.id]);
    }

    const nodes: Node<ConceptNodeData>[] = [];
    for (const [layer, ids] of [...byLayer.entries()].sort()) {
      const rowWidth = ids.length * NODE_W + (ids.length - 1) * SIBLING_GAP;
      ids.forEach((id, i) => {
        const concept = spec.concepts.find((c) => c.id === id);
        if (!concept) return;
        nodes.push({
          id,
          type: "concept",
          position: {
            x: -rowWidth / 2 + i * (NODE_W + SIBLING_GAP),
            y: layer * (NODE_H + LEVEL_GAP),
          },
          data: {
            title: concept.title,
            level: masteryLevel(learning.concepts[id]),
            selected: learning.selectedConceptId === id,
          },
        });
      });
    }

    const edges: Edge[] = spec.edges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      animated: false,
      style: { stroke: "#d4d4d8", strokeWidth: 1.5 },
    }));

    return { nodes, edges };
  }, [spec, learning]);

  return (
    <div className="h-full w-full" data-testid="mindmap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect("")}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#e4e4e7" />
        <Controls showInteractive={false} className="!shadow-none" />
      </ReactFlow>
    </div>
  );
}
