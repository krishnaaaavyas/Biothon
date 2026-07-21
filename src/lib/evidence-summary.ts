export interface EvidenceSummary {
  score: number;
  quality: "low" | "moderate" | "high";
  confidence: "limited" | "moderate" | "high";
  completedEvidence: string[];
  missingEvidence: string[];
  criticalMissingEvidence: string[];
  reasons: string[];
}

export interface ProfileCategoryStatus {
  name: string;
  key: string;
  complete: boolean;
  detail?: string;
}

export interface ProfileCompleteness {
  percentage: number;
  completedSections: string[];
  missingSections: string[];
  categories: ProfileCategoryStatus[];
}

export interface ProfileInput {
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  familyHistory?: string;
  exercise?: string;
  workoutDaysPerWeek?: number;
  symptoms?: string;
  systolic?: number;
  diastolic?: number;
  labObservations?: Array<{ code: string; value: number; unit?: string }>;
  [key: string]: any;
}

/**
 * Calculates a deterministic evidence completeness score and confidence evaluation.
 */
export function calculateEvidenceSummary(
  profile?: ProfileInput | null,
  labObservations?: Array<{ code: string; value: number; unit?: string }>,
  confirmedLabKeys: string[] = [],
  modelStatus: "available" | "unavailable" | "disabled" = "available",
  extractionFailed: boolean = false
): EvidenceSummary {
  let score = 0;
  const completedEvidence: string[] = [];
  const missingEvidence: string[] = [];
  const criticalMissingEvidence: string[] = [];
  const reasons: string[] = [];

  const p = profile || {};

  // 1. Age supplied (+5)
  if (typeof p.age === "number" && p.age > 0 && p.age <= 120) {
    score += 5;
    completedEvidence.push("Age provided");
  } else {
    criticalMissingEvidence.push("Age missing");
    missingEvidence.push("Provide your age");
  }

  // 2. Sex/gender supplied (+5)
  if (p.gender && typeof p.gender === "string" && p.gender.trim() !== "") {
    score += 5;
    completedEvidence.push("Sex/gender provided");
  } else {
    criticalMissingEvidence.push("Gender missing");
    missingEvidence.push("Provide sex/gender input");
  }

  // 3. Height and weight (+10)
  const hasHeight = typeof p.heightCm === "number" && p.heightCm > 50 && p.heightCm < 250;
  const hasWeight = typeof p.weightKg === "number" && p.weightKg > 20 && p.weightKg < 300;
  if (hasHeight && hasWeight) {
    score += 10;
    completedEvidence.push("Height and weight supplied");
  } else {
    if (!hasHeight) missingEvidence.push("Add height measurement");
    if (!hasWeight) missingEvidence.push("Add weight measurement");
    if (!hasHeight || !hasWeight) criticalMissingEvidence.push("Height/weight incomplete");
  }

  // 4. Family history (+10)
  if (p.familyHistory && typeof p.familyHistory === "string" && p.familyHistory.trim().length > 0) {
    score += 10;
    completedEvidence.push("Family history provided");
  } else {
    missingEvidence.push("Complete family-history questions");
  }

  // 5. Physical activity (+10)
  if (
    (p.exercise && typeof p.exercise === "string" && p.exercise.trim() !== "") ||
    (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek >= 0)
  ) {
    score += 10;
    completedEvidence.push("Physical activity information completed");
  } else {
    missingEvidence.push("Complete physical-activity information");
  }

  // 6. Symptoms answered (+10)
  if (typeof p.symptoms === "string" && p.symptoms.trim().length > 0) {
    score += 10;
    completedEvidence.push("Symptom questionnaire answered");
  } else {
    missingEvidence.push("Answer symptom questionnaire");
  }

  // 7. Blood pressure (+15)
  const hasBp = typeof p.systolic === "number" && p.systolic > 60 && typeof p.diastolic === "number" && p.diastolic > 40;
  if (hasBp) {
    score += 15;
    completedEvidence.push("Blood pressure reading supplied");
  } else {
    missingEvidence.push("Add a recent blood-pressure reading");
  }

  // 8. Blood report uploaded (+10)
  const labs = labObservations || p.labObservations || [];
  const hasLabs = labs.length > 0;
  if (hasLabs) {
    score += 10;
    completedEvidence.push("Blood report uploaded");
  } else {
    missingEvidence.push("Upload a clear PDF, JPG or PNG blood report");
  }

  // 9. Extracted values user-confirmed (+10)
  const hasConfirmedLabs = confirmedLabKeys.length > 0;
  const allLabsConfirmed = hasLabs && labs.every((obs) => confirmedLabKeys.includes(obs.code));
  if (hasConfirmedLabs) {
    score += 10;
    completedEvidence.push("Extracted laboratory values user-confirmed");
  } else if (hasLabs) {
    missingEvidence.push("Review and confirm your extracted blood report values");
  }

  // 10. Diabetes-relevant marker available (+10)
  const hasDiabetesMarker = labs.some((obs) => obs.code === "fastingBloodSugar" || obs.code === "HbA1c");
  if (hasDiabetesMarker) {
    score += 10;
    completedEvidence.push("Diabetes biomarker available (HbA1c / Fasting Glucose)");
  } else {
    missingEvidence.push("Provide Fasting Blood Glucose or HbA1c lab result");
  }

  // 11. Lipid marker available (+5)
  const hasLipidMarker = labs.some((obs) =>
    ["totalCholesterol", "ldl", "hdl", "triglycerides"].includes(obs.code)
  );
  if (hasLipidMarker) {
    score += 5;
    completedEvidence.push("Lipid panel biomarker available");
  } else {
    missingEvidence.push("Provide Lipid Panel (Cholesterol / Triglycerides) lab result");
  }

  // Clamp score to 0–100
  score = Math.min(100, Math.max(0, score));

  // Evidence Quality
  let quality: "low" | "moderate" | "high" = "low";
  if (score >= 70) quality = "high";
  else if (score >= 40) quality = "moderate";

  // Confidence Level
  let confidence: "limited" | "moderate" | "high" = "limited";
  const hasCriticalMissing = criticalMissingEvidence.length > 0;

  if (
    score >= 75 &&
    !hasCriticalMissing &&
    modelStatus === "available" &&
    !extractionFailed &&
    (!hasLabs || allLabsConfirmed)
  ) {
    confidence = "high";
    reasons.push("High confidence based on comprehensive physiological data, confirmed lab values, and active screening engine.");
  } else if (score >= 45 && !extractionFailed && modelStatus !== "unavailable") {
    confidence = "moderate";
    const modReasons: string[] = [];
    if (!hasBp) modReasons.push("blood pressure reading is missing");
    if (hasLabs && !allLabsConfirmed) modReasons.push("some extracted lab values remain unconfirmed");
    if (!hasDiabetesMarker) modReasons.push("diabetes biomarkers are missing");

    if (modReasons.length > 0) {
      reasons.push(`Moderate confidence because ${modReasons.join(" and ")}.`);
    } else {
      reasons.push("Moderate confidence based on partial evidence.");
    }
  } else {
    confidence = "limited";
    if (extractionFailed) {
      reasons.push("Limited confidence due to unreadable or failed blood report extraction.");
    } else if (modelStatus === "unavailable" || modelStatus === "disabled") {
      reasons.push("Limited confidence because the clinical screening model engine is currently unavailable.");
    } else if (hasCriticalMissing) {
      reasons.push(`Limited confidence because critical required inputs (${criticalMissingEvidence.join(", ")}) are missing.`);
    } else {
      reasons.push("Limited confidence due to low overall evidence completeness.");
    }
  }

  return {
    score,
    quality,
    confidence,
    completedEvidence,
    missingEvidence,
    criticalMissingEvidence,
    reasons,
  };
}

/**
 * Calculates Health Profile Completeness across 8 specific categories.
 */
export function calculateProfileCompleteness(
  profile?: ProfileInput | null,
  labObservations?: Array<{ code: string; value: number; unit?: string }>,
  confirmedLabKeys: string[] = []
): ProfileCompleteness {
  const p = profile || {};
  const labs = labObservations || p.labObservations || [];

  const categories: ProfileCategoryStatus[] = [
    {
      name: "Basic details",
      key: "basic",
      complete: typeof p.age === "number" && p.age > 0 && typeof p.gender === "string" && p.gender.trim() !== "",
      detail: "Age and Sex/Gender",
    },
    {
      name: "Body measurements",
      key: "body",
      complete: typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0,
      detail: "Height and Weight for BMI calculation",
    },
    {
      name: "Lifestyle",
      key: "lifestyle",
      complete: !!(p.exercise || p.smoking || p.alcohol || p.sleepHours),
      detail: "Physical activity, Sleep & Habits",
    },
    {
      name: "Family history",
      key: "family",
      complete: typeof p.familyHistory === "string" && p.familyHistory.trim().length > 0,
      detail: "Family medical background",
    },
    {
      name: "Symptoms",
      key: "symptoms",
      complete: typeof p.symptoms === "string" && p.symptoms.trim().length > 0,
      detail: "Reported symptoms & discomforts",
    },
    {
      name: "Blood pressure",
      key: "bp",
      complete: typeof p.systolic === "number" && p.systolic > 0 && typeof p.diastolic === "number" && p.diastolic > 0,
      detail: "Systolic & Diastolic BP readings",
    },
    {
      name: "Laboratory evidence",
      key: "lab",
      complete: labs.length > 0,
      detail: "Uploaded blood report markers",
    },
    {
      name: "User confirmation",
      key: "confirmation",
      complete: confirmedLabKeys.length > 0 || (labs.length === 0 && (p.hasCompletedAssessment || false)),
      detail: "Verified lab observations",
    },
  ];

  const completed = categories.filter((c) => c.complete);
  const missing = categories.filter((c) => !c.complete);

  const percentage = Math.round((completed.length / categories.length) * 100);

  return {
    percentage,
    completedSections: completed.map((c) => c.name),
    missingSections: missing.map((c) => c.name),
    categories,
  };
}
