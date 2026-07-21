export type DietStrategyCode =
  | "balanced_maintenance"
  | "calorie_conscious"
  | "lower_glycemic"
  | "lower_sodium"
  | "lower_glycemic_lower_sodium"
  | "high_protein_balanced";

export interface MealRecommendation {
  mealCode: string;
  reasonCode: string;
  expectedBenefitCode: string;
  // Legacy string properties for backward compatibility
  meal: string;
  reason: string;
  expectedBenefit: string;
}

export interface DailyDietPlan {
  breakfast: MealRecommendation;
  lunch: MealRecommendation;
  snacks: MealRecommendation;
  dinner: MealRecommendation;
}

export interface DietEngineInput {
  priorities?: Array<{ id: string; title: string; severity?: string; category?: string }>;
  bmi?: number;
  heightCm?: number;
  weightKg?: number;
  diabetesRiskCategory?: "low" | "moderate" | "high";
  diabetesRiskScore?: number;
  hypertensionRiskCategory?: "low" | "moderate" | "high";
  hypertensionRiskScore?: number;
  systolic?: number;
  diastolic?: number;
  fastingBloodSugar?: number;
  hba1c?: number;
  totalCholesterol?: number;
  ldl?: number;
  dietType?: "vegetarian" | "vegan" | "eggetarian" | "non-vegetarian" | "jain" | "satvik" | "no-onion-garlic" | string;
  allergies?: string[];
  foodAllergies?: string;
  lactoseIntolerant?: boolean;
  excludedFoods?: string[];
  [key: string]: any;
}

export interface DietEngineOutput {
  strategyCode: DietStrategyCode;
  strategyReasonCode: string;
  // Legacy strategy string for backward compatibility
  strategy: string;
  strategyReason: string;
  meals: DailyDietPlan;
  constraintsApplied: {
    dietType: string;
    allergies: string[];
    exclusions: string[];
  };
}

export interface MealTemplate {
  code: string;
  course: "breakfast" | "lunch" | "snacks" | "dinner";
  strategies: DietStrategyCode[];
  types: string[];
  contains: string[];
  reasonCodes: Record<DietStrategyCode, { reasonCode: string; expectedBenefitCode: string }>;
  fallbackName: string;
  fallbackReason: string;
  fallbackBenefit: string;
}

export const FALLBACK_MEAL: MealRecommendation = {
  mealCode: "diet.meal.noSafeMeal.name",
  reasonCode: "diet.meal.noSafeMeal.reason",
  expectedBenefitCode: "diet.meal.noSafeMeal.benefit",
  meal: "No safe meal available.",
  reason: "Constraints restrict all available options.",
  expectedBenefit: "Consult a dietitian for custom options.",
};

export const REUSABLE_MEAL_CATALOG: MealTemplate[] = [
  {
    code: "vegetable_oats",
    course: "breakfast",
    strategies: ["lower_glycemic", "calorie_conscious", "high_protein_balanced", "lower_sodium", "balanced_maintenance"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: ["gluten"],
    fallbackName: "Vegetable Oats",
    fallbackReason: "Lower glycemic load and rich in soluble beta-glucan fiber.",
    fallbackBenefit: "Supports blood sugar management and postprandial glucose stability.",
    reasonCodes: {
      lower_glycemic: {
        reasonCode: "diet.meal.vegetableOats.reasonGlycemic",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitGlycemic",
      },
      calorie_conscious: {
        reasonCode: "diet.meal.vegetableOats.reasonCalorie",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitCalorie",
      },
      high_protein_balanced: {
        reasonCode: "diet.meal.vegetableOats.reasonLipid",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitLipid",
      },
      lower_sodium: {
        reasonCode: "diet.meal.vegetableOats.reasonSodium",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitSodium",
      },
      balanced_maintenance: {
        reasonCode: "diet.meal.vegetableOats.reasonBalanced",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitBalanced",
      },
      lower_glycemic_lower_sodium: {
        reasonCode: "diet.meal.vegetableOats.reasonGlycemic",
        expectedBenefitCode: "diet.meal.vegetableOats.benefitGlycemic",
      },
    },
  },
  {
    code: "moong_dal_chilla",
    course: "breakfast",
    strategies: ["lower_glycemic", "calorie_conscious", "balanced_maintenance", "lower_sodium"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    fallbackName: "Moong Dal Chilla",
    fallbackReason: "High plant-based protein with a low glycemic index.",
    fallbackBenefit: "Prevents glucose spikes and stabilizes insulin response.",
    reasonCodes: {
      lower_glycemic: {
        reasonCode: "diet.meal.moongDalChilla.reasonGlycemic",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitGlycemic",
      },
      calorie_conscious: {
        reasonCode: "diet.meal.moongDalChilla.reasonCalorie",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitCalorie",
      },
      high_protein_balanced: {
        reasonCode: "diet.meal.moongDalChilla.reasonGlycemic",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitGlycemic",
      },
      lower_sodium: {
        reasonCode: "diet.meal.moongDalChilla.reasonGlycemic",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitGlycemic",
      },
      balanced_maintenance: {
        reasonCode: "diet.meal.moongDalChilla.reasonGlycemic",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitGlycemic",
      },
      lower_glycemic_lower_sodium: {
        reasonCode: "diet.meal.moongDalChilla.reasonGlycemic",
        expectedBenefitCode: "diet.meal.moongDalChilla.benefitGlycemic",
      },
    },
  },
  {
    code: "dal_tadka_brown_rice",
    course: "lunch",
    strategies: ["lower_glycemic", "calorie_conscious", "high_protein_balanced", "lower_sodium", "balanced_maintenance"],
    types: ["vegetarian", "vegan"],
    contains: ["onion", "garlic"],
    fallbackName: "Dal Tadka with Brown Rice and Cucumber Salad",
    fallbackReason: "Brown rice provides complex starch paired with high-protein yellow lentils.",
    fallbackBenefit: "Moderates postprandial glucose rise.",
    reasonCodes: {
      lower_glycemic: {
        reasonCode: "diet.meal.dalTadka.reasonGlycemic",
        expectedBenefitCode: "diet.meal.dalTadka.benefitGlycemic",
      },
      calorie_conscious: {
        reasonCode: "diet.meal.dalTadka.reasonCalorie",
        expectedBenefitCode: "diet.meal.dalTadka.benefitCalorie",
      },
      high_protein_balanced: {
        reasonCode: "diet.meal.dalTadka.reasonGlycemic",
        expectedBenefitCode: "diet.meal.dalTadka.benefitGlycemic",
      },
      lower_sodium: {
        reasonCode: "diet.meal.dalTadka.reasonGlycemic",
        expectedBenefitCode: "diet.meal.dalTadka.benefitGlycemic",
      },
      balanced_maintenance: {
        reasonCode: "diet.meal.dalTadka.reasonGlycemic",
        expectedBenefitCode: "diet.meal.dalTadka.benefitGlycemic",
      },
      lower_glycemic_lower_sodium: {
        reasonCode: "diet.meal.dalTadka.reasonGlycemic",
        expectedBenefitCode: "diet.meal.dalTadka.benefitGlycemic",
      },
    },
  },
  {
    code: "roasted_makhana",
    course: "snacks",
    strategies: ["lower_glycemic", "calorie_conscious", "high_protein_balanced", "lower_sodium", "balanced_maintenance"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    fallbackName: "Roasted Makhana (Lotus Seeds)",
    fallbackReason: "Low glycemic index puffed water lily seeds.",
    fallbackBenefit: "Prevents afternoon blood glucose dips and spikes.",
    reasonCodes: {
      lower_glycemic: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
      calorie_conscious: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
      high_protein_balanced: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
      lower_sodium: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
      balanced_maintenance: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
      lower_glycemic_lower_sodium: {
        reasonCode: "diet.meal.makhana.reasonGlycemic",
        expectedBenefitCode: "diet.meal.makhana.benefitGlycemic",
      },
    },
  },
  {
    code: "khichdi_steamed_veg",
    course: "dinner",
    strategies: ["lower_glycemic", "calorie_conscious", "high_protein_balanced", "lower_sodium", "balanced_maintenance"],
    types: ["vegetarian", "vegan", "satvik", "jain", "no-onion-garlic"],
    contains: [],
    fallbackName: "Moong Dal Khichdi with Steamed Vegetables",
    fallbackReason: "Light, easily digestible lentil and rice porridge.",
    fallbackBenefit: "Prevents nocturnal glucose spikes and improves sleep.",
    reasonCodes: {
      lower_glycemic: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
      calorie_conscious: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
      high_protein_balanced: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
      lower_sodium: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
      balanced_maintenance: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
      lower_glycemic_lower_sodium: {
        reasonCode: "diet.meal.khichdi.reasonGlycemic",
        expectedBenefitCode: "diet.meal.khichdi.benefitGlycemic",
      },
    },
  },
];

export function selectDietStrategy(input: DietEngineInput): { strategyCode: DietStrategyCode; strategyReasonCode: string; strategy: string; strategyReason: string } {
  const p = input || {};

  let bmi = p.bmi;
  if (!bmi && typeof p.heightCm === "number" && p.heightCm > 0 && typeof p.weightKg === "number" && p.weightKg > 0) {
    bmi = Number((p.weightKg / Math.pow(p.heightCm / 100, 2)).toFixed(1));
  }

  const fastingGlucose = p.fastingBloodSugar;
  const hba1c = p.hba1c;
  const systolic = p.systolic;
  const diastolic = p.diastolic;

  const isDiabeticRisk =
    p.diabetesRiskCategory === "high" ||
    p.diabetesRiskCategory === "moderate" ||
    (typeof fastingGlucose === "number" && fastingGlucose >= 100) ||
    (typeof hba1c === "number" && hba1c >= 5.7) ||
    (p.priorities || []).some((item) => item.id === "glycemic-control");

  const isHypRisk =
    p.hypertensionRiskCategory === "high" ||
    p.hypertensionRiskCategory === "moderate" ||
    (typeof systolic === "number" && systolic >= 130) ||
    (typeof diastolic === "number" && diastolic >= 85) ||
    (p.priorities || []).some((item) => item.id === "hypertension-management");

  if (isDiabeticRisk && isHypRisk) {
    return {
      strategyCode: "lower_glycemic_lower_sodium",
      strategyReasonCode: "diet.strategy.reasonLowerGlycemicLowerSodium",
      strategy: "Lower Glycemic & Lower Sodium",
      strategyReason: "Combined elevated glucose and blood pressure screening markers require dual glycemic and sodium control.",
    };
  }

  if (isDiabeticRisk) {
    return {
      strategyCode: "lower_glycemic",
      strategyReasonCode: "diet.strategy.reasonLowerGlycemic",
      strategy: "Low Glycemic",
      strategyReason: "Elevated glycemic screening markers or glucose levels indicate need for glycemic load management.",
    };
  }

  if (isHypRisk) {
    return {
      strategyCode: "lower_sodium",
      strategyReasonCode: "diet.strategy.reasonLowerSodium",
      strategy: "Low Sodium",
      strategyReason: "Elevated blood pressure readings or hypertension screening require a sodium-restricted DASH-oriented diet.",
    };
  }

  const isHighBmi = (typeof bmi === "number" && bmi >= 25) || (p.priorities || []).some((item) => item.id === "weight-management");
  if (isHighBmi) {
    return {
      strategyCode: "calorie_conscious",
      strategyReasonCode: "diet.strategy.reasonCalorieConscious",
      strategy: "Calorie Deficit",
      strategyReason: "BMI in overweight/obesity range requires a structured energy deficit strategy.",
    };
  }

  const isLipidRisk = (typeof p.totalCholesterol === "number" && p.totalCholesterol >= 200) || (typeof p.ldl === "number" && p.ldl >= 130);
  if (isLipidRisk) {
    return {
      strategyCode: "high_protein_balanced",
      strategyReasonCode: "diet.strategy.reasonHighProteinBalanced",
      strategy: "Heart-Healthy / Lipid Control",
      strategyReason: "Elevated lipid panel markers call for a low saturated fat, soluble-fiber rich strategy.",
    };
  }

  return {
    strategyCode: "balanced_maintenance",
    strategyReasonCode: "diet.strategy.reasonBalancedMaintenance",
    strategy: "Balanced Wellness",
    strategyReason: "Physiological markers are within normal range; maintaining nutrient balance and metabolic health.",
  };
}

export function isMealConstraintCompliant(meal: MealTemplate, input: DietEngineInput): boolean {
  const pref = (input.dietType || "vegetarian").toLowerCase();

  if (pref === "vegetarian" || pref === "satvik" || pref === "jain" || pref === "no-onion-garlic") {
    if (meal.types.includes("non-vegetarian") || meal.types.includes("eggetarian")) return false;
    if (meal.contains.includes("chicken") || meal.contains.includes("fish") || meal.contains.includes("meat") || meal.contains.includes("eggs")) return false;
  }

  if (pref === "vegan") {
    if (!meal.types.includes("vegan")) return false;
    if (
      meal.contains.includes("milk") ||
      meal.contains.includes("paneer") ||
      meal.contains.includes("curd") ||
      meal.contains.includes("ghee") ||
      meal.contains.includes("cheese") ||
      meal.contains.includes("lactose") ||
      meal.contains.includes("eggs") ||
      meal.contains.includes("fish") ||
      meal.contains.includes("chicken")
    ) {
      return false;
    }
  }

  if (pref === "jain") {
    if (!meal.types.includes("jain")) return false;
    if (meal.contains.includes("onion") || meal.contains.includes("garlic") || meal.contains.includes("root-vegetables")) return false;
  }

  if (pref === "satvik" || pref === "no-onion-garlic") {
    if (meal.contains.includes("onion") || meal.contains.includes("garlic")) return false;
  }

  if (pref === "eggetarian") {
    if (meal.types.includes("non-vegetarian") || meal.contains.includes("chicken") || meal.contains.includes("fish")) return false;
  }

  const hasLactoseIntolerance =
    input.lactoseIntolerant === true ||
    (input.allergies || []).some((a) => a.toLowerCase().includes("lactose") || a.toLowerCase().includes("dairy") || a.toLowerCase().includes("milk")) ||
    (input.foodAllergies || "").toLowerCase().includes("lactose") ||
    (input.foodAllergies || "").toLowerCase().includes("dairy") ||
    (input.foodAllergies || "").toLowerCase().includes("milk");

  if (hasLactoseIntolerance) {
    if (
      meal.contains.includes("milk") ||
      meal.contains.includes("paneer") ||
      meal.contains.includes("curd") ||
      meal.contains.includes("ghee") ||
      meal.contains.includes("cheese") ||
      meal.contains.includes("lactose")
    ) {
      return false;
    }
  }

  const allExclusions: string[] = [
    ...(input.allergies || []),
    ...(input.excludedFoods || []),
    ...(input.foodAllergies ? input.foodAllergies.split(",").map((s) => s.trim()) : []),
  ].map((s) => s.toLowerCase()).filter(Boolean);

  for (const exclusion of allExclusions) {
    if (meal.contains.some((ingredient) => ingredient.toLowerCase() === exclusion)) {
      return false;
    }
    if (meal.code.toLowerCase().includes(exclusion)) {
      return false;
    }
  }

  return true;
}

export function populateMealForCourse(
  course: "breakfast" | "lunch" | "snacks" | "dinner",
  strategyCode: DietStrategyCode,
  input: DietEngineInput
): MealRecommendation {
  const matches = REUSABLE_MEAL_CATALOG.filter((meal) => {
    if (meal.course !== course) return false;
    if (!meal.strategies.includes(strategyCode) && !meal.strategies.includes("balanced_maintenance")) return false;
    return isMealConstraintCompliant(meal, input);
  });

  if (matches.length === 0) {
    const anyCompliant = REUSABLE_MEAL_CATALOG.filter((meal) => meal.course === course && isMealConstraintCompliant(meal, input));
    if (anyCompliant.length === 0) {
      return FALLBACK_MEAL;
    }
    const selected = anyCompliant[0];
    const reasoning = selected.reasonCodes[strategyCode] || selected.reasonCodes["balanced_maintenance"];
    return {
      mealCode: `diet.meal.${selected.code}.name`,
      reasonCode: reasoning.reasonCode,
      expectedBenefitCode: reasoning.expectedBenefitCode,
      meal: selected.fallbackName,
      reason: selected.fallbackReason,
      expectedBenefit: selected.fallbackBenefit,
    };
  }

  const selected = matches[0];
  const reasoning = selected.reasonCodes[strategyCode] || selected.reasonCodes["balanced_maintenance"];

  return {
    mealCode: `diet.meal.${selected.code}.name`,
    reasonCode: reasoning.reasonCode,
    expectedBenefitCode: reasoning.expectedBenefitCode,
    meal: selected.fallbackName,
    reason: selected.fallbackReason,
    expectedBenefit: selected.fallbackBenefit,
  };
}

export function generateDietPlan(input: DietEngineInput): DietEngineOutput {
  const { strategyCode, strategyReasonCode, strategy, strategyReason } = selectDietStrategy(input);

  const breakfast = populateMealForCourse("breakfast", strategyCode, input);
  const lunch = populateMealForCourse("lunch", strategyCode, input);
  const snacks = populateMealForCourse("snacks", strategyCode, input);
  const dinner = populateMealForCourse("dinner", strategyCode, input);

  return {
    strategyCode,
    strategyReasonCode,
    strategy,
    strategyReason,
    meals: {
      breakfast,
      lunch,
      snacks,
      dinner,
    },
    constraintsApplied: {
      dietType: input.dietType || "vegetarian",
      allergies: input.allergies || [],
      exclusions: input.excludedFoods || [],
    },
  };
}
