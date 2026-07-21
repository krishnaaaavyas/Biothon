import type { HealthContext } from "../../config/schemas-v2.js";
import { adaptLegacyProfile } from "./legacy-profile.adapter.js";
import { evaluateHealthContext, type ModuleEvaluators } from "./assessment-v2.service.js";

export type ShadowHeaderStatus = "evaluated" | "unavailable" | "disabled";

export async function evaluateLegacyShadow(
  profile: Record<string, unknown>,
  userId: string,
  evaluators?: ModuleEvaluators,
): Promise<ShadowHeaderStatus> {
  if ((process.env.HEALTH_ENGINE_V2_SHADOW_ENABLED || "false").toLowerCase() !== "true") {
    return "disabled";
  }
  try {
    const context: HealthContext = adaptLegacyProfile(profile as never, userId);
    const result = await evaluateHealthContext(context, evaluators);
    console.info(
      `health-engine-v2-shadow route=${result.metadata.route} status=${result.metadata.status}`,
    );
    return result.metadata.status === "model-unavailable" ? "unavailable" : "evaluated";
  } catch {
    console.warn("health-engine-v2-shadow status=unavailable");
    return "unavailable";
  }
}
