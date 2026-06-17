import { db } from "../firebase-admin.js";
import { GuardrailsService } from "./guardrails.service.js";
import { RiskService, type UserProfile } from "./risk.service.js";

const langName: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  gu: "Gujarati (ગુજરાતી)",
};

export interface CachedRecommendation {
  userId: string;
  type: string;
  content: any;
  profileSnapshot: {
    age: number;
    gender: string;
    heightCm: number;
    weightKg: number;
    smoking: string;
    exercise: string;
    familyHistory: string;
    symptoms: string;
    alcohol?: string;
    diseases?: string;
    language: string;
    region?: string;
    dietType?: string;
    budget?: string;
    fitnessLevel?: string;
  };
  createdAt: string;
}

export class AIService {
  private static getApiKey(): string | null {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "YOUR_GEMINI_API_KEY" || key.includes("placeholder")) {
      return null;
    }
    return key;
  }

  /**
   * Helper to make raw fetch requests to Gemini API
   */
  private static async callGemini(prompt: string, responseSchema?: any): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error("Gemini API key is not configured.");
    }

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

    const body: any = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    };

    if (responseSchema) {
      body.generationConfig.responseMimeType = "application/json";
      body.generationConfig.responseSchema = responseSchema;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API returned error ${resp.status}: ${errText}`);
    }

    const json: any = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    return text;
  }

  /**
   * Deep snapshot comparison to verify if cache is still valid
   */
  private static isCacheValid(cachedSnapshot: any, currentSnapshot: any): boolean {
    const keys = Object.keys(currentSnapshot);
    for (const key of keys) {
      if (cachedSnapshot[key] !== currentSnapshot[key]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get cached recommendation from Firestore
   */
  private static async getCached(userId: string, type: string, currentSnapshot: any): Promise<any | null> {
    try {
      const docRef = db.collection("aiRecommendations").doc(`${userId}_${type}`);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data() as CachedRecommendation;
        if (this.isCacheValid(data.profileSnapshot, currentSnapshot)) {
          console.log(`Cache hit for user ${userId}, type: ${type}`);
          return data.content;
        }
      }
    } catch (err) {
      console.warn("Error reading recommendation cache:", err);
    }
    return null;
  }

  /**
   * Save recommendation to Firestore cache
   */
  private static async saveCache(userId: string, type: string, content: any, snapshot: any): Promise<void> {
    try {
      const docRef = db.collection("aiRecommendations").doc(`${userId}_${type}`);
      await docRef.set({
        userId,
        type,
        content,
        profileSnapshot: snapshot,
        createdAt: new Date().toISOString(),
      });
      console.log(`Cache saved for user ${userId}, type: ${type}`);
    } catch (err) {
      console.warn("Error writing recommendation cache:", err);
    }
  }

  /**
   * Generate Full Advice (explains risks, diet plan, exercise plan, and prevention tips)
   */
  static async generateFullAdvice(
    userId: string,
    profile: UserProfile & { language: string },
    scores: { diabetes: number; heart: number; hypertension: number }
  ): Promise<any> {
    const snapshot = {
      age: profile.age,
      gender: profile.gender,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      smoking: profile.smoking,
      exercise: profile.exercise,
      familyHistory: profile.familyHistory,
      symptoms: profile.symptoms,
      alcohol: profile.alcohol || undefined,
      diseases: profile.diseases || undefined,
      language: profile.language,
    };

    // Check Cache
    const cached = await this.getCached(userId, "full_advice", snapshot);
    if (cached) return cached;

    // Check Gemini key
    const key = this.getApiKey();
    if (!key) {
      console.warn("Gemini API Key missing. Falling back to deterministic advice.");
      const fallback = RiskService.generateDeterministicPlans(profile, scores);
      return {
        risk: {
          diabetes: scores.diabetes,
          heartDisease: scores.heart,
          hypertension: scores.hypertension,
        },
        ...fallback,
      };
    }

    const targetLang = langName[profile.language] || "English";
    const prompt = `You are a clinical wellness coach explaining health assessments.
We have run clinical models (FINDRISC for Diabetes, Framingham for CVD and Hypertension) and got:
- Type 2 Diabetes Risk: ${scores.diabetes}%
- Heart Disease/CVD Risk: ${scores.heart}%
- Hypertension Risk: ${scores.hypertension}%

Explain rationales for these risk scores based on demographic profile, family history, and symptoms.
Create a customized regional diet plan (e.g., Indian foods if target language is Hindi/Gujarati).
Create a customized exercise plan.
Provide prevention tips.

Do NOT override the computed risk percentages. Return exactly the score percentages provided in this response schema:
{
  "risk": {
    "diabetes": ${scores.diabetes},
    "heartDisease": ${scores.heart},
    "hypertension": ${scores.hypertension}
  }
}

Do NOT provide medical diagnosis or imply clinical certainty. Keep descriptions educational.
User profile:
- Age: ${profile.age}
- Gender: ${profile.gender}
- Height: ${profile.heightCm} cm
- Weight: ${profile.weightKg} kg
- Smoking: ${profile.smoking}
- Exercise: ${profile.exercise}
- Family History: ${profile.familyHistory || "none"}
- Symptoms: ${profile.symptoms || "none"}

Target Language: Respond ENTIRELY in ${targetLang}. Use clean markdown with headings for dietPlan, exercisePlan, and preventionTips. Return strictly JSON matching the response schema.`;

    const schema = {
      type: "object",
      properties: {
        risk: {
          type: "object",
          properties: {
            diabetes: { type: "integer" },
            heartDisease: { type: "integer" },
            hypertension: { type: "integer" },
          },
          required: ["diabetes", "heartDisease", "hypertension"],
        },
        rationale: {
          type: "object",
          properties: {
            diabetes: { type: "string" },
            heartDisease: { type: "string" },
            hypertension: { type: "string" },
          },
          required: ["diabetes", "heartDisease", "hypertension"],
        },
        dietPlan: { type: "string" },
        exercisePlan: { type: "string" },
        preventionTips: { type: "string" },
      },
      required: ["risk", "rationale", "dietPlan", "exercisePlan", "preventionTips"],
    };

    try {
      const text = await this.callGemini(prompt, schema);
      const parsed = JSON.parse(text);

      // Sanitize AI outputs via Guardrails
      parsed.rationale.diabetes = GuardrailsService.sanitizeText(parsed.rationale.diabetes);
      parsed.rationale.heartDisease = GuardrailsService.sanitizeText(parsed.rationale.heartDisease);
      parsed.rationale.hypertension = GuardrailsService.sanitizeText(parsed.rationale.hypertension);
      parsed.dietPlan = GuardrailsService.sanitizeText(parsed.dietPlan);
      parsed.exercisePlan = GuardrailsService.sanitizeText(parsed.exercisePlan);
      parsed.preventionTips = GuardrailsService.sanitizeText(parsed.preventionTips);

      // Save to cache
      await this.saveCache(userId, "full_advice", parsed, snapshot);
      return parsed;
    } catch (err) {
      console.error("Gemini generation failed. Using deterministic fallback.", err);
      const fallback = RiskService.generateDeterministicPlans(profile, scores);
      return {
        risk: {
          diabetes: scores.diabetes,
          heartDisease: scores.heart,
          hypertension: scores.hypertension,
        },
        ...fallback,
      };
    }
  }

  /**
   * Explains Risk Scores and factors in simple language
   */
  static async explainRisks(
    userId: string,
    riskScores: { diabetes: number; heart: number; hypertension: number },
    factors: Array<{ factor: string; impact: number }>,
    language: string
  ): Promise<string> {
    const snapshot = {
      diabetes: riskScores.diabetes,
      heart: riskScores.heart,
      hypertension: riskScores.hypertension,
      factorsCount: factors.length,
      language,
    };

    const cached = await this.getCached(userId, "explanation", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    if (!key) {
      return `Your health assessment indicates risk scores: Diabetes: ${riskScores.diabetes}%, Heart: ${riskScores.heart}%, Hypertension: ${riskScores.hypertension}%. Key contributing factors: ${factors.map(f => `${f.factor} (impact: ${f.impact}%)`).join(", ")}. Consult your physician.`;
    }

    const targetLang = langName[language] || "English";
    const prompt = `Explain the following chronic health risk results in simple, layperson language.
- Diabetes Risk: ${riskScores.diabetes}%
- Cardiovascular Risk: ${riskScores.heart}%
- Hypertension Risk: ${riskScores.hypertension}%

Contributing risk factors:
${JSON.stringify(factors)}

Avoid clinical diagnosis, prescription drugs, or fear-based language. Emphasize education and risk modification.
Respond entirely in ${targetLang}.`;

    try {
      const text = await this.callGemini(prompt);
      const sanitized = GuardrailsService.sanitizeText(text);
      await this.saveCache(userId, "explanation", sanitized, snapshot);
      return sanitized;
    } catch (err) {
      console.error("Failed to generate risk explanation:", err);
      return "Unable to retrieve AI explanation at this time. Please consult your physician.";
    }
  }

  /**
   * Explains simulation drops
   */
  static async explainSimulation(
    userId: string,
    currentRisk: number,
    projectedRisk: number,
    changes: string[],
    language: string
  ): Promise<string> {
    const snapshot = {
      currentRisk,
      projectedRisk,
      changes: changes.join(","),
      language,
    };

    const cached = await this.getCached(userId, "simulation_explanation", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    if (!key) {
      return `Modifying parameters [${changes.join(", ")}] reduced estimated overall score from ${currentRisk}% to ${projectedRisk}% (Absolute improvement: ${currentRisk - projectedRisk}%).`;
    }

    const targetLang = langName[language] || "English";
    const prompt = `Explain why making the following lifestyle modifications: ${changes.join(", ")}
reduced the user's estimated chronic overall health risk score from ${currentRisk}% to ${projectedRisk}% (Absolute drop of ${currentRisk - projectedRisk}%).
Explain the physiological benefits (e.g. cardiac workload, arterial pressure, insulin sensitivity).
Keep the language simple, encouraging, and educational. Do not promise specific clinical diagnostics.
Respond entirely in ${targetLang}.`;

    try {
      const text = await this.callGemini(prompt);
      const sanitized = GuardrailsService.sanitizeText(text);
      await this.saveCache(userId, "simulation_explanation", sanitized, snapshot);
      return sanitized;
    } catch (err) {
      console.error("Failed to generate simulation explanation:", err);
      return `These changes [${changes.join(", ")}] lead to a projected overall risk score improvement of ${currentRisk - projectedRisk}%.`;
    }
  }

  /**
   * Generates Diet Plan based on culture, budget, preferences, and risks
   */
  static async generateDietPlan(
    userId: string,
    profile: UserProfile & { language: string },
    region: string,
    dietType: string,
    budget: string,
    riskScores: { diabetes: number; heart: number; hypertension: number }
  ): Promise<string> {
    const snapshot = {
      age: profile.age,
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      region,
      dietType,
      budget,
      language: profile.language,
      diabetes: riskScores.diabetes,
      heart: riskScores.heart,
      hypertension: riskScores.hypertension,
    };

    const cached = await this.getCached(userId, "diet", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    if (!key) {
      return RiskService.generateDeterministicPlans(profile, { diabetes: riskScores.diabetes, heart: riskScores.heart, hypertension: riskScores.hypertension }).dietPlan;
    }

    const targetLang = langName[profile.language] || "English";
    const prompt = `Generate a personalized weekly dietary meal plan.
- Demographics: ${profile.age} years, ${profile.gender}, BMI: ${(profile.weightKg / Math.pow(profile.heightCm / 100, 2)).toFixed(1)}
- Risk profile: Diabetes: ${riskScores.diabetes}%, Heart: ${riskScores.heart}%, Hypertension: ${riskScores.hypertension}%
- Regional preference: ${region}
- Diet type: ${dietType}
- Budget constraint: ${budget}

Provide structured breakfast, lunch, snack, and dinner meal suggestions. Incorporate ingredients matching the regional preference. Avoid prescribing medical treatments.
Respond entirely in ${targetLang} in clear markdown.`;

    try {
      const text = await this.callGemini(prompt);
      const sanitized = GuardrailsService.sanitizeText(text);
      await this.saveCache(userId, "diet", sanitized, snapshot);
      return sanitized;
    } catch (err) {
      console.error("Failed to generate diet plan:", err);
      return "Unable to retrieve AI diet plan at this time.";
    }
  }

  /**
   * Generates Fitness Plan based on fitnessLevel and risks
   */
  static async generateFitnessPlan(
    userId: string,
    profile: UserProfile & { language: string },
    fitnessLevel: string,
    riskScores: { diabetes: number; heart: number; hypertension: number }
  ): Promise<string> {
    const snapshot = {
      age: profile.age,
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      fitnessLevel,
      language: profile.language,
      diabetes: riskScores.diabetes,
      heart: riskScores.heart,
      hypertension: riskScores.hypertension,
    };

    const cached = await this.getCached(userId, "fitness", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    if (!key) {
      return RiskService.generateDeterministicPlans(profile, { diabetes: riskScores.diabetes, heart: riskScores.heart, hypertension: riskScores.hypertension }).exercisePlan;
    }

    const targetLang = langName[profile.language] || "English";
    const prompt = `Generate a structured weekly physical training fitness plan.
- Profile: ${profile.age} years old, ${profile.gender}, current exercise profile: ${profile.exercise}
- Target fitness level: ${fitnessLevel}
- Risk profile: Diabetes: ${riskScores.diabetes}%, Heart: ${riskScores.heart}%, Hypertension: ${riskScores.hypertension}%

Include schedule tables, walking parameters, mobility stretches, and strength training. Restrict difficulty if risk scores are high or user is beginner.
Respond entirely in ${targetLang} in clear markdown.`;

    try {
      const text = await this.callGemini(prompt);
      const sanitized = GuardrailsService.sanitizeText(text);
      await this.saveCache(userId, "fitness", sanitized, snapshot);
      return sanitized;
    } catch (err) {
      console.error("Failed to generate fitness plan:", err);
      return "Unable to retrieve AI fitness plan at this time.";
    }
  }

  /**
   * Generates Prevention tips
   */
  static async generatePreventionTips(
    userId: string,
    profile: UserProfile & { language: string },
    riskScores: { diabetes: number; heart: number; hypertension: number }
  ): Promise<string> {
    const snapshot = {
      age: profile.age,
      gender: profile.gender,
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      smoking: profile.smoking,
      exercise: profile.exercise,
      language: profile.language,
      diabetes: riskScores.diabetes,
      heart: riskScores.heart,
      hypertension: riskScores.hypertension,
    };

    const cached = await this.getCached(userId, "prevention", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    if (!key) {
      return RiskService.generateDeterministicPlans(profile, { diabetes: riskScores.diabetes, heart: riskScores.heart, hypertension: riskScores.hypertension }).preventionTips;
    }

    const targetLang = langName[profile.language] || "English";
    const prompt = `Generate structured, actionable prevention strategies based on:
- Age: ${profile.age}, Gender: ${profile.gender}
- Lifestyle: Smoking: ${profile.smoking}, Exercise: ${profile.exercise}
- Risk Scores: Diabetes: ${riskScores.diabetes}%, Heart: ${riskScores.heart}%, Hypertension: ${riskScores.hypertension}%

Format as bullet points with concrete actions (e.g. "Reduce sugar sweetened tea" instead of "Lose weight").
Respond entirely in ${targetLang} in clear markdown.`;

    try {
      const text = await this.callGemini(prompt);
      const sanitized = GuardrailsService.sanitizeText(text);
      await this.saveCache(userId, "prevention", sanitized, snapshot);
      return sanitized;
    } catch (err) {
      console.error("Failed to generate prevention tips:", err);
      return "Unable to retrieve AI prevention recommendations.";
    }
  }

  /**
   * Generates a progress review summary and adapted coaching advice
   */
  static async generateProgressReview(
    userId: string,
    logs: any[],
    language: string
  ): Promise<{ review: string; coaching: string }> {
    if (logs.length < 2) {
      return {
        review: "You have completed your first assessment! Keep logging your weight and physical habits over time to view personalized progress reviews.",
        coaching: "Maintain your current plan, check back regularly, and record your weight to build a detailed progress tracking history."
      };
    }

    const first = logs[0];
    const latest = logs[logs.length - 1];

    // Find a log from roughly 30 days ago to make monthly comparisons
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyLog = logs.find(l => new Date(l.createdAt) >= thirtyDaysAgo) || first;

    const snapshot = {
      logsCount: logs.length,
      latestDate: latest.createdAt,
      language,
    };

    const cached = await this.getCached(userId, "progress_review", snapshot);
    if (cached) return cached;

    const key = this.getApiKey();
    const targetLang = langName[language] || "English";

    // Prepare deterministic fallback in case Gemini is offline/unconfigured
    const weightDiff = first.weight - latest.weight;
    const overallRiskDiff = first.overallRisk - latest.overallRisk;
    const fallbackReview = `Over the last ${logs.length > 2 ? "tracking period" : "assessments"}, your overall health risk score changed from ${first.overallRisk}% to ${latest.overallRisk}% (an improvement of ${overallRiskDiff}%). Your weight changed from ${first.weight}kg to ${latest.weight}kg (a change of ${-weightDiff.toFixed(1)}kg).`;
    const fallbackCoaching = overallRiskDiff >= 0
      ? "Great job! Maintain your current habits, focusing on consistent daily exercise and balanced meal sizes to sustain this progress."
      : "We suggest prioritizing your focus areas. Reduce high-calorie snacks, log meals, and gradually increase your physical exercise sessions.";

    if (!key) {
      return {
        review: fallbackReview,
        coaching: fallbackCoaching
      };
    }

    // Prepare the list of logs for the prompt
    const logDetails = logs.map(l => ({
      date: new Date(l.createdAt).toLocaleDateString(),
      weight: l.weight,
      bmi: l.bmi,
      diabetesRisk: l.diabetesRisk,
      heartRisk: l.heartRisk,
      hypertensionRisk: l.hypertensionRisk,
      overallRisk: l.overallRisk,
      exercise: l.exercise,
      smoking: l.smoking
    }));

    const prompt = `You are a clinical wellness progress analyst. Analyze the user's health metrics history:
${JSON.stringify(logDetails)}

Demographics comparison:
- Baseline (earliest): Weight: ${first.weight}kg, BMI: ${first.bmi.toFixed(1)}, Exercise: ${first.exercise}, Smoking: ${first.smoking}, Overall Risk Score: ${first.overallRisk}%
- Latest (current): Weight: ${latest.weight}kg, BMI: ${latest.bmi.toFixed(1)}, Exercise: ${latest.exercise}, Smoking: ${latest.smoking}, Overall Risk Score: ${latest.overallRisk}%
- 30-Day Ago Reference (if available): Weight: ${monthlyLog.weight}kg, Overall Risk Score: ${monthlyLog.overallRisk}%

Write a personalized Progress Review narrative and an Adapted Coaching Advice statement based on this history:
1. Progress Review: Summarize the changes (weight, BMI, risk scores). Pinpoint the biggest lifestyle contributor (e.g. upgraded exercise, weight loss, quitting smoking). Mention monthly vs baseline improvements.
2. Adapted Coaching Advice: Suggest actionable modifications. If their risk scores improved, encourage maintaining their habits ("Maintain Habits"). If their risk scores worsened, guide them on key focus areas ("Focus Areas").

Avoid prescribing medical diagnostics or specific pharmaceutical drugs. Keep it encouraging, professional, and patient-first.

Respond strictly in JSON using this schema:
{
  "review": "A detailed 2-3 sentence summary of progress written directly to the user in target language.",
  "coaching": "2-3 sentences of adapted lifestyle action plans in target language."
}

Target Language: Respond ENTIRELY in ${targetLang}.`;

    const schema = {
      type: "object",
      properties: {
        review: { type: "string" },
        coaching: { type: "string" }
      },
      required: ["review", "coaching"]
    };

    try {
      const text = await this.callGemini(prompt, schema);
      const parsed = JSON.parse(text);

      parsed.review = GuardrailsService.sanitizeText(parsed.review);
      parsed.coaching = GuardrailsService.sanitizeText(parsed.coaching);

      await this.saveCache(userId, "progress_review", parsed, snapshot);
      return parsed;
    } catch (err) {
      console.error("Failed to generate AI progress review, using fallback:", err);
      return {
        review: fallbackReview,
        coaching: fallbackCoaching
      };
    }
  }
}

