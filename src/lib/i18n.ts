export type Lang = "en" | "hi" | "gu";

export const languages: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "gu", label: "ગુજરાતી" },
];

type Dict = Record<string, { en: string; hi: string; gu: string }>;

export const t: Dict = {
  appName: { en: "HealthGuard AI", hi: "हेल्थगार्ड एआई", gu: "હેલ્થગાર્ડ એઆઈ" },
  tagline: {
    en: "AI-powered personal health risk assessment",
    hi: "एआई-संचालित व्यक्तिगत स्वास्थ्य जोखिम मूल्यांकन",
    gu: "એઆઈ-સંચાલિત વ્યક્તિગત આરોગ્ય જોખમ મૂલ્યાંકન",
  },
  yourProfile: { en: "Your Profile", hi: "आपकी प्रोफ़ाइल", gu: "તમારી પ્રોફાઇલ" },
  age: { en: "Age", hi: "आयु", gu: "ઉંમર" },
  gender: { en: "Gender", hi: "लिंग", gu: "લિંગ" },
  male: { en: "Male", hi: "पुरुष", gu: "પુરુષ" },
  female: { en: "Female", hi: "महिला", gu: "સ્ત્રી" },
  other: { en: "Other", hi: "अन्य", gu: "અન્ય" },
  height: { en: "Height (cm)", hi: "ऊंचाई (सेमी)", gu: "ઊંચાઈ (સેમી)" },
  weight: { en: "Weight (kg)", hi: "वज़न (किग्रा)", gu: "વજન (કિગ્રા)" },
  smoking: { en: "Smoking", hi: "धूम्रपान", gu: "ધૂમ્રપાન" },
  never: { en: "Never", hi: "कभी नहीं", gu: "ક્યારેય નહીં" },
  former: { en: "Former", hi: "पूर्व", gu: "પૂર્વ" },
  current: { en: "Current", hi: "वर्तमान", gu: "વર્તમાન" },
  exercise: { en: "Exercise frequency", hi: "व्यायाम आवृत्ति", gu: "કસરત આવર્તન" },
  none: { en: "None", hi: "कोई नहीं", gu: "કોઈ નહીં" },
  light: { en: "1-2x / week", hi: "1-2x / सप्ताह", gu: "1-2x / અઠવાડિયું" },
  moderate: { en: "3-4x / week", hi: "3-4x / सप्ताह", gu: "3-4x / અઠવાડિયું" },
  active: { en: "5+ / week", hi: "5+ / सप्ताह", gu: "5+ / અઠવાડિયું" },
  familyHistory: {
    en: "Family history (comma separated)",
    hi: "पारिवारिक इतिहास (अल्पविराम से अलग)",
    gu: "કુટુંબ ઇતિહાસ (અલ્પવિરામથી અલગ)",
  },
  symptoms: {
    en: "Current symptoms",
    hi: "वर्तमान लक्षण",
    gu: "વર્તમાન લક્ષણો",
  },
  analyze: {
    en: "Analyze My Health",
    hi: "मेरा स्वास्थ्य विश्लेषण करें",
    gu: "મારા આરોગ્યનું વિશ્લેષણ કરો",
  },
  analyzing: { en: "Analyzing...", hi: "विश्लेषण हो रहा है...", gu: "વિશ્લેષણ થઈ રહ્યું છે..." },
  riskScores: {
    en: "Lifestyle Risk Scores",
    hi: "जीवनशैली जोखिम स्कोर",
    gu: "જીવનશૈલી જોખમ સ્કોર",
  },
  diabetes: { en: "Diabetes", hi: "मधुमेह", gu: "ડાયાબિટીસ" },
  heartDisease: { en: "Heart Disease", hi: "हृदय रोग", gu: "हृदय रोग" },
  hypertension: { en: "Hypertension", hi: "उच्च रक्तचाप", gu: "हાયપરટેન્શન" },
  bmi: { en: "BMI", hi: "बीएमआई", gu: "બીએમઆઈ" },
  dietPlan: {
    en: "Personalized Diet Plan",
    hi: "व्यक्तिगत आहार योजना",
    gu: "વ્યક્તિગત આહાર યોજના",
  },
  exercisePlan: { en: "Exercise Plan", hi: "व्यायाम योजना", gu: "કસરત યોજના" },
  prevention: { en: "Prevention Tips", hi: "बचाव सुझाव", gu: "નિવારણ સૂચનો" },
  downloadPdf: {
    en: "Download PDF Report",
    hi: "पीडीएफ रिपोर्ट डाउनलोड",
    gu: "પીડીએફ રિપોર્ટ ડાઉનલોડ",
  },
  disclaimer: {
    en: "This tool provides AI-generated estimates for educational purposes only and is not a substitute for professional medical advice.",
    hi: "यह उपकरण केवल शैक्षिक उद्देश्यों के लिए एआई-जनित अनुमान प्रदान करता है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है।",
    gu: "આ સાધન માત્ર શૈક્ષણિક હેતુઓ માટે એઆઈ-જનરેટેડ અંદાજ આપે છે અને વ્યાવસાયિક તબીબી સલાહનો વિકલ્પ નથી.",
  },
  low: { en: "Low", hi: "कम", gu: "ઓછું" },
  moderateRisk: { en: "Moderate", hi: "मध्यम", gu: "મધ્યમ" },
  high: { en: "High", hi: "उच्च", gu: "ઉચ્ચ" },
  overview: { en: "Risk Overview", hi: "जोखिम सिंहावलोकन", gu: "જોખમ વિહંગાવલોકન" },
  riskLevel: { en: "Risk Level", hi: "जोखिम स्तर", gu: "જોખમ સ્તર" },
  overallRisk: { en: "Overall Risk", hi: "समग्र जोखिम", gu: "સમગ્ર જોખમ" },
  heroBadge: { en: "Gemini AI", hi: "जेमिनी एआई", gu: "જેમિની એઆઈ" },
  heroTitle: {
    en: "Understand your health risks in minutes.",
    hi: "मिनटों में अपने स्वास्थ्य जोखिमों को समझें।",
    gu: "મિનિટોમાં તમારા આરોગ્ય જોખમોને સમજો.",
  },
  heroSubtitle: {
    en: "Get personalized lifestyle health risk assessments and AI-generated diet, exercise, and wellness prevention plans tailored to your profile.",
    hi: "अपनी प्रोफ़ाइल के अनुसार व्यक्तिगत जीवनशैली स्वास्थ्य जोखिम आकलन और एआई-जनित आहार, व्यायाम और बचाव योजनाएं प्राप्त करें।",
    gu: "તમારી પ્રોફાઇલ અનુસાર વ્યક્તિગત જીવનશૈલી આરોગ્ય જોખમ મૂલ્યાંકન અને એઆઈ-જનરેટેડ આહાર, કસરત અને નિવારણ યોજનાઓ મેળવો.",
  },
  familyHistoryPh: {
    en: "diabetes, heart disease",
    hi: "मधुमेह, हृदय रोग",
    gu: "ડાયાબિટીસ, હૃદય રોગ",
  },
  symptomsPh: {
    en: "fatigue, headaches…",
    hi: "थकान, सिरदर्द…",
    gu: "થાક, માથાનો દુખાવો…",
  },
};

export function tr(key: keyof typeof t, lang: Lang): string {
  return t[key]?.[lang] ?? t[key]?.en ?? key;
}
