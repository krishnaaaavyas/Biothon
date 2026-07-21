export type TimelineCode = "today" | "this_week" | "this_month" | "long_term";
export type RecommendationTimeline = "Today" | "This Week" | "This Month";

export interface ExplainedRecommendation {
  id: string;
  actionCode: string;
  whyCode: string;
  evidenceCodes: string[];
  expectedBenefitCode: string;
  timelineCode: TimelineCode;
  actionParams?: Record<string, any>;
  whyParams?: Record<string, any>;
  benefitParams?: Record<string, any>;
  // Legacy string properties for backward compatibility
  action: string;
  why: string;
  evidence: string[];
  expectedBenefit: string;
  timeline: RecommendationTimeline;
}

export interface ExplanationEngineInput {
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
  fastingBloodSugar?: number;
  hba1c?: number;
  totalCholesterol?: number;
  ldl?: number;
  diabetesRiskCategory?: "low" | "moderate" | "high";
  hypertensionRiskCategory?: "low" | "moderate" | "high";
  missingEvidence?: string[];
  [key: string]: any;
}

const TIMELINE_WEIGHT: Record<TimelineCode, number> = {
  today: 4,
  this_week: 3,
  this_month: 2,
  long_term: 1,
};

export function generateExplainedRecommendations(input: ExplanationEngineInput): ExplainedRecommendation[] {
  const candidates: ExplainedRecommendation[] = [];
  const p = input || {};

  let bmi = p.bmi;
  if (!bmi && typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0) {
    bmi = Number((p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1));
  }

  const labs = p.labObservations || [];
  const fastingGlucose = p.fastingBloodSugar ?? labs.find((l) => l.code === "fastingBloodSugar")?.value;
  const hba1cVal = p.hba1c ?? labs.find((l) => l.code === "HbA1c")?.value;
  const isDiabeticRisk =
    p.diabetesRiskCategory === "high" ||
    p.diabetesRiskCategory === "moderate" ||
    (typeof fastingGlucose === "number" && fastingGlucose >= 100) ||
    (typeof hba1cVal === "number" && hba1cVal >= 5.7);

  const isHypertensiveRisk =
    p.hypertensionRiskCategory === "high" ||
    p.hypertensionRiskCategory === "moderate" ||
    (typeof p.systolic === "number" && p.systolic >= 130) ||
    (typeof p.diastolic === "number" && p.diastolic >= 85);

  const isSedentary = p.exercise === "none" || p.workoutDaysPerWeek === 0;

  // 1. Walk 20 minutes
  if (isSedentary || p.exercise === "light") {
    const evidenceCodes = [isSedentary ? "evidence.sedentaryLifestyle" : "evidence.lightActivity"];
    if (isDiabeticRisk) evidenceCodes.push("evidence.diabetesRisk");

    candidates.push({
      id: "walk-20-min",
      actionCode: "recommendations.action.walk20Min",
      whyCode: "recommendations.why.lowActivity",
      evidenceCodes,
      expectedBenefitCode: isDiabeticRisk ? "recommendations.benefit.improvesDiabetesScreening" : "recommendations.benefit.cardioEndurance",
      timelineCode: "today",
      action: "Walk 20 minutes",
      why: "Low physical activity.",
      evidence: ["Sedentary lifestyle."],
      expectedBenefit: isDiabeticRisk ? "Improves diabetes screening." : "Establishes baseline cardiovascular fitness.",
      timeline: "Today",
    });
  }

  // 2. Reduce salt
  if (isHypertensiveRisk) {
    const evidenceCodes: string[] = ["evidence.bloodPressureEvidence"];
    if (p.hypertensionRiskCategory) evidenceCodes.push(`evidence.hypertensionRisk_${p.hypertensionRiskCategory}`);

    const bpString = typeof p.systolic === "number" && typeof p.diastolic === "number"
      ? `Blood pressure ${p.systolic}/${p.diastolic} mmHg evidence.`
      : "Blood pressure evidence.";

    candidates.push({
      id: "reduce-salt",
      actionCode: "recommendations.action.reduceSalt",
      whyCode: "recommendations.why.elevatedHypertensionScreening",
      evidenceCodes,
      expectedBenefitCode: "recommendations.benefit.supportsBloodPressureManagement",
      timelineCode: "this_week",
      action: "Reduce salt",
      why: "Elevated hypertension screening.",
      evidence: [bpString],
      expectedBenefit: "Supports blood pressure management.",
      timeline: "This Week",
    });
  }

  // 3. Low Glycemic Meals
  if (isDiabeticRisk) {
    candidates.push({
      id: "low-glycemic-meals",
      actionCode: "recommendations.action.lowGlycemicMeals",
      whyCode: "recommendations.why.elevatedDiabetesScreening",
      evidenceCodes: ["evidence.glucoseMarkers"],
      expectedBenefitCode: "recommendations.benefit.moderatesGlucoseSpikes",
      timelineCode: "today",
      action: "Switch to low-glycemic fiber meals",
      why: "Elevated diabetes risk or glucose screening markers.",
      evidence: ["Fasting glucose markers."],
      expectedBenefit: "Moderates glucose spikes and enhances insulin sensitivity.",
      timeline: "Today",
    });
  }

  // 4. Tobacco Cessation
  if (p.smoking === "current") {
    candidates.push({
      id: "stop-smoking",
      actionCode: "recommendations.action.stopSmoking",
      whyCode: "recommendations.why.tobaccoUse",
      evidenceCodes: ["evidence.currentSmokerStatus"],
      expectedBenefitCode: "recommendations.benefit.reducesCardioRisk",
      timelineCode: "today",
      action: "Stop tobacco smoking",
      why: "Current tobacco use elevates vascular and cardiac risk.",
      evidence: ["Current smoker status."],
      expectedBenefit: "Reduces arterial stiffness and cardiac event risk.",
      timeline: "Today",
    });
  }

  // 5. Caloric Deficit
  if (bmi && bmi >= 25) {
    candidates.push({
      id: "calorie-deficit",
      actionCode: "recommendations.action.calorieDeficit",
      whyCode: "recommendations.why.overweightBmi",
      evidenceCodes: ["evidence.bmiOverweight"],
      expectedBenefitCode: "recommendations.benefit.reducesArterialStrain",
      timelineCode: "this_month",
      action: "Follow a structured caloric deficit",
      why: "BMI in overweight or obesity range.",
      evidence: ["BMI evidence."],
      expectedBenefit: "Reduces systemic arterial strain and insulin resistance.",
      timeline: "This Month",
    });
  }

  // 6. Alcohol Moderation
  if (p.alcohol === "regular" || p.alcohol === "heavy") {
    candidates.push({
      id: "moderate-alcohol",
      actionCode: "recommendations.action.moderateAlcohol",
      whyCode: "recommendations.why.regularAlcohol",
      evidenceCodes: ["evidence.alcoholConsumption"],
      expectedBenefitCode: "recommendations.benefit.lowersBpVariability",
      timelineCode: "this_week",
      action: "Limit alcohol consumption",
      why: "Regular alcohol consumption contributes to BP fluctuations.",
      evidence: ["Alcohol consumption evidence."],
      expectedBenefit: "Lowers blood pressure variability.",
      timeline: "This Week",
    });
  }

  // 7. Symptom Evaluation
  if (p.symptoms && typeof p.symptoms === "string" && p.symptoms.trim().length > 0) {
    candidates.push({
      id: "symptom-review",
      actionCode: "recommendations.action.symptomReview",
      whyCode: "recommendations.why.reportedSymptoms",
      evidenceCodes: ["evidence.reportedSymptoms"],
      expectedBenefitCode: "recommendations.benefit.evaluatesPhysiologicalTriggers",
      timelineCode: "today",
      action: "Consult a physician for reported symptoms",
      why: "Reported symptoms require clinical evaluation.",
      evidence: ["Reported symptoms evidence."],
      expectedBenefit: "Evaluates underlying physiological triggers.",
      timeline: "Today",
    });
  }

  // 8. Missing Evidence
  const missing = p.missingEvidence || [];
  const needsBp = !p.systolic && !p.diastolic;
  if (missing.length > 0 || needsBp) {
    candidates.push({
      id: "complete-missing-evidence",
      actionCode: "recommendations.action.recordMissingReadings",
      whyCode: "recommendations.why.incompleteProfile",
      evidenceCodes: ["evidence.missingReading"],
      expectedBenefitCode: "recommendations.benefit.increasesClinicalConfidence",
      timelineCode: "this_week",
      action: "Record missing blood pressure and lab readings",
      why: "Incomplete physiological profile reduces assessment confidence.",
      evidence: ["Missing evidence."],
      expectedBenefit: "Increases clinical evidence confidence.",
      timeline: "This Week",
    });
  }

  // Sort candidates by timeline urgency
  candidates.sort((a, b) => TIMELINE_WEIGHT[b.timelineCode] - TIMELINE_WEIGHT[a.timelineCode]);

  // TOP 3 PRIORITIES GATING
  return candidates.slice(0, 3);
}
