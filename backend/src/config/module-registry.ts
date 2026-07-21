import type { HealthContext, HealthModuleResult, TestRecommendation } from "./schemas-v2.js";
import { evaluateDiabetes } from "../modules/diabetes/diabetes-client.js";
import { evaluateHypertension } from "../modules/hypertension/hypertension-client.js";

export interface HealthModule {
  moduleId: string;
  version: string;
  status: "available" | "disabled" | "unavailable";
  requiredInputs: string[];
  optionalInputs: string[];
  supportedLabCodes: string[];
  isEligible(context: HealthContext): boolean;
  evaluate(context: HealthContext): Promise<HealthModuleResult>;
  explain(result: HealthModuleResult): string;
  recommendTests(context: HealthContext): TestRecommendation[];
}

function registeredFastApiModule(
  moduleId: string,
  evaluate: (context: HealthContext) => Promise<unknown>,
  requiredInputs: string[],
  optionalInputs: string[] = [],
  supportedLabCodes: string[] = [],
): HealthModule {
  return {
    moduleId,
    version: "2.0.0",
    status: "available",
    requiredInputs,
    optionalInputs,
    supportedLabCodes,
    isEligible: (context) => Boolean(context.assessment?.age && context.assessment?.gender),
    evaluate: async (context) => evaluate(context) as Promise<HealthModuleResult>,
    explain: (result) => `${moduleId} evaluation status: ${result.status}`,
    recommendTests: () => [],
  };
}

export const diseaseModuleRegistry: Record<string, HealthModule> = {
  diabetes: registeredFastApiModule(
    "diabetes", evaluateDiabetes, ["age", "gender"],
    ["heightCm", "weightKg", "fastingBloodSugar"], ["HbA1c"],
  ),
  hypertension: registeredFastApiModule(
    "hypertension", evaluateHypertension, ["age", "gender", "knownHypertension"],
    ["heightCm", "weightKg", "familyHistoryHypertension", "physicalActivityCategory"], [],
  ),
  cardiovascular: createPlaceholderModule(
    "cardiovascular", ["age", "gender", "systolicBP", "fastingBloodSugar"],
    ["smoking"], ["totalCholesterol", "hdlCholesterol", "ldlCholesterol", "triglycerides"],
  ),
  kidney: createPlaceholderModule("kidney", ["age", "gender"]),
  anaemia: createPlaceholderModule("anaemia", ["age", "gender"]),
  thyroid: createPlaceholderModule("thyroid", ["age", "gender"], [], ["thyroidTSH"]),
};

function createPlaceholderModule(
  moduleId: string,
  requiredInputs: string[] = ["age", "gender"],
  optionalInputs: string[] = [],
  supportedLabCodes: string[] = [],
): HealthModule {
  return {
    moduleId,
    version: "2.0.0",
    status: "unavailable",
    requiredInputs,
    optionalInputs,
    supportedLabCodes,
    isEligible: (context) => Boolean(context.assessment?.age && context.assessment?.gender),
    evaluate: async (context) => ({
      moduleId,
      moduleVersion: "2.0.0",
      resultType: moduleId === "cardiovascular" ? "risk-score" : "risk-tier",
      status: "unavailable",
      evidenceCompleteness: 0,
      confidenceLevel: "insufficient",
      topContributors: [],
      protectiveFactors: [],
      missingInputs: requiredInputs.filter((input) => !(input in context.assessment)),
      recommendedActions: [],
      recommendedTests: [],
      safetyFlags: [],
    }),
    explain: () => `Module ${moduleId} is currently unavailable.`,
    recommendTests: () => [],
  };
}

export default diseaseModuleRegistry;
