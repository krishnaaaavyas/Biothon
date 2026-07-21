import { HealthContextSchema, type HealthContext } from "../../config/schemas-v2.js";
import { HEALTH_CONTEXT_SCHEMA_VERSION } from "../shared/health-module.contracts.js";

type LegacyProfile = Record<string, unknown> & {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  smoking: "never" | "former" | "current";
  exercise: "none" | "light" | "moderate" | "active";
};

/** Adapt only explicit V1 evidence. Unknown clinical eligibility stays unknown. */
export function adaptLegacyProfile(profile: LegacyProfile, userId: string): HealthContext {
  const optional = (name: string) => Object.prototype.hasOwnProperty.call(profile, name)
    ? { [name]: profile[name] }
    : {};
  return HealthContextSchema.parse({
    userId,
    assessment: {
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      smoking: profile.smoking,
      exercise: profile.exercise,
      familyHistory: typeof profile.familyHistory === "string" ? profile.familyHistory : "",
      symptoms: typeof profile.symptoms === "string" ? profile.symptoms : "",
      alcohol: profile.alcohol ?? "never",
      sleepHours: typeof profile.sleepHours === "number" ? profile.sleepHours : 7,
      ...optional("knownHypertension"),
      ...optional("takingAntihypertensiveMedication"),
      ...optional("familyHistoryHypertension"),
      ...optional("physicalActivityCategory"),
      ...optional("systolicBP"),
      ...optional("diastolicBP"),
      ...optional("fastingBloodSugar"),
      ...optional("urgentSymptoms"),
      schemaVersion: HEALTH_CONTEXT_SCHEMA_VERSION,
    },
    labObservations: Array.isArray(profile.labObservations) ? profile.labObservations : [],
    regionalContext: {
      language: profile.language === "hi" || profile.language === "gu" ? profile.language : "en",
      preferredDietaryType: "vegetarian",
      stateOrRegionCode: "IN",
      customRegionalRules: [],
      schemaVersion: HEALTH_CONTEXT_SCHEMA_VERSION,
    },
    schemaVersion: HEALTH_CONTEXT_SCHEMA_VERSION,
  });
}
