export interface UserProfile {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  smoking: "never" | "former" | "current";
  exercise: "none" | "light" | "moderate" | "active";
  familyHistory: string;
  symptoms: string;
  alcohol?: string | null;
  diseases?: string | null;
}

export interface Factor {
  name: string;
  impact: number;
}

export interface RiskResult {
  risk: number;
  level: "Low" | "Moderate" | "High";
  factors: Factor[];
}

export interface ActionPriority {
  action: string;
  estimatedImpact: number;
}

export interface CompleteRiskAnalysis {
  bmi: number;
  bmiCategory: "Underweight" | "Normal" | "Overweight" | "Obese";
  diabetesRisk: RiskResult;
  heartRisk: RiskResult;
  hypertensionRisk: RiskResult;
  overallRisk: number;
  overallRiskLabel: "Low" | "Moderate" | "High";
  factors: Factor[];
  actionPriorities: ActionPriority[];
  rationale: {
    diabetes: string;
    heartDisease: string;
    hypertension: string;
  };
  dietPlan: string;
  exercisePlan: string;
  preventionTips: string;
}

export class RiskService {
  /**
   * Calculate Body Mass Index (BMI) and categorize
   */
  static calculateBMI(heightCm: number, weightKg: number): { bmi: number; category: "Underweight" | "Normal" | "Overweight" | "Obese" } {
    const bmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
    let category: "Underweight" | "Normal" | "Overweight" | "Obese" = "Normal";

    if (bmi < 18.5) {
      category = "Underweight";
    } else if (bmi < 25) {
      category = "Normal";
    } else if (bmi < 30) {
      category = "Overweight";
    } else {
      category = "Obese";
    }

    return { bmi, category };
  }

  /**
   * Diabetes Risk Model (inspired by FINDRISC points scale)
   */
  static calculateDiabetesRisk(profile: UserProfile, bmi: number): RiskResult {
    let score = 0;
    const factors: Factor[] = [];

    // 1. Age (Max 4 points)
    let agePts = 0;
    if (profile.age >= 45 && profile.age <= 54) agePts = 2;
    else if (profile.age >= 55 && profile.age <= 64) agePts = 3;
    else if (profile.age > 64) agePts = 4;
    
    if (agePts > 0) {
      score += agePts;
      factors.push({ name: `Age ${profile.age} (Demographics)`, impact: Math.round((agePts / 15) * 100) });
    }

    // 2. BMI (Max 3 points)
    let bmiPts = 0;
    if (bmi >= 25 && bmi < 30) bmiPts = 2;
    else if (bmi >= 30) bmiPts = 4;
    
    if (bmiPts > 0) {
      score += bmiPts;
      factors.push({ name: `Elevated BMI (${bmi})`, impact: Math.round((bmiPts / 15) * 100) });
    }

    // 3. Exercise (Max 2 points)
    if (profile.exercise === "none" || profile.exercise === "light") {
      score += 3;
      factors.push({ name: "Sedentary or Light Activity", impact: Math.round((3 / 15) * 100) });
    }

    // 4. Family History (Max 5 points)
    let fhPts = 0;
    const fhLower = profile.familyHistory.toLowerCase();
    if (fhLower.includes("diabet") || fhLower.includes("sugar")) {
      if (
        fhLower.includes("mother") ||
        fhLower.includes("father") ||
        fhLower.includes("parent") ||
        fhLower.includes("sibling") ||
        fhLower.includes("brother") ||
        fhLower.includes("sister") ||
        fhLower.includes("son") ||
        fhLower.includes("daughter")
      ) {
        fhPts = 5; // First-degree relative
      } else {
        fhPts = 3; // Second-degree relative
      }
    }
    if (fhPts > 0) {
      score += fhPts;
      factors.push({ name: "Genetic Predisposition (Family History of Diabetes)", impact: Math.round((fhPts / 15) * 100) });
    }

    // 5. Diet Quality Heuristics (Max 1 point)
    let dietPts = 0;
    const allText = (profile.symptoms + " " + profile.familyHistory).toLowerCase();
    if (allText.includes("sweet") || allText.includes("sugar") || allText.includes("junk") || allText.includes("soda") || allText.includes("fast food")) {
      dietPts = 1;
      score += 1;
      factors.push({ name: "Unbalanced Dietary Indicators", impact: Math.round((1 / 15) * 100) });
    }

    // 6. Symptoms (Max 2 points)
    let sxPts = 0;
    const sxLower = profile.symptoms.toLowerCase();
    if (sxLower.includes("thirst") || sxLower.includes("urination") || sxLower.includes("fatigue") || sxLower.includes("dry mouth") || sxLower.includes("polyuria")) {
      sxPts = 2;
      score += 2;
      factors.push({ name: "Reported Metabolic Symptoms", impact: Math.round((2 / 15) * 100) });
    }

    const risk = Math.min(100, Math.round((score / 15) * 100));
    const level = risk <= 30 ? "Low" : risk <= 60 ? "Moderate" : "High";

    return {
      risk,
      level,
      factors: factors.sort((a, b) => b.impact - a.impact),
    };
  }

  /**
   * Heart Disease Risk Model (inspired by Framingham criteria)
   */
  static calculateHeartRisk(profile: UserProfile, bmi: number): RiskResult {
    let score = 0;
    const factors: Factor[] = [];

    // 1. Age (Max 12 points)
    let agePts = 0;
    if (profile.age >= 35 && profile.age <= 39) agePts = 2;
    else if (profile.age >= 40 && profile.age <= 44) agePts = 5;
    else if (profile.age >= 45 && profile.age <= 49) agePts = 7;
    else if (profile.age >= 50 && profile.age <= 54) agePts = 8;
    else if (profile.age >= 55 && profile.age <= 59) agePts = 10;
    else if (profile.age >= 60) agePts = 12;

    if (agePts > 0) {
      score += agePts;
      factors.push({ name: `Age ${profile.age} (Framingham Factor)`, impact: Math.round((agePts / 20) * 100) });
    }

    // 2. BMI (Max 2 points)
    let bmiPts = 0;
    if (bmi >= 25 && bmi < 30) bmiPts = 2;
    else if (bmi >= 30) bmiPts = 3;

    if (bmiPts > 0) {
      score += bmiPts;
      factors.push({ name: `Weight Burden (BMI: ${bmi})`, impact: Math.round((bmiPts / 20) * 100) });
    }

    // 3. Smoking (Max 4 points)
    let smokePts = 0;
    if (profile.smoking === "current") smokePts = 4;
    else if (profile.smoking === "former") smokePts = 2;

    if (smokePts > 0) {
      score += smokePts;
      factors.push({ name: `Tobacco/Smoking Status (${profile.smoking})`, impact: Math.round((smokePts / 20) * 100) });
    }

    // 4. Exercise (Max 2 points)
    if (profile.exercise === "none" || profile.exercise === "light") {
      score += 3;
      factors.push({ name: "Lack of Cardiovascular Conditioning", impact: Math.round((3 / 20) * 100) });
    }

    // 5. Family History (Max 3 points)
    let fhPts = 0;
    const fhLower = profile.familyHistory.toLowerCase();
    if (fhLower.includes("heart") || fhLower.includes("cardiac") || fhLower.includes("stroke") || fhLower.includes("bypass") || fhLower.includes("infarct")) {
      fhPts = 3;
      score += 3;
      factors.push({ name: "Family History of Coronary Heart Disease", impact: Math.round((3 / 20) * 100) });
    }

    // 6. Hypertension History (Max 3 points)
    let htPts = 0;
    const allText = (profile.symptoms + " " + profile.familyHistory + " " + (profile.diseases || "")).toLowerCase();
    if (allText.includes("hypertension") || allText.includes("bp") || allText.includes("blood pressure") || allText.includes("pressure")) {
      htPts = 3;
      score += 3;
      factors.push({ name: "Hypertensive Indicators", impact: Math.round((3 / 20) * 100) });
    }

    const risk = Math.min(100, Math.round((score / 20) * 100));
    const level = risk <= 30 ? "Low" : risk <= 60 ? "Moderate" : "High";

    return {
      risk,
      level,
      factors: factors.sort((a, b) => b.impact - a.impact),
    };
  }

  /**
   * Hypertension Risk Model
   */
  static calculateHypertensionRisk(profile: UserProfile, bmi: number): RiskResult {
    let score = 0;
    const factors: Factor[] = [];

    // 1. Age (Max 4 points)
    let agePts = 0;
    if (profile.age > 45 && profile.age <= 60) agePts = 2;
    else if (profile.age > 60) agePts = 4;

    if (agePts > 0) {
      score += agePts;
      factors.push({ name: `Vascular Strain by Age (${profile.age} yrs)`, impact: Math.round((agePts / 14) * 100) });
    }

    // 2. BMI / Weight (Max 3 points)
    let weightPts = 0;
    if (bmi >= 25 && bmi < 30) weightPts = 2;
    else if (bmi >= 30) weightPts = 4;

    if (weightPts > 0) {
      score += weightPts;
      factors.push({ name: `Elevated Body Mass Index (${bmi})`, impact: Math.round((weightPts / 14) * 100) });
    }

    // 3. Exercise (Max 2 points)
    if (profile.exercise === "none" || profile.exercise === "light") {
      score += 3;
      factors.push({ name: "Sedentary Activity Level", impact: Math.round((3 / 14) * 100) });
    }

    // 4. Smoking (Max 2 points)
    let smokePts = 0;
    if (profile.smoking === "current") smokePts = 2;
    else if (profile.smoking === "former") smokePts = 1;

    if (smokePts > 0) {
      score += smokePts;
      factors.push({ name: `Vasoconstriction Risk (Smoking: ${profile.smoking})`, impact: Math.round((smokePts / 14) * 100) });
    }

    // 5. Alcohol (Max 3 points)
    let alcPts = 0;
    const alcVal = (profile.alcohol || "").toLowerCase();
    const allText = (profile.symptoms + " " + profile.familyHistory).toLowerCase();

    if (alcVal.includes("heavy") || alcVal.includes("frequent")) {
      alcPts = 3;
    } else if (alcVal.includes("occasional") || alcVal.includes("moderate") || alcVal.includes("drink")) {
      alcPts = 1;
    } else if (allText.includes("alcohol") || allText.includes("drinking") || allText.includes("beer") || allText.includes("wine") || allText.includes("whiskey")) {
      alcPts = 1;
    }

    if (alcPts > 0) {
      score += alcPts;
      factors.push({ name: "Alcohol Intake", impact: Math.round((alcPts / 14) * 100) });
    }

    // 6. Family History (Max 3 points)
    let fhPts = 0;
    const fhLower = profile.familyHistory.toLowerCase();
    if (fhLower.includes("bp") || fhLower.includes("hypertension") || fhLower.includes("blood pressure") || fhLower.includes("pressure")) {
      fhPts = 3;
      score += 3;
      factors.push({ name: "Genetic Predisposition to Hypertension", impact: Math.round((3 / 14) * 100) });
    }

    const risk = Math.min(100, Math.round((score / 14) * 100));
    const level = risk <= 30 ? "Low" : risk <= 60 ? "Moderate" : "High";

    return {
      risk,
      level,
      factors: factors.sort((a, b) => b.impact - a.impact),
    };
  }

  /**
   * Combine risks into Overall Score
   */
  static calculateOverallHealthScore(diabetes: number, heart: number, hypertension: number): { overallRisk: number; overallRiskLabel: "Low" | "Moderate" | "High" } {
    const overallRisk = Math.round((diabetes + heart + hypertension) / 3);
    const overallRiskLabel = overallRisk <= 30 ? "Low" : overallRisk <= 60 ? "Moderate" : "High";
    return { overallRisk, overallRiskLabel };
  }

  /**
   * Sort factors aggregated by impact
   */
  static aggregateFactors(diabetesFactors: Factor[], heartFactors: Factor[], hyperFactors: Factor[]): Factor[] {
    const map = new Map<string, number>();

    const add = (f: Factor) => {
      const cur = map.get(f.name) || 0;
      // We take the max impact for aggregated factor representation
      map.set(f.name, Math.max(cur, f.impact));
    };

    diabetesFactors.forEach(add);
    heartFactors.forEach(add);
    hyperFactors.forEach(add);

    const list: Factor[] = [];
    map.forEach((impact, name) => {
      list.push({ name, impact });
    });

    return list.sort((a, b) => b.impact - a.impact);
  }

  /**
   * What-If Simulator Action Priority Engine (Pure Math, No AI)
   */
  static getActionPriorities(profile: UserProfile, currentOverallRisk: number): ActionPriority[] {
    const priorities: ActionPriority[] = [];
    const heightCm = profile.heightCm;

    // Helper to run pipeline and calculate overall risk
    const runPipe = (modProfile: UserProfile): number => {
      const { bmi } = this.calculateBMI(modProfile.heightCm, modProfile.weightKg);
      const d = this.calculateDiabetesRisk(modProfile, bmi).risk;
      const h = this.calculateHeartRisk(modProfile, bmi).risk;
      const ht = this.calculateHypertensionRisk(modProfile, bmi).risk;
      return Math.round((d + h + ht) / 3);
    };

    // 1. Simulate regular exercise
    if (profile.exercise === "none" || profile.exercise === "light") {
      const mod = { ...profile, exercise: "moderate" as const };
      const drop = runPipe(mod) - currentOverallRisk;
      if (drop < 0) {
        priorities.push({ action: "Exercise 30 min/day (5x/week)", estimatedImpact: drop });
      }
    }

    // 2. Simulate weight loss to reach Normal BMI (BMI = 23)
    const currentBmi = this.calculateBMI(heightCm, profile.weightKg).bmi;
    if (currentBmi >= 25) {
      // target weight for BMI 23 = 23 * (heightCm / 100)^2
      const targetWeight = Math.round(23 * Math.pow(heightCm / 100, 2));
      const kgsToLose = Math.round(profile.weightKg - targetWeight);
      if (kgsToLose > 0) {
        const mod = { ...profile, weightKg: targetWeight };
        const drop = runPipe(mod) - currentOverallRisk;
        if (drop < 0) {
          priorities.push({ action: `Lose ${kgsToLose}kg to achieve a healthy BMI`, estimatedImpact: drop });
        }
      }
    }

    // 3. Simulate quitting smoking
    if (profile.smoking === "current") {
      const mod = { ...profile, smoking: "never" as const };
      const drop = runPipe(mod) - currentOverallRisk;
      if (drop < 0) {
        priorities.push({ action: "Quit smoking completely", estimatedImpact: drop });
      }
    }

    // 4. Simulate reducing alcohol
    const alcVal = (profile.alcohol || "").toLowerCase();
    if (alcVal.includes("heavy") || alcVal.includes("occasional") || alcVal.includes("moderate") || alcVal.includes("drink")) {
      const mod = { ...profile, alcohol: "never" };
      const drop = runPipe(mod) - currentOverallRisk;
      if (drop < 0) {
        priorities.push({ action: "Limit alcohol consumption", estimatedImpact: drop });
      }
    }

    // 5. Simulate resolving symptoms
    const sxLower = profile.symptoms.toLowerCase();
    if (sxLower.includes("thirst") || sxLower.includes("urination") || sxLower.includes("fatigue") || sxLower.includes("dry mouth") || sxLower.includes("headache") || sxLower.includes("dizz")) {
      const mod = { ...profile, symptoms: "" };
      const drop = runPipe(mod) - currentOverallRisk;
      if (drop < 0) {
        priorities.push({ action: "Consult physician to address active symptoms", estimatedImpact: drop });
      }
    }

    // Sort priorities so the largest drop (most negative impact) is listed first
    return priorities.sort((a, b) => a.estimatedImpact - b.estimatedImpact);
  }

  /**
   * Deterministic Plan Generator for offline / core fallback support
   */
  static generateDeterministicPlans(profile: UserProfile, scores: { diabetes: number; heart: number; hypertension: number }): { rationale: CompleteRiskAnalysis["rationale"]; dietPlan: string; exercisePlan: string; preventionTips: string } {
    // 1. Rationale Builder
    const dbReason = scores.diabetes > 50 
      ? `Your elevated Diabetes Risk (${scores.diabetes}%) is driven by indicators including a BMI of ${(profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)} and sedentary lifestyle parameters.`
      : `Your Diabetes Risk (${scores.diabetes}%) is low/moderate due to balanced demographic and lifestyle markers.`;

    const heartReason = scores.heart > 50
      ? `Your high Heart Disease Risk (${scores.heart}%) is influenced by cardiovascular parameters such as age (${profile.age}), smoking status (${profile.smoking}), and weight.`
      : `Your Heart Disease Risk (${scores.heart}%) remains low/moderate based on reported profiles.`;

    const htReason = scores.hypertension > 50
      ? `Your elevated Hypertension Risk (${scores.hypertension}%) suggests vascular strain indicators driven by family history, weight profile, or reported habits.`
      : `Your Hypertension Risk (${scores.hypertension}%) indicates normal baseline vascular markers.`;

    // 2. Diet plan builder
    let dietParts = ["Dietary Recommendation Summary:\n"];
    if (scores.diabetes > 50) {
      dietParts.push("- Choose complex carbohydrates (oats, brown rice, whole wheat) over refined flour.\n- Include high-fiber pulses, legumes, and lean proteins in every meal.\n- Minimize processed sugar, sweet snacks, and soda intakes.");
    }
    if (scores.hypertension > 50) {
      dietParts.push("- Follow DASH dietary guidelines, restricting daily sodium to under 2,000 mg.\n- Avoid pickles, processed meats, papad, and salty snacks.\n- Boost potassium intake by eating leafy greens, bananas, and yogurt.");
    }
    if (dietParts.length === 1) {
      dietParts.push("- Maintain a balanced intake of protein, healthy fats (olive/mustard oil, nuts), and green vegetables.\n- Practice mindful portion control and drink 2.5L of water daily.");
    }

    // 3. Exercise plan builder
    let exParts = ["Exercise Routine Guidelines:\n"];
    if (profile.exercise === "none" || profile.exercise === "light") {
      exParts.push("- Start with a daily 15-20 minute brisk walk.\n- Incorporate gentle mobility, joint rotations, and calf stretches.\n- Aim for a target of 150 minutes of light cardio per week.");
    } else {
      exParts.push("- Continue with moderate/active workouts (30-45 mins 5x/week).\n- Integrate strength conditioning (squats, planks, lunges) 2 days a week.\n- Prioritize post-exercise stretching and hydration.");
    }

    // 4. Prevention tips
    let prevTips = ["Key Preventive Health Targets:\n"];
    if (profile.smoking === "current") {
      prevTips.push("- Seek counseling or nicotine replacement therapy to quit smoking completely.\n");
    }
    if (scores.diabetes > 30 || scores.heart > 30 || scores.hypertension > 30) {
      prevTips.push("- Monitor fasting blood sugar and resting blood pressure quarterly.\n- Undergo a comprehensive annual lipid panel test.\n");
    }
    prevTips.push("- Maintain healthy sleep hygiene (7-8 hours per night) to regulate metabolic strain.\n- Practice deep breathing or meditation to lower chronic cortisol levels.");

    return {
      rationale: {
        diabetes: dbReason,
        heartDisease: heartReason,
        hypertension: htReason,
      },
      dietPlan: dietParts.join("\n"),
      exercisePlan: exParts.join("\n"),
      preventionTips: prevTips.join("\n"),
    };
  }

  /**
   * Run the full Risk Analysis pipeline
   */
  static analyze(profile: UserProfile): CompleteRiskAnalysis {
    const { bmi, category: bmiCategory } = this.calculateBMI(profile.heightCm, profile.weightKg);

    const diabetesRisk = this.calculateDiabetesRisk(profile, bmi);
    const heartRisk = this.calculateHeartRisk(profile, bmi);
    const hypertensionRisk = this.calculateHypertensionRisk(profile, bmi);

    const { overallRisk, overallRiskLabel } = this.calculateOverallHealthScore(
      diabetesRisk.risk,
      heartRisk.risk,
      hypertensionRisk.risk
    );

    const factors = this.aggregateFactors(
      diabetesRisk.factors,
      heartRisk.factors,
      hypertensionRisk.factors
    );

    const actionPriorities = this.getActionPriorities(profile, overallRisk);

    const plans = this.generateDeterministicPlans(profile, {
      diabetes: diabetesRisk.risk,
      heart: heartRisk.risk,
      hypertension: hypertensionRisk.risk,
    });

    return {
      bmi,
      bmiCategory,
      diabetesRisk,
      heartRisk,
      hypertensionRisk,
      overallRisk,
      overallRiskLabel,
      factors,
      actionPriorities,
      ...plans,
    };
  }
}
