import { z } from "zod";

const dnaAxisValueSchema = z.union([z.literal("left"), z.literal("right"), z.null()]);

export const dnaAxesSchema = z
  .object({
    logic_vs_emotion: dnaAxisValueSchema.optional(),
    break_vs_harmony: dnaAxisValueSchema.optional(),
    crowd_vs_solitude: dnaAxisValueSchema.optional(),
    speed_vs_density: dnaAxisValueSchema.optional(),
    utility_vs_philosophy: dnaAxisValueSchema.optional(),
    persona_keywords: z.array(z.string()).optional(),
    persona_summary: z.string().optional(),
  })
  .strict();

export const identityPayloadSchema = z.object({
  dnaAxes: dnaAxesSchema.optional(),
  myTaboo: z.record(z.string(), z.unknown()).optional(),
  currentProphecy: z.string().optional(),
  dnaCompleteness: z.number().int().min(0).max(100).optional(),
});

export type DnaAxesInput = z.infer<typeof dnaAxesSchema>;
