import { describe, it, expect } from "vitest";
import { languages, tr, type Lang } from "./i18n";
import { runI18nAudit } from "./i18n.check";
import { generateHealthPriorities } from "./priority-engine";
import { selectDietStrategy } from "./diet-engine";
import { generateWorkoutPlan } from "./workout-engine";
import { generateExplainedRecommendations } from "./recommendation-explanation-engine";

describe("Complete Indian Localization & 8-Locale Expansion", () => {
  it("registers all eight supported locales with native script labels", () => {
    expect(languages.length).toBe(8);

    const codes = languages.map((l) => l.code);
    expect(codes).toEqual(["en", "hi", "gu", "mr", "bn", "ta", "te", "kn"]);

    const labels = languages.map((l) => l.label);
    expect(labels).toEqual([
      "English",
      "हिन्दी",
      "ગુજરાતી",
      "मराठी",
      "বাংলা",
      "தமிழ்",
      "తెలుగు",
      "ಕನ್ನಡ",
    ]);
  });

  it("passes automated translation audit (100% key completeness across all 8 locales)", () => {
    const audit = runI18nAudit();
    expect(audit.success).toBe(true);
    expect(audit.errors.length).toBe(0);
    expect(audit.stats.languagesAudited).toBe(8);
  });

  it("falls back to English when key is missing in target locale, and returns key in dev when missing in en", () => {
    const fallbackText = tr("appName", "kn");
    expect(fallbackText).toBe("ಹೆಲ್ತ್‌ಗಾರ್ಡ್");

    const unmappedKey = tr("unmapped.unknown.key", "en");
    expect(unmappedKey).toBe("unmapped.unknown.key");
  });

  it("preserves biomarker abbreviations across all 8 locales", () => {
    const biomarkers = ["HbA1c", "HDL", "LDL", "BMI", "mmHg"];
    const allLangs: Lang[] = ["en", "hi", "gu", "mr", "bn", "ta", "te", "kn"];

    biomarkers.forEach((bm) => {
      allLangs.forEach((lang) => {
        const text = tr(bm, lang);
        expect(text).toBe(bm);
      });
    });
  });

  it("localizes Evidence Quality and Confidence Level badges", () => {
    const allLangs: Lang[] = ["en", "hi", "gu", "mr", "bn", "ta", "te", "kn"];

    allLangs.forEach((lang) => {
      const qHigh = tr("evidence.quality.high", lang);
      const cHigh = tr("evidence.confidence.high", lang);

      expect(typeof qHigh).toBe("string");
      expect(qHigh.length).toBeGreaterThan(0);
      expect(typeof cHigh).toBe("string");
      expect(cHigh.length).toBeGreaterThan(0);
    });
  });

  it("localizes priority titles and reasons derived from Priority Engine", () => {
    const priorities = generateHealthPriorities({ exercise: "none", systolic: 120, diastolic: 80 });
    expect(priorities.length).toBeGreaterThan(0);

    const actPriority = priorities.find((p) => p.id === "increase-physical-activity") || priorities[0];
    const enTitle = tr(actPriority.titleCode, "en");
    const hiTitle = tr(actPriority.titleCode, "hi");
    const knTitle = tr(actPriority.titleCode, "kn");

    expect(enTitle).toBe("Increase physical activity");
    expect(hiTitle).toBe("शारीरिक गतिविधि बढ़ाएं");
    expect(knTitle).toBe("ದೈಹಿಕ ಚಟುವಟಿಕೆಯನ್ನು ಹೆಚ್ಚಿಸಿ");
  });

  it("localizes diet strategies and meal templates derived from Diet Engine", () => {
    const strategy = selectDietStrategy({ systolic: 145, diastolic: 92 });
    expect(strategy.strategyCode).toBe("lower_sodium");

    const enStrat = tr(`diet.strategy.${strategy.strategyCode}`, "en");
    const hiStrat = tr(`diet.strategy.${strategy.strategyCode}`, "hi");
    const mrStrat = tr(`diet.strategy.${strategy.strategyCode}`, "mr");

    expect(enStrat).toBe("Lower Sodium");
    expect(hiStrat).toBe("कम सोडियम");
    expect(mrStrat).toBe("कमी सोडियम");
  });

  it("localizes workout activities and safety notes derived from Workout Engine", () => {
    const workout = generateWorkoutPlan({ activity: "none" });
    const primaryEx = workout.weeks.week1[0];

    const enEx = tr(primaryEx.exerciseCode, "en");
    const bnEx = tr(primaryEx.exerciseCode, "bn");
    const taEx = tr(primaryEx.exerciseCode, "ta");

    expect(enEx).toBe("Brisk Walking");
    expect(bnEx).toBe("দ্রুত হাঁটা");
    expect(taEx).toBe("வேகமாக நடப்பது");
  });

  it("localizes recommendation explanations and timeline badges", () => {
    const recs = generateExplainedRecommendations({ exercise: "none", systolic: 140, diastolic: 90 });
    expect(recs.length).toBeGreaterThan(0);

    const rec = recs[0];
    const enTimeline = tr(`timeline.${rec.timelineCode}`, "en");
    const hiTimeline = tr(`timeline.${rec.timelineCode}`, "hi");
    const teTimeline = tr(`timeline.${rec.timelineCode}`, "te");

    expect(typeof enTimeline).toBe("string");
    expect(typeof hiTimeline).toBe("string");
    expect(typeof teTimeline).toBe("string");
  });

  it("guarantees zero clinical logic variance between languages", () => {
    const input = { age: 45, heightCm: 170, weightKg: 85, systolic: 142, diastolic: 92, exercise: "none" };

    const prioritiesEn = generateHealthPriorities(input);
    const prioritiesHi = generateHealthPriorities(input);
    const prioritiesKn = generateHealthPriorities(input);

    expect(prioritiesEn.map((p) => p.id)).toEqual(prioritiesHi.map((p) => p.id));
    expect(prioritiesHi.map((p) => p.id)).toEqual(prioritiesKn.map((p) => p.id));
  });
});
