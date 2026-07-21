export interface ExerciseRecommendation {
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
  status: "safe" | "contraindicated";
  summary: string;
  weeks: WeeklyWorkoutPlan;
  safetyNotes: string[];
}

export const UNSAFE_FALLBACK_RECOMMENDATION: ExerciseRecommendation = {
  exercise: "No safe exercise recommendation available.",
  duration: "0 min",
  frequency: "0 days/week",
  reason: "Acute symptoms (e.g. chest pain, severe dizziness) contraindicate unmonitored physical exertion.",
  expectedBenefit: "Seek urgent clinical evaluation before starting exercise.",
};

export interface ExerciseItemTemplate {
  name: string;
  category: "cardio" | "strength" | "mobility";
  isHighImpact: boolean;
  baseDurationMinutes: number;
  baseFrequencyDays: number;
}

export const EXERCISE_TEMPLATES: ExerciseItemTemplate[] = [
  {
    name: "Brisk Walking",
    category: "cardio",
    isHighImpact: false,
    baseDurationMinutes: 20,
    baseFrequencyDays: 3,
  },
  {
    name: "Low-Impact Stationary Cycling",
    category: "cardio",
    isHighImpact: false,
    baseDurationMinutes: 20,
    baseFrequencyDays: 3,
  },
  {
    name: "Supported Chair Squats & Glute Bridges",
    category: "strength",
    isHighImpact: false,
    baseDurationMinutes: 15,
    baseFrequencyDays: 2,
  },
  {
    name: "Resistance Band Upper Body Press",
    category: "strength",
    isHighImpact: false,
    baseDurationMinutes: 15,
    baseFrequencyDays: 2,
  },
  {
    name: "Gentle Hatha Yoga & Spine Mobility",
    category: "mobility",
    isHighImpact: false,
    baseDurationMinutes: 20,
    baseFrequencyDays: 3,
  },
  {
    name: "Jump Squats & High-Impact Intervals",
    category: "cardio",
    isHighImpact: true,
    baseDurationMinutes: 25,
    baseFrequencyDays: 4,
  },
];

/**
 * Check medical contraindications for exercise safety.
 */
export function isExerciseContraindicated(input: WorkoutEngineInput): { contraindicated: boolean; reason?: string } {
  const p = input || {};
  const sx = (p.symptoms || "").toLowerCase();
  const conds = (p.medicalConditions || []).map((c) => c.toLowerCase());

  // 1. Acute Symptoms (Chest pain, severe dizziness, acute shortness of breath, syncope)
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
      reason: "Reported acute symptoms (chest pain, dizziness, or shortness of breath) require clinical clearance before physical exertion.",
    };
  }

  // 2. Severe Uncontrolled Hypertension (Systolic >= 180 or Diastolic >= 110)
  if ((typeof p.systolic === "number" && p.systolic >= 180) || (typeof p.diastolic === "number" && p.diastolic >= 110)) {
    return {
      contraindicated: true,
      reason: "Severe blood pressure elevation (≥180/110 mmHg) contraindicates exercise until BP is medically stabilized.",
    };
  }

  return { contraindicated: false };
}

/**
 * Deterministic Workout Recommendation Engine (Main Entrypoint)
 */
export function generateWorkoutPlan(input: WorkoutEngineInput): WorkoutEngineOutput {
  const p = input || {};
  const safetyCheck = isExerciseContraindicated(p);

  if (safetyCheck.contraindicated) {
    return {
      status: "contraindicated",
      summary: safetyCheck.reason || "Physical exertion contraindicated.",
      weeks: {
        week1: [UNSAFE_FALLBACK_RECOMMENDATION],
        week2: [UNSAFE_FALLBACK_RECOMMENDATION],
        week3: [UNSAFE_FALLBACK_RECOMMENDATION],
        week4: [UNSAFE_FALLBACK_RECOMMENDATION],
      },
      safetyNotes: [safetyCheck.reason || "Seek urgent clinical evaluation."],
    };
  }

  // Compute BMI if missing
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

  // Injury / Joint restriction check
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

  // Select suitable base exercise
  let primaryExerciseName = "Brisk Walking";
  if (hasJointRestriction) {
    primaryExerciseName = "Gentle Hatha Yoga & Spine Mobility";
  } else if (isObese) {
    primaryExerciseName = "Low-Impact Stationary Cycling";
  } else if (!isSedentary && !isLight) {
    primaryExerciseName = "Brisk Walking";
  }

  // Derive Clinical Reason & Expected Benefit
  let clinicalReason = "Low baseline activity level.";
  let expectedBenefit = "Improves cardiovascular endurance and aerobic fitness.";

  if (isDiabetic) {
    clinicalReason = "Elevated glycemic screening markers.";
    expectedBenefit = "Improves insulin sensitivity and postprandial glucose uptake.";
  } else if (isHypertensive) {
    clinicalReason = "Elevated blood pressure screening readings.";
    expectedBenefit = "Lowers systemic vascular resistance and resting arterial pressure.";
  } else if (isObese) {
    clinicalReason = "BMI in obesity range requires low-impact metabolic activation.";
    expectedBenefit = "Increases daily caloric expenditure while protecting knee joints.";
  } else if (isSedentary) {
    clinicalReason = "Sedentary lifestyle habits.";
    expectedBenefit = "Establishes baseline aerobic conditioning and metabolic stamina.";
  }

  // Progressive 4-Week Adaptation Calculation
  // Week 1: Baseline duration (15-20 min), 3 days/week
  // Week 2: +5 min duration, 3 days/week
  // Week 3: +5 min duration, 4 days/week
  // Week 4: Target capacity (+5 min), 4-5 days/week
  const baseMinutes = isSedentary ? 15 : isLight ? 20 : 25;

  const w1Min = baseMinutes;
  const w2Min = baseMinutes + 5;
  const w3Min = baseMinutes + 10;
  const w4Min = baseMinutes + 15;

  const w1Freq = isSedentary ? "3 days/week" : "3 days/week";
  const w2Freq = isSedentary ? "3 days/week" : "4 days/week";
  const w3Freq = "4 days/week";
  const w4Freq = isSedentary ? "4 days/week" : "5 days/week";

  const buildRec = (min: number, freq: string): ExerciseRecommendation => ({
    exercise: primaryExerciseName,
    duration: `${min} min`,
    frequency: freq,
    reason: clinicalReason,
    expectedBenefit: expectedBenefit,
  });

  const secondaryExerciseName = hasJointRestriction ? "Supported Chair Squats & Glute Bridges" : "Resistance Band Upper Body Press";

  const secondaryRec = (min: number, freq: string): ExerciseRecommendation => ({
    exercise: secondaryExerciseName,
    duration: `${Math.max(10, min - 5)} min`,
    frequency: "2 days/week",
    reason: "Complements aerobic exercise with joint-friendly muscular strength.",
    expectedBenefit: "Maintains muscle mass and bone mineral density.",
  });

  return {
    status: "safe",
    summary: `Progressive 4-week workout plan tailored for ${primaryExerciseName.toLowerCase()} and metabolic conditioning.`,
    weeks: {
      week1: [buildRec(w1Min, w1Freq)],
      week2: [buildRec(w2Min, w2Freq)],
      week3: [buildRec(w3Min, w3Freq), secondaryRec(w3Min, w3Freq)],
      week4: [buildRec(w4Min, w4Freq), secondaryRec(w4Min, w4Freq)],
    },
    safetyNotes: hasJointRestriction
      ? ["High-impact exercises excluded due to reported joint/knee discomfort."]
      : ["Stay hydrated and maintain moderate intensity where conversational speaking is comfortable."],
  };
}
