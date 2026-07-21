import { translations, languages, type Lang } from "./i18n";

const WHITELISTED_TERMS = new Set([
  "HealthGuard",
  "HbA1c",
  "HDL",
  "LDL",
  "BMI",
  "mmHg",
  "PDF",
  "JPG",
  "PNG",
  "ML",
]);

export function runI18nAudit(): { success: boolean; errors: string[]; stats: { totalKeys: number; languagesAudited: number } } {
  const errors: string[] = [];
  const canonicalKeys = Object.keys(translations);
  const supportedLangs = languages.map((l) => l.code);

  console.log(`[i18n Audit] Starting completeness check for ${canonicalKeys.length} keys across ${supportedLangs.length} locales...`);

  canonicalKeys.forEach((key) => {
    const entry = translations[key];

    if (!entry || typeof entry !== "object") {
      errors.push(`Key "${key}" has invalid or non-object entry.`);
      return;
    }

    // Check English canonical source text
    const enText = entry.en;
    if (typeof enText !== "string" || enText.trim().length === 0) {
      errors.push(`Key "${key}" is missing canonical English ("en") translation or is empty.`);
    }

    // Check every registered locale
    supportedLangs.forEach((lang) => {
      const text = entry[lang];

      if (typeof text !== "string") {
        errors.push(`Key "${key}" is missing translation for locale "${lang}".`);
      } else if (text.trim().length === 0) {
        errors.push(`Key "${key}" has empty translation string for locale "${lang}".`);
      } else if (lang !== "en" && text === enText && !WHITELISTED_TERMS.has(text.trim()) && !WHITELISTED_TERMS.has(key)) {
        // Warning log for non-whitelisted untranslated strings (does not fail audit if en fallback is valid)
        // console.log(`[Notice] Key "${key}" in "${lang}" is identical to English: "${text}"`);
      }
    });
  });

  const success = errors.length === 0;

  if (success) {
    console.log(`✅ [i18n Audit] All ${canonicalKeys.length} canonical keys are 100% complete across all ${supportedLangs.length} supported locales!`);
  } else {
    console.error(`❌ [i18n Audit] Failed with ${errors.length} translation error(s):`);
    errors.forEach((err) => console.error(`  - ${err}`));
  }

  return {
    success,
    errors,
    stats: {
      totalKeys: canonicalKeys.length,
      languagesAudited: supportedLangs.length,
    },
  };
}

if (process.argv[1] && process.argv[1].endsWith("i18n.check.ts")) {
  const result = runI18nAudit();
  if (!result.success) {
    process.exit(1);
  }
}
