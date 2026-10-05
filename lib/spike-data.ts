/**
 * Probe datasets for the G1 spike, split out of scripts/spike.ts to keep
 * files small. The planted errors each contradict their cited passage
 * (wrong number, reversed relation, wrong substance).
 */
import { z } from "zod";
import { curriculumSpecSchema } from "./spec.ts";

export const SPEC_SYSTEM =
  "You produce tiny curriculum specs as JSON. Output ONLY JSON, no prose, no markdown fences. Keep it minimal: exactly 2 concepts, 1 edge, 1 source with 2 passages, 1 claim per concept citing existing passage IDs, and one explainer component per concept.";

export function specUserPrompt(topic: string): string {
  return [
    'Topic: "' + topic + '". Produce this exact JSON shape:',
    "{",
    '  "topic": string,',
    '  "level": "beginner" | "intermediate" | "advanced",',
    '  "concepts": [ { "id": string, "title": string, "summary": string, "claims": [ { "id": string, "text": string, "passageIds": string[], "sourceIds": string[], "status": "supported" } ], "components": [ { "type": "explainer", "markdown": string } ] } ],',
    '  "edges": [ { "from": conceptId, "to": conceptId } ],',
    '  "sources": [ { "id": string, "title": string, "url": string, "authority": "explainer", "passages": [ { "id": string, "label": string, "text": string } ] } ]',
    "}",
    "All IDs lowercase-kebab-case and globally unique. Every claim's passageIds must reference passages inside sources, and its sourceIds must reference that source.",
  ].join("\n");
}

// The probe prompt asks for the bare spec shape, so the schema must not wrap it.
export const specProbeSchema = curriculumSpecSchema;

export const VERIFIER_PASSAGES: { id: string; text: string }[] = [
  { id: "vp-1", text: "Water boils at 100 degrees Celsius at standard atmospheric pressure." },
  { id: "vp-2", text: "The speed of light in vacuum is about 299,792 kilometers per second." },
  { id: "vp-3", text: "Humans have 23 pairs of chromosomes, for 46 in total." },
  { id: "vp-4", text: "The chemical formula of table salt is NaCl." },
  { id: "vp-5", text: "Sound travels faster in water than in air." },
  { id: "vp-6", text: "The Earth orbits the Sun once approximately every 365.25 days." },
  { id: "vp-7", text: "DNA carries genetic information in living cells." },
  { id: "vp-8", text: "The freezing point of water at standard pressure is 0 degrees Celsius." },
  { id: "vp-9", text: "Iron rusts through a chemical reaction with oxygen." },
  { id: "vp-10", text: "A year on Mars is longer than a year on Earth." },
  { id: "vp-11", text: "Helium is the second lightest element in the periodic table." },
  { id: "vp-12", text: "Photosynthesis in plants consumes carbon dioxide and produces oxygen." },
];

export const PLANTED_ERRORS: { id: string; text: string; passageId: string }[] = [
  { id: "e1", text: "Water boils at 50 degrees Celsius at standard atmospheric pressure.", passageId: "vp-1" },
  { id: "e2", text: "The speed of light in vacuum is about 150,000 kilometers per second.", passageId: "vp-2" },
  { id: "e3", text: "Humans have 12 pairs of chromosomes, for 24 in total.", passageId: "vp-3" },
  { id: "e4", text: "The chemical formula of table salt is KCl.", passageId: "vp-4" },
  { id: "e5", text: "Sound travels slower in water than in air.", passageId: "vp-5" },
  { id: "e6", text: "The Earth orbits the Sun once approximately every 100 days.", passageId: "vp-6" },
  { id: "e7", text: "Proteins, not DNA, carry genetic information in living cells.", passageId: "vp-7" },
  { id: "e8", text: "The freezing point of water at standard pressure is 20 degrees Celsius.", passageId: "vp-8" },
  { id: "e9", text: "Iron rusts through a chemical reaction with nitrogen.", passageId: "vp-9" },
  { id: "e10", text: "A year on Mars is shorter than a year on Earth.", passageId: "vp-10" },
];

export const verdictSchema = z.object({
  verdicts: z
    .array(
      z.object({
        id: z.string(),
        supported: z.enum(["supported", "unsupported", "contradicted"]),
      }),
    )
    .min(1),
});

export const VERIFY_SYSTEM =
  'You are a strict fact verifier. You get passages and claims. For each claim, judge ONLY against the single passage it cites: is the claim supported by that passage, unsupported, or contradicted? Output ONLY JSON of shape {"verdicts":[{"id":string,"supported":"supported"|"unsupported"|"contradicted"}]}.';

export function verifyMessages() {
  const passageBlock = VERIFIER_PASSAGES.map((p) => "[" + p.id + "] " + p.text).join("\n");
  const claimBlock = PLANTED_ERRORS.map(
    (e) =>
      '{ "id": "' + e.id + '", "text": ' + JSON.stringify(e.text) + ', "citedPassage": "' + e.passageId + '" }',
  ).join(",\n");
  return [
    {
      role: "user" as const,
      content:
        "Passages:\n" + passageBlock + "\n\nClaims:\n[" + claimBlock + "]\n\nJudge each claim against its citedPassage only.",
    },
  ];
}
