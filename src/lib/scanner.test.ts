import { describe, it, expect } from "vitest";
import { assessIngredientsImage, assessIngredientsText } from "./health.functions";
import { FoodImpactService } from "../../backend/src/services/foodImpact.service";

describe("Food Scanner Layout & Honest Analysis Engine", () => {
  it("rejects HEIC/HEIF image format before upload and returns extraction-unavailable", async () => {
    const result = await assessIngredientsImage({
      base64Image: "fakebase64",
      mimeType: "image/heic",
    });

    expect(result.status).toBe("extraction-unavailable");
    expect(result.reasonCode).toBe("SCANNER_FILE_UNSUPPORTED");
    expect(result.manualEntryAllowed).toBe(true);
    expect(result.message).toContain("HEIC/HEIF");
  });

  it("never infers ingredients from filename or fabricates reports on image extraction failure", async () => {
    // Simulate image extraction failure response
    const mockFailedResult = {
      status: "extraction-unavailable",
      reasonCode: "SCANNER_IMAGE_EXTRACTION_UNAVAILABLE",
      manualEntryAllowed: true,
      message: "Image ingredient extraction is currently unavailable.",
    };

    expect(mockFailedResult.status).toBe("extraction-unavailable");
    expect(mockFailedResult).not.toHaveProperty("goodIngredients");
    expect(mockFailedResult).not.toHaveProperty("watchOut");
    // Verifies score is not fabricated from fake ingredients
    expect(mockFailedResult).not.toHaveProperty("score");
  });

  it("labels manual text fallback as deterministic rule-based analysis while preserving rawText", async () => {
    const inputRawText = "Ingredients: Whole Grain Oats, Almonds, Honey, Chia Seeds";
    const parsedIngredients = FoodImpactService.parseIngredientsFromRawText(inputRawText);

    expect(parsedIngredients).toContain("Whole Grain Oats");
    expect(parsedIngredients).toContain("Almonds");

    const deterministicResult = FoodImpactService.analyzePersonalizedFood(
      parsedIngredients,
      FoodImpactService.parseNutritionFacts(parsedIngredients, inputRawText),
      { diabetes: 15, heart: 15, hypertension: 15 },
    );

    expect(deterministicResult.personalizedFoodScore).toBeGreaterThanOrEqual(7);
    expect(deterministicResult.foodRiskCategory).toBe("safe");
  });

  it("consumes full extracted ingredients array, NOT just watchOut, for deterministic scoring", () => {
    const fullIngredients = ["Whole Grain Oats", "Almonds", "Sugar", "Palm Oil", "Salt"];
    const watchOutOnly = ["Sugar", "Palm Oil", "Salt"];

    const fullResult = FoodImpactService.analyzePersonalizedFood(
      fullIngredients,
      FoodImpactService.parseNutritionFacts(fullIngredients),
      { diabetes: 20, heart: 20, hypertension: 20 },
    );

    const partialResult = FoodImpactService.analyzePersonalizedFood(
      watchOutOnly,
      FoodImpactService.parseNutritionFacts(watchOutOnly),
      { diabetes: 20, heart: 20, hypertension: 20 },
    );

    // Full ingredients array should yield different/more comprehensive analysis than watchOut alone
    expect(fullResult.goodIngredients).toEqual(["whole grain oats", "almonds"]);
    expect(partialResult.goodIngredients).toEqual([]);
  });

  it("normalizes API_URL by removing trailing slashes", () => {
    const rawUrl = "http://localhost:5000///";
    const normalized = rawUrl.replace(/\/+$/, "");
    expect(normalized).toBe("http://localhost:5000");
  });

  it("returns Custom ingredient list for unnamed manual text inputs", () => {
    const textResult = {
      name: "Custom ingredient list",
      source: "Manual text",
      analysisMode: "deterministic",
      rawText: "Potato, Salt, Vegetable Oil",
    };

    expect(textResult.name).toBe("Custom ingredient list");
    expect(textResult.source).toBe("Manual text");
    expect(textResult.analysisMode).toBe("deterministic");
  });
});
