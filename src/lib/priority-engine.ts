export type SeverityLevel = "high" | "moderate" | "low";
export type BenefitLevel = "high" | "moderate" | "low";
export type PriorityCategory =
  | "lifestyle"
  | "screening"
  | "medical-verification"
  | "habit"
  | "prevention";

export interface HealthPriority {
  id: string;
  title: string;
  severity: SeverityLevel;
  evidence: string[];
  reason: string;
  expectedBenefit: BenefitLevel;
  category: PriorityCategory;
}

export interface PriorityEngineInput {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  exercise?: string; // "none" | "light" | "moderate" | "active"
  workoutDaysPerWeek?: number;
  smoking?: string; // "never" | "former" | "current"
  alcohol?: string; // "never" | "occasional" | "regular" | "heavy"
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

const severityWeight: Record<SeverityLevel, number> = {
  high: 3,
  moderate: 2,
  low: 1,
};

const benefitWeight: Record<BenefitLevel, number> = {
  high: 3,
  moderate: 2,
  low: 1,
};

const categoryWeight: Record<PriorityCategory, number> = {
  screening: 5,
  "medical-verification": 4,
  lifestyle: 3,
  habit: 2,
  prevention: 1,
};

/**
 * Deterministic Priority Engine
 * Converts clinical and physiological evidence into prioritized health actions.
 * Guarantees no impossible actions, no contradictory recommendations, and descending sort order.
 */
export function generateHealthPriorities(input: PriorityEngineInput): HealthPriority[] {
  const priorities: HealthPriority[] = [];
  const p = input || {};

  // Compute BMI if missing but height/weight supplied
  let bmi = p.bmi;
  if (!bmi && typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0) {
    bmi = Number((p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1));
  }

  const labs = p.labObservations || [];
  const fastingGlucose = labs.find((l) => l.code === "fastingBloodSugar")?.value;
  const hba1c = labs.find((l) => l.code === "HbA1c")?.value;
  const totalCholesterol = labs.find((l) => l.code === "totalCholesterol")?.value;
  const ldl = labs.find((l) => l.code === "ldl")?.value;

  // ─────────────────────────────────────────────────────────────
  // Rule 1: Physical Activity
  // Condition: Sedentary or light exercise
  // Impossible check: Already active (active / >= 5 workout days)
  // ─────────────────────────────────────────────────────────────
  const isHighlyActive = p.exercise === "active" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek >= 5);
  const isSedentary = p.exercise === "none" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek === 0);
  const isLight = p.exercise === "light" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek > 0 && p.workoutDaysPerWeek < 3);

  if (!isHighlyActive && (isSedentary || isLight)) {
    const evidenceList: string[] = [];
    if (isSedentary) evidenceList.push("sedentary lifestyle");
    else evidenceList.push("light physical activity level");

    if (bmi && bmi >= 30) evidenceList.push(`BMI ${bmi} (obesity)`);
    else if (bmi && bmi >= 25) evidenceList.push(`BMI ${bmi} (overweight)`);

    if (p.diabetesRiskCategory === "high" || p.diabetesRiskCategory === "moderate") {
      evidenceList.push(`${p.diabetesRiskCategory} diabetes screening`);
    }
    if (p.hypertensionRiskCategory === "high" || p.hypertensionRiskCategory === "moderate") {
      evidenceList.push(`${p.hypertensionRiskCategory} hypertension screening`);
    }

    const isHighSev = isSedentary && ((bmi && bmi >= 25) || p.diabetesRiskCategory === "high" || p.hypertensionRiskCategory === "high");

    priorities.push({
      id: "increase-physical-activity",
      title: "Increase physical activity",
      severity: isHighSev ? "high" : isSedentary ? "moderate" : "low",
      evidence: evidenceList,
      reason: isSedentary
        ? "Sedentary lifestyle is contributing to elevated metabolic and cardiovascular screening risks."
        : "Light activity level offers opportunity for further metabolic improvement.",
      expectedBenefit: isHighSev ? "high" : "moderate",
      category: "lifestyle",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 2: Weight Management (Obesity / Overweight)
  // Condition: BMI >= 25
  // Impossible check: BMI < 25 (Normal / Underweight)
  // ─────────────────────────────────────────────────────────────
  if (bmi && bmi >= 25) {
    const isObese = bmi >= 30;
    const evidenceList = [`BMI ${bmi} (${isObese ? "Class I/II Obesity" : "Overweight"})`];

    if (p.familyHistory && p.familyHistory.trim().length > 0) {
      evidenceList.push("family history of metabolic conditions");
    }
    if (fastingGlucose && fastingGlucose >= 100) {
      evidenceList.push(`fasting glucose ${fastingGlucose} mg/dL`);
    }

    priorities.push({
      id: "weight-management",
      title: isObese ? "Optimize weight to reduce metabolic risk" : "Manage weight in healthy target range",
      severity: isObese ? "high" : "moderate",
      evidence: evidenceList,
      reason: isObese
        ? "BMI in obesity range increases insulin resistance and systemic arterial pressure."
        : "Weight management supports metabolic health and cardiovascular prevention.",
      expectedBenefit: isObese ? "high" : "moderate",
      category: "lifestyle",
    });
  } else if (bmi && bmi >= 18.5 && bmi < 25) {
    priorities.push({
      id: "weight-maintenance",
      title: "Maintain healthy body weight",
      severity: "low",
      evidence: [`BMI ${bmi} (Normal weight range)`],
      reason: "BMI is within the healthy reference range. Maintain current energy balance and physical activity.",
      expectedBenefit: "moderate",
      category: "prevention",
    });
  }

  // Family History Prevention Priority
  if (p.familyHistory && typeof p.familyHistory === "string" && p.familyHistory.trim().length > 0) {
    priorities.push({
      id: "family-history-prevention",
      title: `Targeted prevention for family history of ${p.familyHistory}`,
      severity: "moderate",
      evidence: [`family history: ${p.familyHistory}`],
      reason: "Familial predisposition increases baseline risk for metabolic and cardiovascular conditions.",
      expectedBenefit: "high",
      category: "prevention",
    });
  }

  // Age 45+ Tailored Screening Priority
  if (p.age && p.age >= 45) {
    priorities.push({
      id: "age-tailored-screening",
      title: "Regular cardiovascular and metabolic screening for age 45+",
      severity: "moderate",
      evidence: [`age ${p.age} years`],
      reason: "Age over 45 increases clinical recommendation for periodic vascular and glycemic evaluation.",
      expectedBenefit: "high",
      category: "screening",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 3: Smoking Cessation
  // Condition: Current smoker
  // Impossible check: Non-smoker or former smoker
  // ─────────────────────────────────────────────────────────────
  if (p.smoking === "current") {
    const evidenceList = ["current tobacco smoker"];
    if (p.hypertensionRiskCategory === "high" || p.hypertensionRiskCategory === "moderate") {
      evidenceList.push(`${p.hypertensionRiskCategory} hypertension screening`);
    }

    priorities.push({
      id: "smoking-cessation",
      title: "Complete tobacco cessation",
      severity: "high",
      evidence: evidenceList,
      reason: "Current tobacco use significantly increases vascular resistance, arterial stiffness, and cardiac event risk.",
      expectedBenefit: "high",
      category: "habit",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 4: Alcohol Moderation
  // Condition: Regular or heavy alcohol consumption
  // Impossible check: Non-drinker ("never")
  // ─────────────────────────────────────────────────────────────
  if (p.alcohol === "regular" || p.alcohol === "heavy") {
    const evidenceList = [`${p.alcohol} alcohol consumption`];
    if (typeof p.systolic === "number" && p.systolic >= 130) {
      evidenceList.push(`systolic BP ${p.systolic} mmHg`);
    }

    priorities.push({
      id: "alcohol-moderation",
      title: "Moderate alcohol intake",
      severity: p.alcohol === "heavy" ? "high" : "moderate",
      evidence: evidenceList,
      reason: "Regular alcohol consumption contributes to blood pressure elevation and hepatic metabolic strain.",
      expectedBenefit: p.alcohol === "heavy" ? "high" : "moderate",
      category: "habit",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 5: Hypertension Management & BP Monitoring
  // Condition: High/Moderate BP risk or Systolic >= 130 or Diastolic >= 85
  // Impossible check: Optimal BP (<120/80) and low hypertension risk
  // ─────────────────────────────────────────────────────────────
  const hasElevatedBp = (typeof p.systolic === "number" && p.systolic >= 130) || (typeof p.diastolic === "number" && p.diastolic >= 85);
  const isHighHypRisk = p.hypertensionRiskCategory === "high" || (typeof p.systolic === "number" && p.systolic >= 140);
  const isModHypRisk = p.hypertensionRiskCategory === "moderate" || hasElevatedBp;

  if (isHighHypRisk || isModHypRisk) {
    const evidenceList: string[] = [];
    if (p.systolic && p.diastolic) evidenceList.push(`blood pressure ${p.systolic}/${p.diastolic} mmHg`);
    if (p.hypertensionRiskCategory) evidenceList.push(`${p.hypertensionRiskCategory} hypertension screening`);

    priorities.push({
      id: "hypertension-management",
      title: "Monitor and manage blood pressure",
      severity: isHighHypRisk ? "high" : "moderate",
      evidence: evidenceList,
      reason: "Elevated blood pressure readings increase systemic vascular resistance and long-term cardiac strain.",
      expectedBenefit: "high",
      category: "screening",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 6: Glycemic Control & Diabetes Risk Prevention
  // Condition: High/Moderate diabetes risk or Fasting Glucose >= 100 or HbA1c >= 5.7%
  // Impossible check: Low risk and normal glucose/HbA1c
  // ─────────────────────────────────────────────────────────────
  const hasElevatedGlucose = (fastingGlucose && fastingGlucose >= 100) || (hba1c && hba1c >= 5.7);
  const isHighDiabRisk = p.diabetesRiskCategory === "high" || (fastingGlucose && fastingGlucose >= 126) || (hba1c && hba1c >= 6.5);
  const isModDiabRisk = p.diabetesRiskCategory === "moderate" || hasElevatedGlucose;

  if (isHighDiabRisk || isModDiabRisk) {
    const evidenceList: string[] = [];
    if (fastingGlucose) evidenceList.push(`fasting glucose ${fastingGlucose} mg/dL`);
    if (hba1c) evidenceList.push(`HbA1c ${hba1c}%`);
    if (p.diabetesRiskCategory) evidenceList.push(`${p.diabetesRiskCategory} diabetes screening`);

    priorities.push({
      id: "glycemic-control",
      title: "Improve glycemic control and glucose screening",
      severity: isHighDiabRisk ? "high" : "moderate",
      evidence: evidenceList,
      reason: "Elevated glucose markers indicate impaired glucose tolerance and elevated diabetes risk.",
      expectedBenefit: "high",
      category: "screening",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 7: Symptom Evaluation
  // Condition: Symptoms reported
  // Impossible check: No symptoms reported
  // ─────────────────────────────────────────────────────────────
  if (p.symptoms && typeof p.symptoms === "string" && p.symptoms.trim().length > 0) {
    const sxLower = p.symptoms.toLowerCase();
    const isUrgent = sxLower.includes("chest pain") || sxLower.includes("dizz") || sxLower.includes("shortness of breath");

    priorities.push({
      id: "symptom-evaluation",
      title: "Evaluate reported symptoms with a clinician",
      severity: isUrgent ? "high" : "moderate",
      evidence: [`reported symptoms: ${p.symptoms}`],
      reason: "Reported symptoms warrant clinical review to evaluate underlying vascular or physiological triggers.",
      expectedBenefit: "high",
      category: "medical-verification",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Rule 8: Missing Evidence Completion
  // Condition: Missing BP or missing blood report or missing height/weight
  // Impossible check: Complete evidence profile
  // ─────────────────────────────────────────────────────────────
  const missingItems = p.missingEvidence || [];
  const needsBp = !p.systolic && !p.diastolic;
  const needsLab = labs.length === 0;

  if (missingItems.length > 0 || needsBp || needsLab) {
    const evidenceList: string[] = [];
    if (needsBp) evidenceList.push("missing blood pressure reading");
    if (needsLab) evidenceList.push("missing blood report data");
    missingItems.forEach((item) => {
      if (!evidenceList.includes(item)) evidenceList.push(item);
    });

    priorities.push({
      id: "missing-evidence-completion",
      title: "Complete missing physiological evidence",
      severity: needsBp && needsLab ? "high" : "moderate",
      evidence: evidenceList,
      reason: "Adding missing blood pressure readings and lab markers improves screening confidence.",
      expectedBenefit: "moderate",
      category: "prevention",
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Sort Priorities Descending
  // Severity (high > moderate > low) -> Benefit (high > moderate > low) -> Category -> ID string
  // ─────────────────────────────────────────────────────────────
  return priorities.sort((a, b) => {
    const sevDiff = severityWeight[b.severity] - severityWeight[a.severity];
    if (sevDiff !== 0) return sevDiff;

    const benDiff = benefitWeight[b.expectedBenefit] - benefitWeight[a.expectedBenefit];
    if (benDiff !== 0) return benDiff;

    const catDiff = categoryWeight[b.category] - categoryWeight[a.category];
    if (catDiff !== 0) return catDiff;

    return a.id.localeCompare(b.id);
  });
}
