import { describe, it, expect } from "vitest";
import { generateDietPlan, isMealConstraintCompliant, REUSABLE_MEAL_CATALOG } from "./diet-engine";
import { generateWorkoutPlan, isExerciseContraindicated } from "./workout-engine";
import { generateHealthPriorities } from "./priority-engine";
import { generateExplainedRecommendations } from "./recommendation-explanation-engine";

describe("Deep Action Plan Personalization Engine Suite", () => {
  it("differs recommendations based on BMI (High BMI vs Normal BMI)", () => {
    const normalInput = { age: 30, bmi: 22, heightCm: 175, weightKg: 67, activity: "moderate" };
    const obeseInput = { age: 30, bmi: 32, heightCm: 170, weightKg: 93, activity: "none" };

    const normalPriorities = generateHealthPriorities(normalInput);
    const obesePriorities = generateHealthPriorities(obeseInput);

    expect(normalPriorities.some((p) => p.id === "weight-maintenance")).toBe(true);
    expect(obesePriorities.some((p) => p.id === "weight-management")).toBe(true);

    const normalDiet = generateDietPlan(normalInput);
    const obeseDiet = generateDietPlan(obeseInput);

    expect(normalDiet.strategy).toBe("Balanced Wellness");
    expect(obeseDiet.strategy).toBe("Calorie Deficit");
    expect(obeseDiet.strategyReason.toLowerCase()).toContain("deficit");

    const normalWorkout = generateWorkoutPlan(normalInput);
    const obeseWorkout = generateWorkoutPlan(obeseInput);

    expect(normalWorkout.weeks.week1[0].exercise).toContain("Walking");
    expect(obeseWorkout.weeks.week1[0].exercise).toContain("Cycling");
  });

  it("differs recommendations based on Activity level (Sedentary vs Active)", () => {
    const sedentaryInput = { age: 40, bmi: 24, activity: "none", workoutDaysPerWeek: 0 };
    const activeInput = { age: 40, bmi: 24, activity: "active", workoutDaysPerWeek: 5 };

    const sedentaryWorkout = generateWorkoutPlan(sedentaryInput);
    const activeWorkout = generateWorkoutPlan(activeInput);

    expect(sedentaryWorkout.weeks.week1[0].reason).toBe("Low reported physical activity.");
    expect(sedentaryWorkout.weeks.week1[0].duration).toBe("15 min");

    expect(activeWorkout.weeks.week1[0].exercise).toContain("Progressive Resistance Training");
    expect(activeWorkout.weeks.week1[0].duration).toBe("25 min");
    expect(activeWorkout.weeks.week1[0].reason).toContain("Active physical activity level");
  });

  it("differs recommendations based on Smoking status (Current Smoker vs Non-Smoker)", () => {
    const smokerInput = { age: 35, bmi: 24, smoking: "current" };
    const nonSmokerInput = { age: 35, bmi: 24, smoking: "never" };

    const smokerPriorities = generateHealthPriorities(smokerInput);
    const nonSmokerPriorities = generateHealthPriorities(nonSmokerInput);

    expect(smokerPriorities.some((p) => p.id === "smoking-cessation")).toBe(true);
    expect(nonSmokerPriorities.some((p) => p.id === "smoking-cessation")).toBe(false);

    const smokerRecs = generateExplainedRecommendations(smokerInput);
    expect(smokerRecs.some((r) => r.id === "stop-smoking")).toBe(true);
  });

  it("differs recommendations based on Family History", () => {
    const familyHistoryInput = { age: 35, bmi: 24, familyHistory: "type 2 diabetes and hypertension" };
    const noFamilyHistoryInput = { age: 35, bmi: 24, familyHistory: "" };

    const fhPriorities = generateHealthPriorities(familyHistoryInput);
    const noFhPriorities = generateHealthPriorities(noFamilyHistoryInput);

    expect(fhPriorities.some((p) => p.id === "family-history-prevention")).toBe(true);
    expect(noFhPriorities.some((p) => p.id === "family-history-prevention")).toBe(false);

    const fhRecs = generateExplainedRecommendations(familyHistoryInput);
    expect(fhRecs.some((r) => r.id === "family-history-review")).toBe(true);
  });

  it("differs recommendations based on Symptoms (Joint pain vs Chest pain)", () => {
    const jointPainInput = { age: 45, bmi: 25, symptoms: "knee pain when walking" };
    const chestPainInput = { age: 45, bmi: 25, symptoms: "acute chest pain and dizziness" };

    const jointWorkout = generateWorkoutPlan(jointPainInput);
    expect(jointWorkout.weeks.week1[0].exercise).toContain("Gentle Hatha Yoga");

    const chestWorkout = generateWorkoutPlan(chestPainInput);
    expect(chestWorkout.status).toBe("contraindicated");
    expect(chestWorkout.weeks.week1[0].exercise).toBe("No safe exercise recommendation available.");
  });

  it("differs recommendations based on Diabetes Screening risk", () => {
    const lowRiskInput = { age: 45, bmi: 23, diabetesRiskCategory: "low" as const };
    const highRiskInput = { age: 45, bmi: 23, diabetesRiskCategory: "high" as const, hba1c: 6.2 };

    const lowDiet = generateDietPlan(lowRiskInput);
    const highDiet = generateDietPlan(highRiskInput);

    expect(lowDiet.strategy).toBe("Balanced Wellness");
    expect(highDiet.strategy).toBe("Low Glycemic");
    expect(highDiet.strategyReason).toContain("glycemic");
  });

  it("differs recommendations based on Hypertension Screening risk", () => {
    const lowRiskInput = { age: 50, bmi: 24, hypertensionRiskCategory: "low" as const };
    const highRiskInput = { age: 50, bmi: 24, hypertensionRiskCategory: "high" as const, systolic: 145 };

    const lowDiet = generateDietPlan(lowRiskInput);
    const highDiet = generateDietPlan(highRiskInput);

    expect(lowDiet.strategy).toBe("Balanced Wellness");
    expect(highDiet.strategy).toBe("Low Sodium");
    expect(highDiet.strategyReason).toContain("sodium");
  });

  it("strictly enforces Dietary Preferences (Vegetarian vs Vegan vs Jain)", () => {
    const paneerMeal = REUSABLE_MEAL_CATALOG.find((m) => m.name.includes("Paneer"))!;
    const onionMeal = REUSABLE_MEAL_CATALOG.find((m) => m.contains.includes("onion"))!;

    expect(isMealConstraintCompliant(paneerMeal, { dietType: "vegetarian" })).toBe(true);
    expect(isMealConstraintCompliant(paneerMeal, { dietType: "vegan" })).toBe(false);

    expect(isMealConstraintCompliant(onionMeal, { dietType: "vegetarian" })).toBe(true);
    expect(isMealConstraintCompliant(onionMeal, { dietType: "jain" })).toBe(false);
  });

  it("strictly enforces Nut Allergies (excludes all nut/peanut meals)", () => {
    const nutMeal = {
      name: "Roasted Peanut and Seed Mix",
      course: "snacks" as const,
      strategies: ["Balanced Wellness"],
      types: ["vegetarian"],
      contains: ["peanuts"],
      reasons: { "Balanced Wellness": { reason: "Nutrient snack", expectedBenefit: "Energy" } },
    };

    expect(isMealConstraintCompliant(nutMeal, { allergies: ["peanuts"] })).toBe(false);
    expect(isMealConstraintCompliant(nutMeal, { foodAllergies: "Nut Allergy" })).toBe(false);
  });

  it("differs recommendations when Missing Evidence exists", () => {
    const completeInput = { age: 30, bmi: 22, systolic: 120, diastolic: 80, labObservations: [{ code: "fastingBloodSugar", value: 85 }] };
    const missingInput = { age: 30, bmi: 22, missingEvidence: ["missing blood pressure reading", "missing blood report data"] };

    const missingPriorities = generateHealthPriorities(missingInput);
    expect(missingPriorities.some((p) => p.id === "missing-evidence-completion")).toBe(true);

    const missingRecs = generateExplainedRecommendations(missingInput);
    expect(missingRecs.some((r) => r.id === "complete-missing-evidence")).toBe(true);
  });

  it("generates weekly meal variation across Mon-Sun without static repetition", () => {
    const input = { age: 35, bmi: 24, dietType: "vegetarian" };
    const plan = generateDietPlan(input);

    const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const breakfastNames = weekdays.map((day) => plan.weeklyPlan[day].breakfast.meal);

    const uniqueBreakfasts = new Set(breakfastNames);
    expect(uniqueBreakfasts.size).toBeGreaterThan(1);
  });

  it("generates progressive 4-week workout plan featuring Walking, Mobility, Resistance, and Balance", () => {
    const input = { age: 35, bmi: 24, activity: "none" };
    const workout = generateWorkoutPlan(input);

    expect(workout.weeks.week1[0].exercise).toContain("Walking");

    const w2Exercises = workout.weeks.week2.map((e) => e.exercise);
    expect(w2Exercises.some((name) => name.toLowerCase().includes("mobility") || name.toLowerCase().includes("yoga"))).toBe(true);

    const w3Exercises = workout.weeks.week3.map((e) => e.exercise);
    expect(w3Exercises.some((name) => name.toLowerCase().includes("resistance") || name.toLowerCase().includes("squats"))).toBe(true);

    const w4Exercises = workout.weeks.week4.map((e) => e.exercise);
    expect(w4Exercises.some((name) => name.toLowerCase().includes("balance") || name.toLowerCase().includes("stability"))).toBe(true);
  });
});
