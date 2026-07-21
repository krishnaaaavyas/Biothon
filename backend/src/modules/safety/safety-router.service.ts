import type { HealthContext } from "../../config/schemas-v2.js";

export type HealthRoute = "emergency-safety-override" | "known-condition-management" |
  "measurement-evidence" | "profile-screening" | "general-prevention";

export interface RoutingDecision {
  route: HealthRoute;
  reasonCodes: string[];
}

export function selectHealthRoute(context: HealthContext): RoutingDecision {
  const assessment = context.assessment;
  const symptoms = assessment.symptoms.toLowerCase();
  const emergency = assessment.urgentSymptoms === true
    || (assessment.systolicBP !== undefined && assessment.systolicBP >= 180)
    || (assessment.diastolicBP !== undefined && assessment.diastolicBP >= 120)
    || (assessment.fastingBloodSugar !== undefined
      && (assessment.fastingBloodSugar >= 250 || assessment.fastingBloodSugar <= 50))
    || symptoms.includes("chest pain")
    || symptoms.includes("shortness of breath");
  if (emergency) {
    return { route: "emergency-safety-override", reasonCodes: ["SAFETY_OVERRIDE"] };
  }
  if (assessment.knownHypertension === true
      || assessment.takingAntihypertensiveMedication === true) {
    return { route: "known-condition-management", reasonCodes: ["KNOWN_CONDITION_MANAGEMENT_CONTEXT"] };
  }
  if (assessment.systolicBP !== undefined || assessment.diastolicBP !== undefined
      || context.labObservations.length > 0) {
    return { route: "measurement-evidence", reasonCodes: ["MEASUREMENT_REQUIRES_VERIFICATION"] };
  }
  if (assessment.age && assessment.heightCm && assessment.weightKg) {
    return { route: "profile-screening", reasonCodes: ["PROFILE_SCREENING"] };
  }
  return { route: "general-prevention", reasonCodes: ["GENERAL_PREVENTION"] };
}
