export type WorkoutIntensityCode = "light" | "moderate" | "vigorous" | "restricted";

export interface ExerciseRecommendation {
  exerciseCode: string;
  durationCode: string;
  frequencyCode: string;
  reasonCode: string;
  expectedBenefitCode: string;
  intensityCode: WorkoutIntensityCode;
  durationMinutes: number;
  frequencyDays: number;
  // Legacy string properties for backward compatibility
  exercise: string;
  duration: string;
  frequency: string;
  reason: string;
  expectedBenefit: string;
}

export interface WeeklyWorkoutPlan {
  week1: ExerciseRecommendation[];
  week2: ExerciseRecommendation[];
  week3: ExerciseRecommendation[];
  week4: ExerciseRecommendation[];
}

export interface WorkoutEngineInput {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  activity?: "none" | "light" | "moderate" | "active" | string;
  workoutDaysPerWeek?: number;
  diabetesRiskCategory?: "low" | "moderate" | "high";
  diabetesRiskScore?: number;
  hypertensionRiskCategory?: "low" | "moderate" | "high";
  hypertensionRiskScore?: number;
  systolic?: number;
  diastolic?: number;
  symptoms?: string;
  medicalConditions?: string[];
  [key: string]: any;
}

export interface WorkoutEngineOutput {
  statusCode: "safe" | "contraindicated";
  summaryCode: string;
  // Legacy string properties
  status: "safe" | "contraindicated";
  summary: string;
  weeks: WeeklyWorkoutPlan;
  safetyNoteCodes: string[];
  safetyNotes: string[];
}

export const UNSAFE_FALLBACK_RECOMMENDATION: ExerciseRecommendation = {
  exerciseCode: "workout.exercise.noSafeExercise.name",
  durationCode: "0 min",
  frequencyCode: "0 days/week",
  reasonCode: "workout.exercise.noSafeExercise.reason",
  expectedBenefitCode: "workout.exercise.noSafeExercise.benefit",
  intensityCode: "restricted",
  durationMinutes: 0,
  frequencyDays: 0,
  exercise: "No safe exercise recommendation available.",
  duration: "0 min",
  frequency: "0 days/week",
  reason: "Acute symptoms (e.g. chest pain, severe dizziness) contraindicate unmonitored physical exertion.",
  expectedBenefit: "Seek urgent clinical evaluation before starting exercise.",
};

export function isExerciseContraindicated(input: WorkoutEngineInput): { contraindicated: boolean; reasonCode?: string; reason?: string } {
  const p = input || {};
  const sx = (p.symptoms || "").toLowerCase();
  const conds = (p.medicalConditions || []).map((c) => c.toLowerCase());

  if (
    sx.includes("chest pain") ||
    sx.includes("angina") ||
    sx.includes("severe dizziness") ||
    sx.includes("dizz") ||
    sx.includes("shortness of breath") ||
    sx.includes("breathlessness") ||
    sx.includes("syncope") ||
    conds.includes("chest-pain") ||
    conds.includes("angina")
  ) {
    return {
      contraindicated: true,
      reasonCode: "workout.safety.acuteSymptomsContraindicated",
      reason: "Reported acute symptoms (chest pain, dizziness, or shortness of breath) require clinical clearance before physical exertion.",
    };
  }

  if ((typeof p.systolic === "number" && p.systolic >= 180) || (typeof p.diastolic === "number" && p.diastolic >= 110)) {
    return {
      contraindicated: true,
      reasonCode: "workout.safety.hypertensionCrisisContraindicated",
      reason: "Severe blood pressure elevation (≥180/110 mmHg) contraindicates exercise until BP is medically stabilized.",
    };
  }

  return { contraindicated: false };
}

export function generateWorkoutPlan(input: WorkoutEngineInput): WorkoutEngineOutput {
  const p = input || {};
  const safetyCheck = isExerciseContraindicated(p);

  if (safetyCheck.contraindicated) {
    return {
      statusCode: "contraindicated",
      summaryCode: safetyCheck.reasonCode || "workout.safety.contraindicatedSummary",
      status: "contraindicated",
      summary: safetyCheck.reason || "Physical exertion contraindicated.",
      weeks: {
        week1: [UNSAFE_FALLBACK_RECOMMENDATION],
        week2: [UNSAFE_FALLBACK_RECOMMENDATION],
        week3: [UNSAFE_FALLBACK_RECOMMENDATION],
        week4: [UNSAFE_FALLBACK_RECOMMENDATION],
      },
      safetyNoteCodes: [safetyCheck.reasonCode || "workout.safety.contraindicatedSummary"],
      safetyNotes: [safetyCheck.reason || "Seek urgent clinical evaluation."],
    };
  }

  let bmi = p.bmi;
  if (!bmi && typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0) {
    bmi = Number((p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1));
  }

  const act = p.activity || "none";
  const isSedentary = act === "none" || p.workoutDaysPerWeek === 0;
  const isLight = act === "light" || (typeof p.workoutDaysPerWeek === "number" && p.workoutDaysPerWeek > 0 && p.workoutDaysPerWeek < 3);

  const isDiabetic =
    p.diabetesRiskCategory === "high" ||
    p.diabetesRiskCategory === "moderate" ||
    (typeof p.fastingBloodSugar === "number" && p.fastingBloodSugar >= 100) ||
    (typeof p.hba1c === "number" && p.hba1c >= 5.7);

  const isHypertensive =
    p.hypertensionRiskCategory === "high" ||
    p.hypertensionRiskCategory === "moderate" ||
    (typeof p.systolic === "number" && p.systolic >= 130) ||
    (typeof p.diastolic === "number" && p.diastolic >= 85);

  const isObese = typeof bmi === "number" && bmi >= 30;

  const sx = (p.symptoms || "").toLowerCase();
  const conds = (p.medicalConditions || []).map((c) => c.toLowerCase());
  const hasJointRestriction =
    sx.includes("knee pain") ||
    sx.includes("back pain") ||
    sx.includes("joint pain") ||
    sx.includes("arthritis") ||
    conds.includes("knee-pain") ||
    conds.includes("back-pain") ||
    conds.includes("arthritis");

  let exerciseCode = "workout.activities.briskWalking";
  let primaryName = "Brisk Walking";
  let intensityCode: WorkoutIntensityCode = "light";

  if (hasJointRestriction) {
    exerciseCode = "workout.activities.yogaMobility";
    primaryName = "Gentle Hatha Yoga & Spine Mobility";
    intensityCode = "light";
  } else if (isObese) {
    exerciseCode = "workout.activities.stationaryCycling";
    primaryName = "Low-Impact Stationary Cycling";
    intensityCode = "light";
  } else if (!isSedentary && !isLight) {
    exerciseCode = "workout.activities.briskWalking";
    primaryName = "Brisk Walking";
    intensityCode = "moderate";
  }

  let reasonCode = "workout.reason.lowActivity";
  let benefitCode = "workout.benefit.cardioStamina";
  let clinicalReason = "Low baseline activity level.";
  let expectedBenefit = "Improves cardiovascular endurance and aerobic fitness.";

  if (isDiabetic) {
    reasonCode = "workout.reason.diabeticScreening";
    benefitCode = "workout.benefit.insulinSensitivity";
    clinicalReason = "Elevated glycemic screening markers.";
    expectedBenefit = "Improves insulin sensitivity and postprandial glucose uptake.";
  } else if (isHypertensive) {
    reasonCode = "workout.reason.hypertensionScreening";
    benefitCode = "workout.benefit.vascularResistance";
    clinicalReason = "Elevated blood pressure screening readings.";
    expectedBenefit = "Lowers systemic vascular resistance and resting arterial pressure.";
  } else if (isObese) {
    reasonCode = "workout.reason.obesityRange";
    benefitCode = "workout.benefit.caloricExpenditure";
    clinicalReason = "BMI in obesity range requires low-impact metabolic activation.";
    expectedBenefit = "Increases daily caloric expenditure while protecting knee joints.";
  }

  const baseMinutes = isSedentary ? 15 : isLight ? 20 : 25;

  const w1Min = baseMinutes;
  const w2Min = baseMinutes + 5;
  const w3Min = baseMinutes + 10;
  const w4Min = baseMinutes + 15;

  const w1FreqDays = 3;
  const w2FreqDays = isSedentary ? 3 : 4;
  const w3FreqDays = 4;
  const w4FreqDays = isSedentary ? 4 : 5;

  const buildRec = (min: number, freqDays: number): ExerciseRecommendation => ({
    exerciseCode,
    durationCode: `${min} min`,
    frequencyCode: `${freqDays} days/week`,
    reasonCode,
    expectedBenefitCode: benefitCode,
    intensityCode,
    durationMinutes: min,
    frequencyDays: freqDays,
    exercise: primaryName,
    duration: `${min} min`,
    frequency: `${freqDays} days/week`,
    reason: clinicalReason,
    expectedBenefit: expectedBenefit,
  });

  const secondaryCode = hasJointRestriction ? "workout.activities.chairSquats" : "workout.activities.resistanceBands";
  const secondaryName = hasJointRestriction ? "Supported Chair Squats & Glute Bridges" : "Resistance Band Upper Body Press";

  const secondaryRec = (min: number): ExerciseRecommendation => ({
    exerciseCode: secondaryCode,
    durationCode: `${Math.max(10, min - 5)} min`,
    frequencyCode: "2 days/week",
    reasonCode: "workout.reason.strengthComplement",
    expectedBenefitCode: "workout.benefit.muscleBoneDensity",
    intensityCode: "light",
    durationMinutes: Math.max(10, min - 5),
    frequencyDays: 2,
    exercise: secondaryName,
    duration: `${Math.max(10, min - 5)} min`,
    frequency: "2 days/week",
    reason: "Complements aerobic exercise with joint-friendly muscular strength.",
    expectedBenefit: "Maintains muscle mass and bone mineral density.",
  });

  return {
    statusCode: "safe",
    summaryCode: "workout.summary.progressivePlan",
    status: "safe",
    summary: `Progressive 4-week workout plan tailored for ${primaryName.toLowerCase()} and metabolic conditioning.`,
    weeks: {
      week1: [buildRec(w1Min, w1FreqDays)],
      week2: [buildRec(w2Min, w2FreqDays)],
      week3: [buildRec(w3Min, w3FreqDays), secondaryRec(w3Min)],
      week4: [buildRec(w4Min, w4FreqDays), secondaryRec(w4Min)],
    },
    safetyNoteCodes: hasJointRestriction
      ? ["workout.safety.jointDiscomfortExcluded"]
      : ["workout.safety.stayHydrated"],
    safetyNotes: hasJointRestriction
      ? ["High-impact exercises excluded due to reported joint/knee discomfort."]
      : ["Stay hydrated and maintain moderate intensity where conversational speaking is comfortable."],
  };
}
