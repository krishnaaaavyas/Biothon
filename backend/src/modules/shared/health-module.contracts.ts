import { z } from "zod";

export const HEALTH_CONTEXT_SCHEMA_VERSION = "2.0.0" as const;

export const HEALTH_MODULE_STATUSES = [
  "completed",
  "model-unavailable",
  "outside-intended-population",
  "insufficient-information",
  "measurement-requires-verification",
  "conflicting-evidence",
  "failed",
  "insufficient-data",
  "unavailable",
] as const;

export const SCREENING_SIGNALS = [
  "elevated-screening-signal",
  "below-screening-threshold",
  "blood-pressure-measurement-recommended",
  "no-profile-screening-prompt",
  "not-evaluated",
] as const;

export const SAFETY_FLAG_TYPES = ["red-flag", "contraindication", "data-anomaly"] as const;

export type HealthModuleStatus = (typeof HEALTH_MODULE_STATUSES)[number];
export type ScreeningSignal = (typeof SCREENING_SIGNALS)[number];

export const FastApiModuleResultSchema = z.object({
  moduleId: z.string(),
  moduleVersion: z.string().optional(),
  modelVersion: z.string().optional(),
  resultType: z.enum([
    "screening-signal", "measured-status", "lab-pattern", "screening-awareness",
    "context-only", "risk-score", "risk-tier", "screening-eligibility", "referral-priority",
  ]),
  status: z.enum(HEALTH_MODULE_STATUSES),
  screeningSignal: z.enum(SCREENING_SIGNALS).optional(),
  reasonCodes: z.array(z.string()).default([]),
  missingInputs: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  safetyFlags: z.array(z.object({
    flagType: z.enum(SAFETY_FLAG_TYPES),
    moduleId: z.string(),
    message: z.string(),
    clinicalActionRequired: z.boolean().default(false),
  })).default([]),
}).passthrough();

export type FastApiModuleResult = z.infer<typeof FastApiModuleResultSchema>;

export interface SafeRoutingMetadata {
  route: "emergency-safety-override" | "known-condition-management" |
    "measurement-evidence" | "profile-screening" | "general-prevention";
  status: HealthModuleStatus | "completed";
  moduleStatuses: Array<{ moduleId: string; status: HealthModuleStatus }>;
}
