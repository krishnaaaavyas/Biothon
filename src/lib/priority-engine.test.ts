import { describe, it, expect } from "vitest";
import { generateHealthPriorities, type HealthPriority } from "./priority-engine";

describe("Deterministic Priority Engine", () => {
  it("generates correct obesity priorities for BMI >= 30", () => {
    const priorities = generateHealthPriorities({
      heightCm: 170,
      weightKg: 90, // BMI = 31.1
      familyHistory: "Diabetes in family",
    });

    const weightPriority = priorities.find((p) => p.id === "weight-management");
    expect(weightPriority).toBeDefined();
    expect(weightPriority?.severity).toBe("high");
    expect(weightPriority?.expectedBenefit).toBe("high");
    expect(weightPriority?.category).toBe("lifestyle");
    expect(weightPriority?.evidence).toContain("BMI 31.1 (Class I/II Obesity)");
    expect(weightPriority?.reason).toContain("obesity range");
  });

  it("generates correct hypertension priorities when blood pressure is elevated", () => {
    const priorities = generateHealthPriorities({
      systolic: 142,
      diastolic: 92,
      hypertensionRiskCategory: "high",
    });

    const bpPriority = priorities.find((p) => p.id === "hypertension-management");
    expect(bpPriority).toBeDefined();
    expect(bpPriority?.severity).toBe("high");
    expect(bpPriority?.expectedBenefit).toBe("high");
    expect(bpPriority?.category).toBe("screening");
    expect(bpPriority?.evidence).toContain("blood pressure 142/92 mmHg");
    expect(bpPriority?.evidence).toContain("high hypertension screening");
  });

  it("generates correct diabetes glycemic priorities when fasting glucose or HbA1c is elevated", () => {
    const priorities = generateHealthPriorities({
      labObservations: [
        { code: "fastingBloodSugar", value: 130 },
        { code: "HbA1c", value: 6.7 },
      ],
      diabetesRiskCategory: "high",
    });

    const diabPriority = priorities.find((p) => p.id === "glycemic-control");
    expect(diabPriority).toBeDefined();
    expect(diabPriority?.severity).toBe("high");
    expect(diabPriority?.expectedBenefit).toBe("high");
    expect(diabPriority?.category).toBe("screening");
    expect(diabPriority?.evidence).toContain("fasting glucose 130 mg/dL");
    expect(diabPriority?.evidence).toContain("HbA1c 6.7%");
  });

  it("handles combined multi-risk inputs and sorts priorities descending by severity and benefit", () => {
    const priorities = generateHealthPriorities({
      heightCm: 170,
      weightKg: 92, // BMI 31.8 (obesity) -> High severity
      exercise: "none", // Sedentary -> High severity
      smoking: "current", // Smoker -> High severity
      alcohol: "heavy", // Heavy alcohol -> High severity
      systolic: 145,
      diastolic: 95, // High BP -> High severity
      labObservations: [{ code: "fastingBloodSugar", value: 135 }], // High glucose -> High severity
    });

    expect(priorities.length).toBeGreaterThanOrEqual(5);

    // Verify all top priorities have high severity
    for (let i = 0; i < 4; i++) {
      expect(priorities[i].severity).toBe("high");
    }

    // Verify descending sort invariants
    const severityMap = { high: 3, moderate: 2, low: 1 };
    for (let i = 0; i < priorities.length - 1; i++) {
      const currentSev = severityMap[priorities[i].severity];
      const nextSev = severityMap[priorities[i + 1].severity];
      expect(currentSev).toBeGreaterThanOrEqual(nextSev);
    }
  });

  it("generates missing evidence priorities when BP or lab report is missing", () => {
    const priorities = generateHealthPriorities({
      age: 40,
      gender: "male",
      heightCm: 175,
      weightKg: 75,
      missingEvidence: ["missing blood pressure reading", "missing blood report data"],
    });

    const missingPriority = priorities.find((p) => p.id === "missing-evidence-completion");
    expect(missingPriority).toBeDefined();
    expect(missingPriority?.category).toBe("prevention");
    expect(missingPriority?.evidence).toContain("missing blood pressure reading");
    expect(missingPriority?.evidence).toContain("missing blood report data");
  });

  it("safeguards: never recommends impossible actions", () => {
    // Non-smoker, non-drinker, active user, normal BMI (22.5)
    const priorities = generateHealthPriorities({
      age: 28,
      gender: "female",
      heightCm: 165,
      weightKg: 61, // BMI = 22.4 (Normal)
      exercise: "active",
      workoutDaysPerWeek: 5,
      smoking: "never",
      alcohol: "never",
      systolic: 115,
      diastolic: 75,
    });

    // Impossible action checks
    expect(priorities.find((p) => p.id === "smoking-cessation")).toBeUndefined();
    expect(priorities.find((p) => p.id === "alcohol-moderation")).toBeUndefined();
    expect(priorities.find((p) => p.id === "increase-physical-activity")).toBeUndefined();
    expect(priorities.find((p) => p.id === "weight-management")).toBeUndefined();
  });

  it("safeguards: never creates contradictory priorities for single input", () => {
    const priorities = generateHealthPriorities({
      smoking: "current",
      exercise: "none",
    });

    const smokingPriority = priorities.filter((p) => p.id === "smoking-cessation");
    expect(smokingPriority.length).toBe(1);

    const activityPriority = priorities.filter((p) => p.id === "increase-physical-activity");
    expect(activityPriority.length).toBe(1);
  });

  it("ensures every priority strictly conforms to required schema fields", () => {
    const priorities = generateHealthPriorities({
      heightCm: 170,
      weightKg: 95,
      smoking: "current",
      exercise: "none",
    });

    priorities.forEach((p) => {
      expect(typeof p.id).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(["high", "moderate", "low"]).toContain(p.severity);
      expect(Array.isArray(p.evidence)).toBe(true);
      expect(p.evidence.length).toBeGreaterThan(0);
      expect(typeof p.reason).toBe("string");
      expect(p.reason.length).toBeGreaterThan(5);
      expect(["high", "moderate", "low"]).toContain(p.expectedBenefit);
      expect(["lifestyle", "screening", "medical-verification", "habit", "prevention"]).toContain(p.category);
    });
  });
});
