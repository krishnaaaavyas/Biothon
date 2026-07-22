import { EvidenceBuilder } from "./services/evidenceBuilder.service.js";
import { RiskService } from "./services/risk.service.js";

console.log("==================================================");
console.log("HEALTHGUARD AI UNIFIED EVIDENCE PIPELINE UNIT TESTS");
console.log("==================================================");

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✅ Pass: ${description}`);
    passedCount++;
  } else {
    console.error(`❌ Fail: ${description}`);
    failedCount++;
  }
}

// 1. Test Questionnaire-only Evidence Construction
const questionnaireInput = {
  age: 48,
  gender: "female",
  heightCm: 160,
  weightKg: 68,
  smoking: "never",
  exercise: "moderate",
  familyHistory: "Mother has type 2 diabetes",
  symptoms: "Fatigue, mild thirst",
  alcohol: "never",
};

const qEvidence = EvidenceBuilder.fromQuestionnaire(questionnaireInput);
assert(qEvidence.source === "questionnaire", "Questionnaire evidence source is 'questionnaire'");
assert(qEvidence.demographics.age === 48, "Demographics age is correctly populated");
assert(qEvidence.demographics.gender === "female", "Demographics gender is correctly populated");
assert(qEvidence.anthropometrics.bmi === 26.6, "BMI is calculated correctly (26.6)");
assert(qEvidence.anthropometrics.bmiCategory === "Overweight", "BMI category is 'Overweight'");
assert(qEvidence.symptoms.reported.includes("Fatigue"), "Symptoms array contains 'Fatigue'");
assert(qEvidence.completeness.score >= 80, "Questionnaire evidence completeness is high");

// 2. Test Blood Report-only Evidence Construction
const labObsInput = [
  { code: "fasting_blood_sugar", value: 135, unit: "mg/dL", isVerified: true, source: "ocr" },
  { code: "hba1c", value: 6.8, unit: "%", isVerified: true, source: "ocr" },
  { code: "systolic_bp", value: 142, unit: "mmHg", isVerified: false, source: "ocr" },
  { code: "diastolic_bp", value: 90, unit: "mmHg", isVerified: false, source: "ocr" },
];

const labMeta = {
  reportId: "lab-12345",
  fileName: "blood_report.pdf",
  mimeType: "application/pdf",
  fileSizeBucket: "100KB-1MB",
};

const bEvidence = EvidenceBuilder.fromBloodReport(labObsInput, labMeta);
assert(bEvidence.source === "blood_report", "Blood report evidence source is 'blood_report'");
assert(bEvidence.biomarkers.fastingBloodSugar?.value === 135, "FBS biomarker extracted (135 mg/dL)");
assert(bEvidence.biomarkers.HbA1c?.value === 6.8, "HbA1c biomarker extracted (6.8%)");
assert(bEvidence.biomarkers.systolicBP?.value === 142, "Systolic BP biomarker extracted (142 mmHg)");
assert(bEvidence.uploadedReportMetadata.fileName === "blood_report.pdf", "Report filename preserved");

// 3. Test Hybrid / Complete Analysis Evidence Construction
const hybridEvidence = EvidenceBuilder.fromHybrid(questionnaireInput, labObsInput, labMeta);
assert(hybridEvidence.source === "hybrid", "Hybrid evidence source is 'hybrid'");
assert(hybridEvidence.completeness.score === 100, "Hybrid evidence score is 100%");
assert(hybridEvidence.completeness.level === "complete", "Hybrid completeness level is 'complete'");

// 4. Test RiskService consuming normalized Evidence object
const riskAnalysis = RiskService.analyze(hybridEvidence);
assert(riskAnalysis.bmi === 26.6, "RiskService.analyze consumes Evidence object and calculates BMI 26.6");
assert(riskAnalysis.diabetesRisk.risk > 0, "RiskService produces non-zero diabetes risk");
assert(riskAnalysis.heartRisk.risk > 0, "RiskService produces non-zero heart risk");
assert(riskAnalysis.hypertensionRisk.risk > 0, "RiskService produces non-zero hypertension risk");
assert(riskAnalysis.actionPriorities.length > 0, "Action priorities are generated from unified evidence");

console.log("==================================================");
console.log(`TESTS COMPLETE: ${passedCount} Passed, ${failedCount} Failed`);
console.log("==================================================");

if (failedCount > 0) {
  process.exit(1);
}
