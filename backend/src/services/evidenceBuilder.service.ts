export interface Demographics {
  age: number;
  gender: "male" | "female" | "other";
  language?: "en" | "hi" | "gu" | "mr" | "bn" | "ta" | "te" | "kn";
}

export interface Anthropometrics {
  heightCm: number;
  weightKg: number;
  bmi: number;
  bmiCategory: "Underweight" | "Normal" | "Overweight" | "Obese";
}

export interface Symptoms {
  reported: string[];
  rawText: string;
  urgentSymptoms?: boolean;
}

export interface Lifestyle {
  smoking: "never" | "former" | "current";
  exercise: "none" | "light" | "moderate" | "active";
  physicalActivityCategory?: "high" | "moderate" | "low" | null;
  alcohol?: string | null;
  sleepHours?: number;
}

export interface FamilyHistory {
  historyText: string;
  familyHistoryHypertension?: boolean | null;
  familyHistoryDiabetes?: boolean | null;
  familyHistoryHeart?: boolean | null;
}

export interface BiomarkerValue {
  value: number;
  unit: string;
  isVerified?: boolean;
  source?: "ocr" | "manual" | "report" | "unknown";
  observedAt?: string;
}

export interface Biomarkers {
  systolicBP?: BiomarkerValue | null;
  diastolicBP?: BiomarkerValue | null;
  heartRate?: BiomarkerValue | null;
  fastingBloodSugar?: BiomarkerValue | null;
  HbA1c?: BiomarkerValue | null;
  totalCholesterol?: BiomarkerValue | null;
  ldl?: BiomarkerValue | null;
  hdl?: BiomarkerValue | null;
  triglycerides?: BiomarkerValue | null;
  knownHypertension?: boolean | null;
  takingAntihypertensiveMedication?: boolean | null;
}

export interface UploadedReportMetadata {
  reportId?: string | null;
  source?: "ocr" | "upload" | "manual" | "none";
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBucket?: string | null;
  uploadedAt?: string | null;
  extractionStatus?: "extracted" | "failed" | "unreviewed" | "manual_entry";
  verifiedLabsCount?: number;
  rawObservationsCount?: number;
}

export interface EvidenceCompleteness {
  score: number; // 0 - 100%
  level: "minimal" | "partial" | "complete";
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  hasBloodReport: boolean;
  hasQuestionnaire: boolean;
  hasManualBiomarkers: boolean;
}

export interface Evidence {
  source: "questionnaire" | "blood_report" | "complete" | "hybrid";
  demographics: Demographics;
  anthropometrics: Anthropometrics;
  symptoms: Symptoms;
  lifestyle: Lifestyle;
  familyHistory: FamilyHistory;
  biomarkers: Biomarkers;
  uploadedReportMetadata: UploadedReportMetadata;
  completeness: EvidenceCompleteness;
  createdAt: string;
}

export interface RawProfileInput {
  age?: number;
  gender?: "male" | "female" | "other" | string;
  heightCm?: number;
  height?: number;
  weightKg?: number;
  weight?: number;
  smoking?: "never" | "former" | "current" | string;
  exercise?: "none" | "light" | "moderate" | "active" | string;
  exerciseLevel?: string;
  familyHistory?: string;
  symptoms?: string;
  alcohol?: string | null;
  diseases?: string | null;
  language?: "en" | "hi" | "gu" | "mr" | "bn" | "ta" | "te" | "kn" | string;
  systolicBP?: number | null;
  diastolicBP?: number | null;
  heartRate?: number | null;
  fastingBloodSugar?: number | null;
  knownHypertension?: boolean | null;
  takingAntihypertensiveMedication?: boolean | null;
  familyHistoryHypertension?: boolean | null;
  physicalActivityCategory?: "high" | "moderate" | "low" | null;
  urgentSymptoms?: boolean | null;
}

export interface RawLabObservationInput {
  code?: string;
  name?: string;
  value?: number | null;
  unit?: string | null;
  isVerified?: boolean;
  source?: "ocr" | "manual" | "report" | "unknown" | string;
  observedAt?: string;
}

export class EvidenceBuilder {
  /**
   * Calculate Body Mass Index (BMI) and categorize
   */
  static calculateBMI(
    heightCm: number,
    weightKg: number,
  ): { bmi: number; category: "Underweight" | "Normal" | "Overweight" | "Obese" } {
    const validHeight = Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 170;
    const validWeight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
    const bmi = Number((validWeight / Math.pow(validHeight / 100, 2)).toFixed(1));
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
   * Parse symptoms raw text into normalized symptoms list
   */
  private static parseSymptoms(symptomsText?: string): string[] {
    if (!symptomsText || typeof symptomsText !== "string") return [];
    return symptomsText
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.toLowerCase() !== "none");
  }

  /**
   * Calculate Evidence Completeness Score and Level
   */
  public static calculateCompleteness(
    demographics: Demographics,
    anthropometrics: Anthropometrics,
    lifestyle: Lifestyle,
    familyHistory: FamilyHistory,
    biomarkers: Biomarkers,
    hasBloodReport: boolean,
    hasQuestionnaire: boolean,
    hasManualBiomarkers: boolean,
  ): EvidenceCompleteness {
    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];

    if (!demographics.age) missingRequired.push("age");
    if (!demographics.gender) missingRequired.push("gender");
    if (!anthropometrics.heightCm) missingRequired.push("heightCm");
    if (!anthropometrics.weightKg) missingRequired.push("weightKg");

    if (!lifestyle.smoking) missingRecommended.push("smoking");
    if (!lifestyle.exercise) missingRecommended.push("exercise");
    if (!familyHistory.historyText) missingRecommended.push("familyHistory");

    if (!biomarkers.fastingBloodSugar && !biomarkers.HbA1c) {
      missingRecommended.push("glycemicBiomarkers");
    }
    if (!biomarkers.systolicBP || !biomarkers.diastolicBP) {
      missingRecommended.push("bloodPressureBiomarkers");
    }

    let score = 100;
    score -= missingRequired.length * 15;
    score -= missingRecommended.length * 5;
    score = Math.max(0, Math.min(100, score));

    let level: "minimal" | "partial" | "complete" = "complete";
    if (score < 40 || missingRequired.length > 0) {
      level = "minimal";
    } else if (score < 80) {
      level = "partial";
    }

    return {
      score,
      level,
      missingRequiredFields: missingRequired,
      missingRecommendedFields: missingRecommended,
      hasBloodReport,
      hasQuestionnaire,
      hasManualBiomarkers,
    };
  }

  /**
   * Build a unified Evidence object from any combination of input sources
   */
  public static build(params: {
    profile?: RawProfileInput | null;
    labObservations?: RawLabObservationInput[] | null;
    reportMetadata?: UploadedReportMetadata | null;
    source?: "questionnaire" | "blood_report" | "complete" | "hybrid";
  }): Evidence {
    const profile = params.profile || {};
    const labObs = params.labObservations || [];
    const meta = params.reportMetadata || {};

    const age = Number.isFinite(profile.age) ? Number(profile.age) : 35;
    const rawGender = String(profile.gender || "male").toLowerCase();
    const gender: "male" | "female" | "other" =
      rawGender === "female" ? "female" : rawGender === "other" ? "other" : "male";
    const language = (profile.language as any) || "en";

    const demographics: Demographics = { age, gender, language };

    const heightCm = Number(profile.heightCm ?? profile.height ?? 170);
    const weightKg = Number(profile.weightKg ?? profile.weight ?? 70);
    const { bmi, category: bmiCategory } = this.calculateBMI(heightCm, weightKg);

    const anthropometrics: Anthropometrics = {
      heightCm,
      weightKg,
      bmi,
      bmiCategory,
    };

    const symptomsText = String(profile.symptoms || "");
    const symptoms: Symptoms = {
      reported: this.parseSymptoms(symptomsText),
      rawText: symptomsText,
      urgentSymptoms: Boolean(profile.urgentSymptoms),
    };

    const rawSmoking = String(profile.smoking || "never").toLowerCase();
    const smoking: "never" | "former" | "current" =
      rawSmoking === "former" ? "former" : rawSmoking === "current" ? "current" : "never";

    const rawExercise = String(profile.exercise || profile.exerciseLevel || "moderate").toLowerCase();
    const exercise: "none" | "light" | "moderate" | "active" =
      rawExercise === "none"
        ? "none"
        : rawExercise === "light"
          ? "light"
          : rawExercise === "active"
            ? "active"
            : "moderate";

    const lifestyle: Lifestyle = {
      smoking,
      exercise,
      physicalActivityCategory: profile.physicalActivityCategory || null,
      alcohol: profile.alcohol || null,
    };

    const historyText = String(profile.familyHistory || "");
    const familyHistory: FamilyHistory = {
      historyText,
      familyHistoryHypertension: profile.familyHistoryHypertension ?? null,
    };

    // Process Biomarkers from both manual profile inputs and lab observations
    const biomarkers: Biomarkers = {
      knownHypertension: profile.knownHypertension ?? null,
      takingAntihypertensiveMedication: profile.takingAntihypertensiveMedication ?? null,
    };

    if (profile.systolicBP != null && Number.isFinite(profile.systolicBP)) {
      biomarkers.systolicBP = { value: Number(profile.systolicBP), unit: "mmHg", source: "manual" };
    }
    if (profile.diastolicBP != null && Number.isFinite(profile.diastolicBP)) {
      biomarkers.diastolicBP = { value: Number(profile.diastolicBP), unit: "mmHg", source: "manual" };
    }
    if (profile.heartRate != null && Number.isFinite(profile.heartRate)) {
      biomarkers.heartRate = { value: Number(profile.heartRate), unit: "bpm", source: "manual" };
    }
    if (profile.fastingBloodSugar != null && Number.isFinite(profile.fastingBloodSugar)) {
      biomarkers.fastingBloodSugar = { value: Number(profile.fastingBloodSugar), unit: "mg/dL", source: "manual" };
    }

    // Merge lab observations
    for (const obs of labObs) {
      if (!obs || obs.value == null || !Number.isFinite(obs.value)) continue;
      const code = String(obs.code || obs.name || "").toLowerCase().replace(/[-_ ]/g, "");
      const value = Number(obs.value);
      const unit = String(obs.unit || "");
      const isVerified = Boolean(obs.isVerified);
      const source = (obs.source as any) || "ocr";
      const observedAt = obs.observedAt || new Date().toISOString();

      const item: BiomarkerValue = { value, unit, isVerified, source, observedAt };

      if (code === "fastingbloodsugar" || code === "fbs" || code === "fastingglucose") {
        biomarkers.fastingBloodSugar = item;
      } else if (code === "hba1c" || code === "a1c" || code === "glycatedhemoglobin") {
        biomarkers.HbA1c = item;
      } else if (code === "totalcholesterol" || code === "cholesterol") {
        biomarkers.totalCholesterol = item;
      } else if (code === "ldl" || code === "ldlcholesterol") {
        biomarkers.ldl = item;
      } else if (code === "hdl" || code === "hdlcholesterol") {
        biomarkers.hdl = item;
      } else if (code === "triglycerides" || code === "tg") {
        biomarkers.triglycerides = item;
      } else if (code === "systolicbp" || code === "systolic") {
        biomarkers.systolicBP = item;
      } else if (code === "diastolicbp" || code === "diastolic") {
        biomarkers.diastolicBP = item;
      } else if (code === "heartrate" || code === "pulse") {
        biomarkers.heartRate = item;
      }
    }

    const hasBloodReport = labObs.length > 0 || Boolean(meta.reportId);
    const hasQuestionnaire = Boolean(profile.age || profile.gender || profile.heightCm);
    const hasManualBiomarkers = Boolean(profile.systolicBP || profile.fastingBloodSugar);

    const determinedSource: "questionnaire" | "blood_report" | "complete" | "hybrid" =
      params.source ||
      (hasBloodReport && hasQuestionnaire
        ? "hybrid"
        : hasBloodReport
          ? "blood_report"
          : hasQuestionnaire
            ? "questionnaire"
            : "complete");

    const completeness = this.calculateCompleteness(
      demographics,
      anthropometrics,
      lifestyle,
      familyHistory,
      biomarkers,
      hasBloodReport,
      hasQuestionnaire,
      hasManualBiomarkers,
    );

    const uploadedReportMetadata: UploadedReportMetadata = {
      source: meta.source || (hasBloodReport ? "ocr" : "none"),
      reportId: meta.reportId || null,
      fileName: meta.fileName || null,
      mimeType: meta.mimeType || null,
      fileSizeBucket: meta.fileSizeBucket || null,
      uploadedAt: meta.uploadedAt || (hasBloodReport ? new Date().toISOString() : null),
      extractionStatus: meta.extractionStatus || (hasBloodReport ? "extracted" : "manual_entry"),
      verifiedLabsCount: labObs.filter((o) => o.isVerified).length,
      rawObservationsCount: labObs.length,
    };

    return {
      source: determinedSource,
      demographics,
      anthropometrics,
      symptoms,
      lifestyle,
      familyHistory,
      biomarkers,
      uploadedReportMetadata,
      completeness,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Build Evidence from Questionnaire profile
   */
  public static fromQuestionnaire(profile: RawProfileInput): Evidence {
    return this.build({ profile, source: "questionnaire" });
  }

  /**
   * Build Evidence from Blood Report observations
   */
  public static fromBloodReport(
    labObservations: RawLabObservationInput[],
    metadata?: UploadedReportMetadata,
  ): Evidence {
    return this.build({ labObservations, reportMetadata: metadata, source: "blood_report" });
  }

  /**
   * Build Evidence from Hybrid (Questionnaire + Blood Report)
   */
  public static fromHybrid(
    profile?: RawProfileInput | null,
    labObservations?: RawLabObservationInput[] | null,
    metadata?: UploadedReportMetadata | null,
  ): Evidence {
    return this.build({ profile, labObservations, reportMetadata: metadata, source: "hybrid" });
  }
}
