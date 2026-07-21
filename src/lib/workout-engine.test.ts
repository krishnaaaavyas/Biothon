import { describe, it, expect } from "vitest";
import {
  generateWorkoutPlan,
  isExerciseContraindicated,
  UNSAFE_FALLBACK_RECOMMENDATION,
} from "./workout-engine";

describe("Deterministic Workout Recommendation Engine", () => {
  it("generates a progressive 4-week workout plan for a sedentary user", () => {
    const output = generateWorkoutPlan({
      activity: "none",
      age: 42,
      bmi: 27.5,
    });

    expect(output.status).toBe("safe");
    expect(output.weeks).toBeDefined();

    const { week1, week2, week3, week4 } = output.weeks;

    expect(week1.length).toBeGreaterThan(0);
    expect(week2.length).toBeGreaterThan(0);
    expect(week3.length).toBeGreaterThan(0);
    expect(week4.length).toBeGreaterThan(0);

    // Verify progression in primary exercise duration from Week 1 to Week 4
    const w1Duration = parseInt(week1[0].duration);
    const w2Duration = parseInt(week2[0].duration);
    const w3Duration = parseInt(week3[0].duration);
    const w4Duration = parseInt(week4[0].duration);

    expect(w2Duration).toBeGreaterThan(w1Duration);
    expect(w3Duration).toBeGreaterThan(w2Duration);
    expect(w4Duration).toBeGreaterThan(w3Duration);
  });

  it("assigns diabetic-specific clinical reasons and benefits for diabetic profiles", () => {
    const output = generateWorkoutPlan({
      activity: "none",
      diabetesRiskCategory: "high",
      fastingBloodSugar: 128,
    });

    const w1Ex = output.weeks.week1[0];
    expect(w1Ex.reason).toContain("glycemic screening");
    expect(w1Ex.expectedBenefit).toContain("insulin sensitivity");
  });

  it("assigns hypertensive-specific clinical reasons and benefits for hypertensive profiles", () => {
    const output = generateWorkoutPlan({
      activity: "none",
      systolic: 145,
      diastolic: 92,
      hypertensionRiskCategory: "moderate",
    });

    const w1Ex = output.weeks.week1[0];
    expect(w1Ex.reason).toContain("blood pressure screening");
    expect(w1Ex.expectedBenefit).toContain("vascular resistance");
  });

  it("assigns low-impact joint-friendly exercises for obese users (BMI >= 30)", () => {
    const output = generateWorkoutPlan({
      heightCm: 170,
      weightKg: 95, // BMI = 32.9 (Obesity)
      activity: "none",
    });

    const w1Ex = output.weeks.week1[0];
    expect(w1Ex.exercise).toContain("Cycling");
    expect(w1Ex.reason).toContain("obesity range");
    expect(w1Ex.expectedBenefit).toContain("caloric expenditure");
  });

  it("safeguard: returns 'No safe exercise recommendation available.' when acute chest pain or dizziness is reported", () => {
    const output = generateWorkoutPlan({
      symptoms: "chest pain and severe dizziness",
      activity: "none",
    });

    expect(output.status).toBe("contraindicated");

    const { week1, week2, week3, week4 } = output.weeks;

    [week1, week2, week3, week4].forEach((week) => {
      expect(week[0].exercise).toBe("No safe exercise recommendation available.");
      expect(week[0].duration).toBe("0 min");
      expect(week[0].frequency).toBe("0 days/week");
      expect(week[0].reason).toContain("contraindicate");
      expect(week[0].expectedBenefit).toContain("clinical evaluation");
    });
  });

  it("safeguard: returns 'No safe exercise recommendation available.' when severe blood pressure >= 180/110 is present", () => {
    const output = generateWorkoutPlan({
      systolic: 185,
      diastolic: 115,
      activity: "light",
    });

    expect(output.status).toBe("contraindicated");
    expect(output.weeks.week1[0].exercise).toBe("No safe exercise recommendation available.");
  });

  it("safeguard: excludes high-impact exercises for users reporting knee or joint pain", () => {
    const output = generateWorkoutPlan({
      symptoms: "knee pain and joint stiffness",
      activity: "moderate",
    });

    expect(output.status).toBe("safe");

    const allExercises = [
      ...output.weeks.week1,
      ...output.weeks.week2,
      ...output.weeks.week3,
      ...output.weeks.week4,
    ];

    allExercises.forEach((ex) => {
      expect(ex.exercise).not.toContain("Jump Squats");
      expect(ex.exercise).not.toContain("High-Impact");
    });
  });

  it("ensures every exercise recommendation strictly contains exercise, duration, frequency, reason, and expectedBenefit", () => {
    const output = generateWorkoutPlan({
      age: 50,
      activity: "none",
    });

    const allExercises = [
      ...output.weeks.week1,
      ...output.weeks.week2,
      ...output.weeks.week3,
      ...output.weeks.week4,
    ];

    allExercises.forEach((ex) => {
      expect(typeof ex.exercise).toBe("string");
      expect(ex.exercise.length).toBeGreaterThan(0);
      expect(typeof ex.duration).toBe("string");
      expect(ex.duration.length).toBeGreaterThan(0);
      expect(typeof ex.frequency).toBe("string");
      expect(ex.frequency.length).toBeGreaterThan(0);
      expect(typeof ex.reason).toBe("string");
      expect(ex.reason.length).toBeGreaterThan(3);
      expect(typeof ex.expectedBenefit).toBe("string");
      expect(ex.expectedBenefit.length).toBeGreaterThan(3);
    });
  });

  it("guarantees 100% deterministic non-AI execution for identical inputs", () => {
    const input = {
      age: 45,
      bmi: 28,
      activity: "none",
      diabetesRiskCategory: "moderate",
    };

    const run1 = generateWorkoutPlan(input);
    const run2 = generateWorkoutPlan(input);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });
});
