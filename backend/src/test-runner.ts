import { RiskService } from "./services/risk.service.js";
import { MlRiskService } from "./services/mlRisk.service.js";
import { FoodImpactService } from "./services/foodImpact.service.js";
import { PredictionService } from "./services/prediction.service.js";

async function runTestRunner() {
  console.log("==================================================");
  console.log("HEALTHGUARD AI AUTOMATED MODEL VERIFICATION");
  console.log("==================================================");

  // ----------------------------------------------------
  // PROFILE A: age 20, normal BMI, non-smoker, light exercise
  // ----------------------------------------------------
  const profileA = {
    age: 20,
    gender: "male" as const,
    heightCm: 175,
    weightKg: 65, // BMI ~ 21.2 (Normal)
    smoking: "never" as const,
    exercise: "light" as const,
    familyHistory: "None",
    symptoms: "None",
    alcohol: "never",
    diseases: "None",
  };

  // ----------------------------------------------------
  // PROFILE B: age 45, high BMI, sedentary, family history diabetes
  // ----------------------------------------------------
  const profileB = {
    age: 45,
    gender: "female" as const,
    heightCm: 165,
    weightKg: 85, // BMI ~ 31.2 (Obese)
    smoking: "never" as const,
    exercise: "none" as const,
    familyHistory: "Type 2 Diabetes in mother",
    symptoms: "Mild fatigue",
    alcohol: "occasional",
    diseases: "None",
  };

  // ----------------------------------------------------
  // PROFILE C: age 55, smoker, alcohol frequent, high BP risk
  // ----------------------------------------------------
  const profileC = {
    age: 55,
    gender: "male" as const,
    heightCm: 180,
    weightKg: 95, // BMI ~ 29.3 (Overweight)
    smoking: "current" as const,
    exercise: "none" as const,
    familyHistory: "Hypertension and stroke in father",
    symptoms: "None",
    alcohol: "frequent",
    diseases: "None",
  };

  console.log("\n--- PHASE 1: ML RISK CLASSIFICATION ENGINE ---");

  const clinicalA = RiskService.analyze(profileA);
  const mlA = MlRiskService.classifyMlRisk(profileA, clinicalA);
  console.log(
    "Profile A (Clinical Overall Risk):",
    clinicalA.overallRisk,
    `(${clinicalA.overallRiskLabel})`,
  );
  console.log(
    "Profile A (ML Risk Category):   ",
    mlA.mlRiskCategory,
    `(Confidence: ${Math.round(mlA.confidence * 100)}%, Version: ${mlA.modelVersion})`,
  );
  console.log("Profile A (Supporting Factors): ", mlA.supportingFactors);

  const clinicalB = RiskService.analyze(profileB);
  const mlB = MlRiskService.classifyMlRisk(profileB, clinicalB);
  console.log(
    "\nProfile B (Clinical Overall Risk):",
    clinicalB.overallRisk,
    `(${clinicalB.overallRiskLabel})`,
  );
  console.log(
    "Profile B (ML Risk Category):   ",
    mlB.mlRiskCategory,
    `(Confidence: ${Math.round(mlB.confidence * 100)}%, Version: ${mlB.modelVersion})`,
  );
  console.log("Profile B (Supporting Factors): ", mlB.supportingFactors);

  const clinicalC = RiskService.analyze(profileC);
  const mlC = MlRiskService.classifyMlRisk(profileC, clinicalC);
  console.log(
    "\nProfile C (Clinical Overall Risk):",
    clinicalC.overallRisk,
    `(${clinicalC.overallRiskLabel})`,
  );
  console.log(
    "Profile C (ML Risk Category):   ",
    mlC.mlRiskCategory,
    `(Confidence: ${Math.round(mlC.confidence * 100)}%, Version: ${mlC.modelVersion})`,
  );
  console.log("Profile C (Supporting Factors): ", mlC.supportingFactors);

  console.log("\n--- PHASE 2: PERSONALIZED FOOD INTEL UPGRADE ---");

  // Test Foods
  const highSugarFood = {
    ingredients: ["sugar", "wheat flour", "artificial sweetener", "cocoa powder"],
    nutritionFacts: { sugarG: 22, sodiumMg: 50, transFatG: 0, saturatedFatG: 1 },
  };

  const highSodiumFood = {
    ingredients: ["maggi tastemaker", "salt", "monosodium glutamate", "noodles"],
    nutritionFacts: { sugarG: 1, sodiumMg: 650, transFatG: 0, saturatedFatG: 2 },
  };

  const healthyFood = {
    ingredients: ["makhana", "sprouted moong", "cucumber", "lemon juice"],
    nutritionFacts: { sugarG: 1, sodiumMg: 20, transFatG: 0, saturatedFatG: 0 },
  };

  const getPersonalizedRisks = (cl: any) => ({
    diabetes: cl.diabetesRisk.risk,
    heart: cl.heartRisk.risk,
    hypertension: cl.hypertensionRisk.risk,
  });

  // Food Sugar Impact scaling
  console.log("\n--- High-Sugar Food Assessment ---");
  const sugarA = FoodImpactService.analyzePersonalizedFood(
    highSugarFood.ingredients,
    highSugarFood.nutritionFacts,
    getPersonalizedRisks(clinicalA),
  );
  const sugarB = FoodImpactService.analyzePersonalizedFood(
    highSugarFood.ingredients,
    highSugarFood.nutritionFacts,
    getPersonalizedRisks(clinicalB),
  );
  console.log(
    "Profile A (Low Diabetes Risk) -> Score:",
    sugarA.personalizedFoodScore,
    "Category:",
    sugarA.foodRiskCategory,
    "Sugar/Diabetes Impact:",
    sugarA.diabetesImpact,
  );
  console.log(
    "Profile B (High Diabetes Risk) -> Score:",
    sugarB.personalizedFoodScore,
    "Category:",
    sugarB.foodRiskCategory,
    "Sugar/Diabetes Impact:",
    sugarB.diabetesImpact,
  );

  // Food Sodium Impact scaling
  console.log("\n--- High-Sodium Food Assessment ---");
  const sodiumA = FoodImpactService.analyzePersonalizedFood(
    highSodiumFood.ingredients,
    highSodiumFood.nutritionFacts,
    getPersonalizedRisks(clinicalA),
  );
  const sodiumC = FoodImpactService.analyzePersonalizedFood(
    highSodiumFood.ingredients,
    highSodiumFood.nutritionFacts,
    getPersonalizedRisks(clinicalC),
  );
  console.log(
    "Profile A (Low HT Risk)  -> Score:",
    sodiumA.personalizedFoodScore,
    "Category:",
    sodiumA.foodRiskCategory,
    "Sodium/HT Impact:",
    sodiumA.hypertensionImpact,
  );
  console.log(
    "Profile C (High HT Risk) -> Score:",
    sodiumC.personalizedFoodScore,
    "Category:",
    sodiumC.foodRiskCategory,
    "Sodium/HT Impact:",
    sodiumC.hypertensionImpact,
  );

  // Healthy Food Assessment
  console.log("\n--- Healthy Food Assessment ---");
  const cleanA = FoodImpactService.analyzePersonalizedFood(
    healthyFood.ingredients,
    healthyFood.nutritionFacts,
    getPersonalizedRisks(clinicalA),
  );
  const cleanC = FoodImpactService.analyzePersonalizedFood(
    healthyFood.ingredients,
    healthyFood.nutritionFacts,
    getPersonalizedRisks(clinicalC),
  );
  console.log(
    "Profile A (Clean Food) -> Score:",
    cleanA.personalizedFoodScore,
    "Category:",
    cleanA.foodRiskCategory,
  );
  console.log(
    "Profile C (Clean Food) -> Score:",
    cleanC.personalizedFoodScore,
    "Category:",
    cleanC.foodRiskCategory,
  );

  console.log("\n--- PHASE 3: PROGRESS PREDICTION MODEL ---");

  // 1. Log count checks
  console.log("\n--- Logs Threshold Check ---");
  const zeroLogs: any[] = [];
  const twoLogs = [
    { weight: 95, overallRisk: 45, createdAt: "2026-06-01T00:00:00Z" },
    { weight: 94, overallRisk: 43, createdAt: "2026-06-05T00:00:00Z" },
  ];
  console.log("0 logs ->", PredictionService.predictProgressRisk(zeroLogs));
  console.log("2 logs ->", PredictionService.predictProgressRisk(twoLogs));

  // 2. Improving Trend (decreasing risk score)
  const improvingLogs = [
    { weight: 95, overallRisk: 50, createdAt: "2026-06-01T00:00:00Z" },
    { weight: 93, overallRisk: 45, createdAt: "2026-06-08T00:00:00Z" },
    { weight: 91, overallRisk: 40, createdAt: "2026-06-15T00:00:00Z" },
  ];
  const predImp = PredictionService.predictProgressRisk(improvingLogs);
  console.log("\n--- 3+ Decreasing Risk Logs (Improving) ---");
  console.log("Result Trend:       ", predImp.trend);
  console.log("Projected 30 Days:  ", predImp.predictedRisk30Days + "%");
  console.log("Projected 90 Days:  ", predImp.predictedRisk90Days + "%");
  console.log("Confidence:         ", Math.round(predImp.confidence * 100) + "%");
  console.log("Reasons:            ", predImp.reasons);

  // 3. Worsening Trend (increasing risk score)
  const worseningLogs = [
    { weight: 95, overallRisk: 50, createdAt: "2026-06-01T00:00:00Z" },
    { weight: 96, overallRisk: 55, createdAt: "2026-06-08T00:00:00Z" },
    { weight: 97, overallRisk: 62, createdAt: "2026-06-15T00:00:00Z" },
  ];
  const predWor = PredictionService.predictProgressRisk(worseningLogs);
  console.log("\n--- 3+ Increasing Risk Logs (Worsening) ---");
  console.log("Result Trend:       ", predWor.trend);
  console.log("Projected 30 Days:  ", predWor.predictedRisk30Days + "%");
  console.log("Projected 90 Days:  ", predWor.predictedRisk90Days + "%");
  console.log("Confidence:         ", Math.round(predWor.confidence * 100) + "%");
  console.log("Reasons:            ", predWor.reasons);

  console.log("\n==================================================");
  console.log("HEALTHGUARD AI AUTOMATED MODEL VERIFICATION COMPLETE");
  console.log("==================================================");
}

runTestRunner().catch(console.error);
