export type SeverityCode = "critical" | "high" | "moderate" | "low";
export type ExpectedBenefitCode = "high" | "moderate_high" | "moderate" | "low";
export type PriorityCategoryCode =
  | "physical_activity"
  | "weight_management"
  | "blood_pressure_follow_up"
  | "blood_sugar_prevention"
  | "nutrition"
  | "missing_evidence";

export interface HealthPriority {
  id: string;
  categoryCode: PriorityCategoryCode;
  severityCode: SeverityCode;
  expectedBenefitCode: ExpectedBenefitCode;
  titleCode: string;
  reasonCode: string;
  evidenceCodes: string[];
  titleParams?: Record<string, any>;
  reasonParams?: Record<string, any>;
  // Legacy string getters for backward compatibility
  title?: string;
  severity?: string;
  evidence?: string[];
  reason?: string;
  expectedBenefit?: string;
  category?: string;
}

export interface PriorityEngineInput {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  exercise?: string;
  workoutDaysPerWeek?: number;
  smoking?: string;
  alcohol?: string;
  familyHistory?: string;
  symptoms?: string;
  systolic?: number;
  diastolic?: number;
  labObservations?: Array<{ code: string; value: number; unit?: string }>;
  diabetesRiskScore?: number;
  diabetesRiskCategory?: "low" | "moderate" | "high";
  hypertensionRiskScore?: number;
  hypertensionRiskCategory?: "low" | "moderate" | "high";
  missingEvidence?: string[];
  [key: string]: any;
}

const severityWeight: Record<SeverityCode, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
};

const benefitWeight: Record<ExpectedBenefitCode, number> = {
  high: 4,
  moderate_high: 3,
  moderate: 2,
  low: 1,
};

const categoryWeight: Record<PriorityCategoryCode, number> = {
  blood_sugar_prevention: 6,
  blood_pressure_follow_up: 5,
  physical_activity: 4,
  weight_management: 3,
  nutrition: 2,
  missing_evidence: 1,
};

/**
 * Deterministic Priority Engine
 * Returns language-neutral stable domain codes for localization.
 */
export function generateHealthPriorities(input: PriorityEngineInput): HealthPriority[] {
  const priorities: HealthPriority[] = [];
  const p = input || {};

  let bmi = p.bmi;
  if (!bmi && typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0) {
    bmi = Number((p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1));
  }

  const labs = p.labObservations || [];
  const fastingGlucose = labs.find((l) => l.code === "fastingBloodSugar")?.value;
  const hba1c = labs.find((l) => l.code === "HbA1c")?.value;

  // 1. Physical Activity
  const isHighlyActive = p.exercise === "active" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek >= 5);
  const isSedentary = p.exercise === "none" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek === 0);
  const isLight = p.exercise === "light" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek > 0 && p.workoutDaysPerWeek < 3);

  if (!isHighlyActive && (isSedentary || isLight)) {
    const evidenceCodes: string[] = [];
    if (isSedentary) evidenceCodes.push("evidence.sedentaryLifestyle");
    else evidenceCodes.push("evidence.lightActivity");

    if (bmi && bmi >= 30) evidenceCodes.push("evidence.bmiObesity");
    else if (bmi && bmi >= 25) evidenceCodes.push("evidence.bmiOverweight");

    if (p.diabetesRiskCategory === "high" || p.diabetesRiskCategory === "moderate") {
      evidenceCodes.push(`evidence.diabetesRisk_${p.diabetesRiskCategory}`);
    }

    const isHighSev = isSedentary && ((bmi && bmi >= 25) || p.diabetesRiskCategory === "high" || p.hypertensionRiskCategory === "high");

    priorities.push({
      id: "increase-physical-activity",
      categoryCode: "physical_activity",
      severityCode: isHighSev ? "high" : isSedentary ? "moderate" : "low",
      expectedBenefitCode: isHighSev ? "high" : "moderate",
      titleCode: "priority.increasePhysicalActivity.title",
      reasonCode: isSedentary ? "priority.increasePhysicalActivity.reasonSedentary" : "priority.increasePhysicalActivity.reasonLight",
      evidenceCodes,
      title: "Increase physical activity",
      severity: isHighSev ? "high" : isSedentary ? "moderate" : "low",
      evidence: ["sedentary lifestyle"],
      reason: "Sedentary lifestyle is contributing to elevated metabolic and cardiovascular screening risks.",
      expectedBenefit: isHighSev ? "high" : "moderate",
      category: "lifestyle",
    });
  }

  // 2. Weight Management
  if (bmi && bmi >= 25) {
    const isObese = bmi >= 30;
    const evidenceCodes = [isObese ? "evidence.bmiObesity" : "evidence.bmiOverweight"];

    if (p.familyHistory && p.familyHistory.trim().length > 0) {
      evidenceCodes.push("evidence.familyHistoryMetabolic");
    }

    priorities.push({
      id: "weight-management",
      categoryCode: "weight_management",
      severityCode: isObese ? "high" : "moderate",
      expectedBenefitCode: isObese ? "high" : "moderate",
      titleCode: isObese ? "priority.weightManagement.titleObese" : "priority.weightManagement.titleOverweight",
      reasonCode: isObese ? "priority.weightManagement.reasonObese" : "priority.weightManagement.reasonOverweight",
      evidenceCodes,
      title: isObese ? "Optimize weight to reduce metabolic risk" : "Manage weight in healthy target range",
      severity: isObese ? "high" : "moderate",
      evidence: [`BMI ${bmi}${isObese ? " (Class I/II Obesity)" : " (Overweight)"}`],
      reason: "BMI in obesity range increases insulin resistance and systemic arterial pressure.",
      expectedBenefit: isObese ? "high" : "moderate",
      category: "lifestyle",
    });
  }

  // 3. Smoking Cessation
  if (p.smoking === "current") {
    priorities.push({
      id: "smoking-cessation",
      categoryCode: "nutrition",
      severityCode: "high",
      expectedBenefitCode: "high",
      titleCode: "priority.smokingCessation.title",
      reasonCode: "priority.smokingCessation.reason",
      evidenceCodes: ["evidence.currentSmoker"],
      title: "Complete tobacco cessation",
      severity: "high",
      evidence: ["current tobacco smoker"],
      reason: "Current tobacco use significantly increases vascular resistance, arterial stiffness, and cardiac event risk.",
      expectedBenefit: "high",
      category: "habit",
    });
  }

  // 4. Alcohol Moderation
  if (p.alcohol === "regular" || p.alcohol === "heavy") {
    priorities.push({
      id: "alcohol-moderation",
      categoryCode: "nutrition",
      severityCode: p.alcohol === "heavy" ? "high" : "moderate",
      expectedBenefitCode: p.alcohol === "heavy" ? "high" : "moderate",
      titleCode: "priority.alcoholModeration.title",
      reasonCode: "priority.alcoholModeration.reason",
      evidenceCodes: ["evidence.regularAlcohol"],
      title: "Moderate alcohol intake",
      severity: p.alcohol === "heavy" ? "high" : "moderate",
      evidence: ["regular alcohol consumption"],
      reason: "Regular alcohol consumption contributes to blood pressure elevation and hepatic metabolic strain.",
      expectedBenefit: p.alcohol === "heavy" ? "high" : "moderate",
      category: "habit",
    });
  }

  // 5. Blood Pressure Follow-up
  const hasElevatedBp = (typeof p.systolic === "number" && p.systolic >= 130) || (typeof p.diastolic === "number" && p.diastolic >= 85);
  const isHighHypRisk = p.hypertensionRiskCategory === "high" || (typeof p.systolic === "number" && p.systolic >= 140);
  const isModHypRisk = p.hypertensionRiskCategory === "moderate" || hasElevatedBp;

  if (isHighHypRisk || isModHypRisk) {
    const bpEv: string[] = [];
    if (p.systolic && p.diastolic) bpEv.push(`blood pressure ${p.systolic}/${p.diastolic} mmHg`);
    else bpEv.push("elevated blood pressure");
    if (p.hypertensionRiskCategory) bpEv.push(`${p.hypertensionRiskCategory} hypertension screening`);

    priorities.push({
      id: "hypertension-management",
      categoryCode: "blood_pressure_follow_up",
      severityCode: isHighHypRisk ? "high" : "moderate",
      expectedBenefitCode: "high",
      titleCode: "priority.hypertensionManagement.title",
      reasonCode: "priority.hypertensionManagement.reason",
      evidenceCodes: ["evidence.elevatedBloodPressure"],
      title: "Monitor and manage blood pressure",
      severity: isHighHypRisk ? "high" : "moderate",
      evidence: bpEv,
      reason: "Elevated blood pressure readings increase systemic vascular resistance and long-term cardiac strain.",
      expectedBenefit: "high",
      category: "screening",
    });
  }

  // 6. Glycemic Control (Blood Sugar Prevention)
  const hasElevatedGlucose = (fastingGlucose && fastingGlucose >= 100) || (hba1c && hba1c >= 5.7);
  const isHighDiabRisk = p.diabetesRiskCategory === "high" || (fastingGlucose && fastingGlucose >= 126) || (hba1c && hba1c >= 6.5);
  const isModDiabRisk = p.diabetesRiskCategory === "moderate" || hasElevatedGlucose;

  if (isHighDiabRisk || isModDiabRisk) {
    const diabEv: string[] = [];
    if (fastingGlucose) diabEv.push(`fasting glucose ${fastingGlucose} mg/dL`);
    if (hba1c) diabEv.push(`HbA1c ${hba1c}%`);
    if (p.diabetesRiskCategory) diabEv.push(`${p.diabetesRiskCategory} diabetes screening`);

    priorities.push({
      id: "glycemic-control",
      categoryCode: "blood_sugar_prevention",
      severityCode: isHighDiabRisk ? "high" : "moderate",
      expectedBenefitCode: "high",
      titleCode: "priority.glycemicControl.title",
      reasonCode: "priority.glycemicControl.reason",
      evidenceCodes: ["evidence.elevatedGlucose"],
      title: "Improve glycemic control and glucose screening",
      severity: isHighDiabRisk ? "high" : "moderate",
      evidence: diabEv.length > 0 ? diabEv : ["elevated glucose markers"],
      reason: "Elevated glucose markers indicate impaired glucose tolerance and elevated diabetes risk.",
      expectedBenefit: "high",
      category: "screening",
    });
  }

  // 7. Missing Evidence
  const missingItems = p.missingEvidence || [];
  const needsBp = !p.systolic && !p.diastolic;
  const needsLab = labs.length === 0;

  if (missingItems.length > 0 || needsBp || needsLab) {
    const missingEv: string[] = [];
    if (needsBp) missingEv.push("missing blood pressure reading");
    if (needsLab) missingEv.push("missing blood report data");

    priorities.push({
      id: "missing-evidence-completion",
      categoryCode: "missing_evidence",
      severityCode: needsBp && needsLab ? "high" : "moderate",
      expectedBenefitCode: "moderate",
      titleCode: "priority.missingEvidence.title",
      reasonCode: "priority.missingEvidence.reason",
      evidenceCodes: ["evidence.missingReading"],
      title: "Complete missing physiological evidence",
      severity: needsBp && needsLab ? "high" : "moderate",
      evidence: missingEv.length > 0 ? missingEv : ["missing blood pressure or lab readings"],
      reason: "Adding missing blood pressure readings and lab markers improves screening confidence.",
      expectedBenefit: "moderate",
      category: "prevention",
    });
  }

  // Sort priorities descending
  return priorities.sort((a, b) => {
    const catDiff = categoryWeight[b.categoryCode] - categoryWeight[a.categoryCode];
    if (catDiff !== 0) return catDiff;

    const sevDiff = severityWeight[b.severityCode] - severityWeight[a.severityCode];
    if (sevDiff !== 0) return sevDiff;

    const benDiff = benefitWeight[b.expectedBenefitCode] - benefitWeight[a.expectedBenefitCode];
    if (benDiff !== 0) return benDiff;

    return a.id.localeCompare(b.id);
  });
}
