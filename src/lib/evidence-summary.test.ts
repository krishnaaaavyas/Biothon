import { describe, it, expect } from "vitest";
import {
  calculateEvidenceSummary,
  calculateProfileCompleteness,
} from "./evidence-summary";

describe("Evidence Summary Utility & Routing Contracts", () => {
  it("calculates score boundaries correctly (0-39 low, 40-69 moderate, 70-100 high)", () => {
    // Empty profile -> low
    const lowSummary = calculateEvidenceSummary({});
    expect(lowSummary.score).toBeLessThan(40);
    expect(lowSummary.quality).toBe("low");

    // Partial profile -> moderate
    const modSummary = calculateEvidenceSummary({
      age: 45,
      gender: "male",
      heightCm: 175,
      weightKg: 78,
      familyHistory: "Diabetes in father",
      exercise: "moderate",
    });
    expect(modSummary.score).toBeGreaterThanOrEqual(40);
    expect(modSummary.score).toBeLessThan(70);
    expect(modSummary.quality).toBe("moderate");

    // Comprehensive profile + confirmed labs -> high
    const highSummary = calculateEvidenceSummary(
      {
        age: 45,
        gender: "male",
        heightCm: 175,
        weightKg: 78,
        familyHistory: "Diabetes in father",
        exercise: "moderate",
        symptoms: "None",
        systolic: 120,
        diastolic: 80,
        labObservations: [
          { code: "fastingBloodSugar", value: 95 },
          { code: "totalCholesterol", value: 180 },
        ],
      },
      [
        { code: "fastingBloodSugar", value: 95 },
        { code: "totalCholesterol", value: 180 },
      ],
      ["fastingBloodSugar", "totalCholesterol"],
      "available",
      false
    );
    expect(highSummary.score).toBeGreaterThanOrEqual(70);
    expect(highSummary.quality).toBe("high");
    expect(highSummary.confidence).toBe("high");
  });

  it("evaluates High, Moderate, and Limited confidence levels correctly", () => {
    // High confidence
    const highConf = calculateEvidenceSummary(
      {
        age: 35,
        gender: "female",
        heightCm: 165,
        weightKg: 60,
        familyHistory: "None",
        exercise: "active",
        symptoms: "None",
        systolic: 118,
        diastolic: 76,
        labObservations: [{ code: "fastingBloodSugar", value: 90 }],
      },
      [{ code: "fastingBloodSugar", value: 90 }],
      ["fastingBloodSugar"],
      "available"
    );
    expect(highConf.confidence).toBe("high");

    // Moderate confidence
    const modConf = calculateEvidenceSummary({
      age: 35,
      gender: "female",
      heightCm: 165,
      weightKg: 60,
      familyHistory: "None",
      symptoms: "None",
      exercise: "active",
    });
    expect(modConf.confidence).toBe("moderate");

    // Limited confidence due to missing critical inputs
    const limConf = calculateEvidenceSummary({
      exercise: "active",
    });
    expect(limConf.confidence).toBe("limited");
  });

  it("lowers confidence when screening engine is unavailable without crashing", () => {
    const summary = calculateEvidenceSummary(
      {
        age: 35,
        gender: "female",
        heightCm: 165,
        weightKg: 60,
        familyHistory: "None",
        exercise: "active",
        symptoms: "None",
        systolic: 118,
        diastolic: 76,
      },
      [],
      [],
      "unavailable"
    );
    expect(summary.confidence).toBe("limited");
    expect(summary.reasons[0]).toContain("model engine is currently unavailable");
  });

  it("prioritizes missing evidence with Required items first and Useful items next", () => {
    const summary = calculateEvidenceSummary({
      exercise: "light",
    });
    expect(summary.criticalMissingEvidence).toContain("Age missing");
    expect(summary.criticalMissingEvidence).toContain("Gender missing");
    expect(summary.missingEvidence).toContain("Add a recent blood-pressure reading");
  });

  it("calculates 8-category Health Profile Completeness percentage", () => {
    const completeness = calculateProfileCompleteness({
      age: 30,
      gender: "male",
      heightCm: 180,
      weightKg: 75,
    });
    expect(completeness.categories.length).toBe(8);
    expect(completeness.completedSections).toContain("Basic details");
    expect(completeness.completedSections).toContain("Body measurements");
    expect(completeness.missingSections).toContain("Blood pressure");
    expect(completeness.percentage).toBe(25); // 2 out of 8 complete
  });

  it("does not count hidden demographic defaults as user evidence", () => {
    const summaryNoUserInputs = calculateEvidenceSummary(null, []);
    expect(summaryNoUserInputs.score).toBe(0);
    expect(summaryNoUserInputs.completedEvidence.length).toBe(0);
  });
});
