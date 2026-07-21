import type { HealthContext } from "../../config/schemas-v2.js";
import { FastApiModuleResultSchema, type FastApiModuleResult } from "../shared/health-module.contracts.js";

export function unavailableResult(moduleId: string): FastApiModuleResult {
  return FastApiModuleResultSchema.parse({
    moduleId,
    moduleVersion: "unassigned",
    resultType: moduleId.startsWith("hypertension") ? "screening-awareness" : "screening-signal",
    status: "model-unavailable",
    screeningSignal: moduleId.startsWith("hypertension") ? "not-evaluated" : undefined,
    reasonCodes: ["MODEL_SERVICE_UNAVAILABLE"],
  });
}

export async function evaluateFastApiModule(
  endpoint: string,
  moduleId: string,
  context: HealthContext,
): Promise<FastApiModuleResult> {
  const controller = new AbortController();
  const configuredTimeout = Number.parseInt(process.env.HEALTH_MODULE_TIMEOUT_MS || "", 10);
  const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = process.env.FASTAPI_URL || "http://localhost:8000";
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("model service returned a non-success status");
    const parsed = FastApiModuleResultSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("invalid model-service response schema");
    return parsed.data;
  } catch {
    console.warn(`module=${moduleId} status=model-unavailable`);
    return unavailableResult(moduleId);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const evaluateDiabetes = (context: HealthContext) =>
  evaluateFastApiModule("/v1/modules/diabetes/evaluate", "diabetes-screening", context);
