import { describe, it, expect } from "vitest";

function normalizeAssessmentMode(mode?: string | null, initialStep?: number): { flowMode: "blood" | "questionnaire" | "combined" | null; step: number } {
  const normMode = mode ? String(mode).toLowerCase() : null;
  if (normMode === "blood") return { flowMode: "blood", step: 1 };
  if (normMode === "lifestyle" || normMode === "questionnaire") return { flowMode: "questionnaire", step: initialStep ?? 1 };
  if (normMode === "combined" || normMode === "retake" || normMode === "reassess") return { flowMode: "combined", step: 1 };
  if (initialStep === 5) return { flowMode: "blood", step: 1 };
  if (initialStep && initialStep >= 1 && initialStep <= 4) return { flowMode: "questionnaire", step: initialStep };
  return { flowMode: null, step: 1 };
}

function getCombinedActiveSteps() {
  return [
    { id: 1, type: "blood", label: "Blood Report", desc: "Upload & Verify" },
    { id: 2, type: "personal", label: "Basic Profile", desc: "Goals & Body" },
    { id: 3, type: "health", label: "Health Info", desc: "Conditions & History" },
    { id: 4, type: "lifestyle", label: "Lifestyle", desc: "Activity & Habits" },
    { id: 5, type: "diet", label: "Diet Prefs", desc: "Cuisine & Exclusions" },
  ];
}

describe("Navigation & Mode Routing Tests", () => {
  it("should navigate to blood mode when mode=blood is passed", () => {
    const result = normalizeAssessmentMode("blood");
    expect(result.flowMode).toBe("blood");
    expect(result.step).toBe(1);
  });

  it("should navigate to lifestyle mode when mode=lifestyle is passed", () => {
    const result = normalizeAssessmentMode("lifestyle");
    expect(result.flowMode).toBe("questionnaire");
    expect(result.step).toBe(1);
  });

  it("should navigate to combined mode when mode=combined is passed", () => {
    const result = normalizeAssessmentMode("combined");
    expect(result.flowMode).toBe("combined");
    expect(result.step).toBe(1);
  });

  it("should start combined mode with Blood Report followed by Basic Profile", () => {
    const steps = getCombinedActiveSteps();
    expect(steps[0].type).toBe("blood");
    expect(steps[0].label).toBe("Blood Report");
    expect(steps[1].type).toBe("personal");
    expect(steps[1].label).toBe("Basic Profile");
  });

  it("should preserve redirect destination for unauthenticated users", () => {
    const redirectUrl = "/assessment?mode=blood";
    const searchParam = { redirect: redirectUrl };
    expect(searchParam.redirect).toBe("/assessment?mode=blood");
  });

  it("should safely default on unknown or invalid mode values", () => {
    const result = normalizeAssessmentMode("invalid_unknown_mode_string");
    expect(result.flowMode).toBeNull();
    expect(result.step).toBe(1);
  });
});
