import type { HealthContext } from "../../config/schemas-v2.js";
import { evaluateDiabetes } from "../diabetes/diabetes-client.js";
import { evaluateHypertension } from "../hypertension/hypertension-client.js";
import { selectHealthRoute } from "../safety/safety-router.service.js";
import type { FastApiModuleResult, SafeRoutingMetadata } from "../shared/health-module.contracts.js";

export interface ModuleEvaluators {
  diabetes: (context: HealthContext) => Promise<FastApiModuleResult>;
  hypertension: (context: HealthContext) => Promise<FastApiModuleResult>;
}

const defaultEvaluators: ModuleEvaluators = {
  diabetes: evaluateDiabetes,
  hypertension: evaluateHypertension,
};

function safeResult(result: FastApiModuleResult): FastApiModuleResult {
  const {
    screeningProbability: _probability,
    probability: _probabilityAlias,
    score: _score,
    riskTier: _riskTier,
    ...safe
  } = result as FastApiModuleResult & Record<string, unknown>;
  return safe as FastApiModuleResult;
}

export async function evaluateHealthContext(
  context: HealthContext,
  evaluators: ModuleEvaluators = defaultEvaluators,
): Promise<{ metadata: SafeRoutingMetadata; moduleResults: FastApiModuleResult[] }> {
  const decision = selectHealthRoute(context);
  if (decision.route === "emergency-safety-override") {
    return { metadata: { route: decision.route, status: "completed", moduleStatuses: [] }, moduleResults: [] };
  }
  if (decision.route === "known-condition-management"
      || decision.route === "measurement-evidence"
      || decision.route === "general-prevention") {
    return { metadata: { route: decision.route, status: "completed", moduleStatuses: [] }, moduleResults: [] };
  }

  const results = (await Promise.all([
    evaluators.diabetes(context),
    evaluators.hypertension(context),
  ])).map(safeResult);
  const unavailable = results.every((result) => result.status === "model-unavailable");
  return {
    metadata: {
      route: decision.route,
      status: unavailable ? "model-unavailable" : "completed",
      moduleStatuses: results.map((result) => ({ moduleId: result.moduleId, status: result.status })),
    },
    moduleResults: results,
  };
}
