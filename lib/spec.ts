import { z } from "zod";

/**
 * CurriculumSpec schemas (AGENTS.md §4), refined per amendment §13.4:
 * claims cite *passage* IDs, not just source IDs. Every ID in a spec is
 * globally unique, enforced at parse time so cross-references are sound.
 */

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const passageSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "passage id must be lowercase kebab-case"),
  /** Always "fixture" until the live pipeline supplies real ones (T4+). */
  label: z.string().min(1),
  text: z.string().min(1),
});

export const sourceSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "source id must be lowercase kebab-case"),
  title: z.string().min(1),
  url: z.string().min(1),
  /** Authority rank for source prioritization (§4 Source stage). */
  authority: z.enum(["paper", "university", "textbook", "explainer", "other"]),
  passages: z.array(passageSchema).min(1),
});

export const passageRefSchema = z.array(z.string().min(1)).min(1);

export const claimSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "claim id must be lowercase kebab-case"),
  text: z.string().min(1),
  /** Passage IDs, globally unique across the whole spec (§13.4). */
  passageIds: passageRefSchema,
  sourceIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["supported", "flagged"]),
  /** Set when a claim is flagged so the UI can explain why (§4 Verify). */
  flagReason: z.string().optional(),
});

export const mcqSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "question id must be lowercase kebab-case"),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  /** Index into options. */
  answer: z.number().int().nonnegative(),
  /** One-line explanation shown after answering. */
  explanation: z.string().min(1),
  /** Cited passage for the correct answer (§13.4). */
  passageIds: passageRefSchema,
});

export const simParamsSchema = z.object({
  /** Free-form parameter bag, interpreted by the hand-built sim template. */
  values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  unit: z.string().min(1).optional(),
  range: z.tuple([z.number(), z.number()]).optional(),
});

export const componentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("explainer"),
    markdown: z.string().min(1),
  }),
  z.object({
    type: z.literal("sim"),
    template: z.enum(["slider-curve", "two-state-prob", "double-slit", "vector-field"]),
    params: simParamsSchema,
    /** The user must commit to a prediction before the sim runs (§5.2). */
    predictPrompt: z.string().min(1),
  }),
  z.object({
    type: z.literal("hero-sim"),
    /** LLM-generated canvas/JS; sandboxed per §5.2. */
    code: z.string().min(1),
  }),
  z.object({
    type: z.literal("quiz"),
    questions: z.array(mcqSchema).min(1),
  }),
  z.object({
    type: z.literal("flashcards"),
    cards: z
      .array(z.object({ front: z.string().min(1), back: z.string().min(1) }))
      .min(1),
  }),
]);

export const conceptSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "concept id must be lowercase kebab-case"),
  title: z.string().min(1),
  summary: z.string().min(1),
  claims: z.array(claimSchema),
  // Skeletons (T5) arrive with empty components; generation (T6) fills them.
  components: z.array(componentSchema),
});

export const edgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const curriculumSpecShape = z.object({
  topic: z.string().min(1),
  level: z.enum(LEVELS),
  concepts: z.array(conceptSchema).min(1),
  edges: z.array(edgeSchema),
  // No min(1): live skeleton specs are parsed client-side before the
  // sources/claims events have been merged (fixture runs supply full
  // sources; live runs carry them as separate SSE events).
  sources: z.array(sourceSchema),
});

/**
 * Structure-only variant: identical to curriculumSpecSchema minus the global
 * uniqueness / cross-reference refinement. Use it for already-merged runtime
 * state, where the same verified claim may legitimately ground two concepts
 * (each concept keeps its own copy), which the planner-facing uniqueness rule
 * would reject. Pure planner output must still use curriculumSpecSchema.
 */
export const curriculumSpecLooseSchema = curriculumSpecShape;

export const curriculumSpecSchema = curriculumSpecShape
  .superRefine((spec, ctx) => {
    // ---- Global ID uniqueness --------------------------------------------
    const seen = new Set<string>();
    const dup = (kind: string, id: string) =>
      ctx.addIssue({
        code: "custom",
        message: `duplicate ${kind} id: "${id}"`,
      });
    for (const s of spec.sources) {
      if (seen.has(s.id)) dup("source", s.id);
      seen.add(s.id);
      for (const p of s.passages) {
        if (seen.has(p.id)) dup("passage", p.id);
        seen.add(p.id);
      }
    }
    for (const c of spec.concepts) {
      if (seen.has(c.id)) dup("concept", c.id);
      seen.add(c.id);
      for (const cl of c.claims) {
        if (seen.has(cl.id)) dup("claim", cl.id);
        seen.add(cl.id);
      }
      for (const comp of c.components) {
        if (comp.type === "quiz") {
          for (const q of comp.questions) {
            if (seen.has(q.id)) dup("question", q.id);
            seen.add(q.id);
          }
        }
      }
    }

    // ---- Cross-reference integrity ---------------------------------------
    const passageIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const s of spec.sources) {
      sourceIds.add(s.id);
      for (const p of s.passages) passageIds.add(p.id);
    }
    const conceptIds = new Set(spec.concepts.map((c) => c.id));
    for (const c of spec.concepts) {
      for (const cl of c.claims) {
        for (const pid of cl.passageIds) {
          if (!passageIds.has(pid)) {
            ctx.addIssue({
              code: "custom",
              message: `claim "${cl.id}" cites unknown passage "${pid}"`,
            });
          }
        }
        for (const sid of cl.sourceIds) {
          if (!sourceIds.has(sid)) {
            ctx.addIssue({
              code: "custom",
              message: `claim "${cl.id}" cites unknown source "${sid}"`,
            });
          }
        }
      }
      for (const comp of c.components) {
        if (comp.type === "quiz") {
          for (const q of comp.questions) {
            if (q.answer >= q.options.length) {
              ctx.addIssue({
                code: "custom",
                message: `question "${q.id}" answer index out of range`,
              });
            }
            for (const pid of q.passageIds) {
              if (!passageIds.has(pid)) {
                ctx.addIssue({
                  code: "custom",
                  message: `question "${q.id}" cites unknown passage "${pid}"`,
                });
              }
            }
          }
        }
      }
    }
    for (const e of spec.edges) {
      if (!conceptIds.has(e.from) || !conceptIds.has(e.to)) {
        ctx.addIssue({
          code: "custom",
          message: `edge ${e.from}->${e.to} references unknown concept`,
        });
      }
      if (e.from === e.to) {
        ctx.addIssue({
          code: "custom",
          message: `edge ${e.from}->${e.to} is a self-loop`,
        });
      }
    }
  });

export type Passage = z.infer<typeof passageSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Claim = z.infer<typeof claimSchema>;
export type Mcq = z.infer<typeof mcqSchema>;
export type SimParams = z.infer<typeof simParamsSchema>;
export type Component = z.infer<typeof componentSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type CurriculumSpec = z.infer<typeof curriculumSpecSchema>;
export type Level = (typeof LEVELS)[number];
