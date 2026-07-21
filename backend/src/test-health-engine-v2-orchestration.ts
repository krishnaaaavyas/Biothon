import { strict as assert } from "node:assert";
import { adaptLegacyProfile } from "./modules/assessment/legacy-profile.adapter.js";
import { evaluateHealthContext } from "./modules/assessment/assessment-v2.service.js";
import { HEALTH_CONTEXT_SCHEMA_VERSION, HEALTH_MODULE_STATUSES, SCREENING_SIGNALS } from "./modules/shared/health-module.contracts.js";
import { diseaseModuleRegistry } from "./config/module-registry.js";

const profile = {
  age: 55, gender: "female" as const, heightCm: 165, weightKg: 70,
  smoking: "never" as const, exercise: "moderate" as const,
  familyHistory: "", symptoms: "", language: "en",
};

const context = adaptLegacyProfile(profile, "synthetic-user");
assert.equal(context.schemaVersion, HEALTH_CONTEXT_SCHEMA_VERSION);
assert.equal(context.assessment.knownHypertension, undefined);
assert.equal(context.assessment.takingAntihypertensiveMedication, undefined);
assert.equal(context.assessment.familyHistoryHypertension, undefined);
assert.equal(context.assessment.systolicBP, undefined);
assert.equal(context.assessment.diastolicBP, undefined);

assert.equal(diseaseModuleRegistry.hypertension.status, "available");
assert.ok(HEALTH_MODULE_STATUSES.includes("measurement-requires-verification"));
assert.ok(SCREENING_SIGNALS.includes("blood-pressure-measurement-recommended"));

let diabetesCalls = 0;
let hypertensionCalls = 0;
const evaluators = {
  diabetes: async () => {
    diabetesCalls++;
    return {
      moduleId: "diabetes-screening", resultType: "screening-signal" as const,
      status: "completed" as const, screeningSignal: "below-screening-threshold" as const,
      reasonCodes: [], missingInputs: [], recommendedActions: [], limitations: [], safetyFlags: [],
      screeningProbability: 0.123,
    } as any;
  },
  hypertension: async () => {
    hypertensionCalls++;
    return {
      moduleId: "hypertension-screening-awareness", resultType: "screening-awareness" as const,
      status: "insufficient-information" as const, screeningSignal: "not-evaluated" as const,
      reasonCodes: [], missingInputs: ["knownHypertension"], recommendedActions: [],
      limitations: [], safetyFlags: [], probability: 0.999,
    } as any;
  },
};

const screened = await evaluateHealthContext(context, evaluators);
assert.equal(screened.metadata.route, "profile-screening");
assert.equal(diabetesCalls, 1);
assert.equal(hypertensionCalls, 1);
assert.ok(!JSON.stringify(screened).includes("screeningProbability"));
assert.ok(!JSON.stringify(screened).includes('"probability"'));

const emergency = adaptLegacyProfile({ ...profile, systolicBP: 185 }, "synthetic-user");
const emergencyResult = await evaluateHealthContext(emergency, evaluators);
assert.equal(emergencyResult.metadata.route, "emergency-safety-override");
assert.equal(diabetesCalls, 1);
assert.equal(hypertensionCalls, 1);

const known = adaptLegacyProfile({ ...profile, knownHypertension: true }, "synthetic-user");
assert.equal((await evaluateHealthContext(known, evaluators)).metadata.route, "known-condition-management");
assert.equal(diabetesCalls, 1);
assert.equal(hypertensionCalls, 1);

const measurement = adaptLegacyProfile({ ...profile, systolicBP: 125 }, "synthetic-user");
assert.equal((await evaluateHealthContext(measurement, evaluators)).metadata.route, "measurement-evidence");
assert.equal(diabetesCalls, 1);
assert.equal(hypertensionCalls, 1);

console.log("HEALTH ENGINE V2 ORCHESTRATION TESTS: 16 Passed, 0 Failed");
