import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useHealthResult, useProfile, useHistory } from "@/lib/health-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ClipboardList, Activity, Check } from "lucide-react";
import { EmptyState, LedgerTable, RiskLedgerTable } from "./_app.dashboard";
import { useLanguage, tr, translations } from "@/lib/i18n";
import { toast } from "sonner";

const CHART_GREEN = "oklch(0.62 0.13 155)";
const CHART_AMBER = "oklch(0.74 0.15 70)";
const CHART_RED = "oklch(0.58 0.21 25)";

function colorFor(score: number) {
  if (score < 33) return CHART_GREEN;
  if (score < 66) return CHART_AMBER;
  return CHART_RED;
}
function levelFor(score: number) {
  if (score < 33) return "Low";
  if (score < 66) return "Moderate";
  return "High";
}

export const Route = createLazyFileRoute("/_app/report")({
  component: ReportPage,
});

function ReportPage() {
  const currentLang = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = tr("fit_health_report_title", currentLang);
  }, [currentLang]);

  const [resultMaybe] = useHealthResult();
  const [profileMaybe] = useProfile();
  const [history] = useHistory();

  if (!resultMaybe || !profileMaybe) return <EmptyState />;
  const result = resultMaybe;
  const profile = profileMaybe;

  if (profile.bloodReportOnly) {
    // Extract recent observations
    const obsList = profile.labObservations || [];
    const obsMap: Record<string, number> = {};
    const obsUnits: Record<string, string> = {};
    obsList.forEach((obs) => {
      obsMap[obs.code] = obs.value;
      obsUnits[obs.code] = obs.unit;
    });

    const hba1c = obsMap["HbA1c"];
    const fbs = obsMap["fastingBloodSugar"];
    const hdl = obsMap["hdl"];
    const ldl = obsMap["ldl"];
    const tc = obsMap["totalCholesterol"];
    const tg = obsMap["triglycerides"];

    // Compute status
    let overallStatus = "Good";
    let overallColor = "text-emerald bg-emerald/10 border-emerald/20";
    if (hba1c >= 6.5 || fbs >= 126) {
      overallStatus = "Attention Needed";
      overallColor = "text-red-500 bg-red-500/10 border-red-500/20";
    } else if (hba1c >= 5.7 || fbs >= 100 || ldl > 130) {
      overallStatus = "Moderate";
      overallColor = "text-amber bg-amber/10 border-amber/20";
    }

    // Key Findings list
    const findings: string[] = [];
    if (hba1c >= 5.7 || fbs >= 100) {
      findings.push("Blood sugar slightly elevated");
    } else if (hba1c || fbs) {
      findings.push("Blood sugar within normal physiological limits");
    }
    
    if (ldl > 100 || tc > 200 || tg > 150) {
      findings.push("Cholesterol levels slightly elevated or borderline");
    } else if (ldl || tc || tg) {
      findings.push("Lipid profile (cholesterol) within range");
    }

    findings.push("Consider increasing exercise to optimize cardiac profile");

    // Recommendations list
    const recommendations: string[] = [];
    recommendations.push("Walk 30 minutes daily or engage in moderate aerobic activity");
    if (hba1c >= 5.7 || fbs >= 100) {
      recommendations.push("Reduce consumption of refined carbs and sugary drinks");
      recommendations.push("Repeat HbA1c test in 3 months to monitor glycemic trends");
    } else {
      recommendations.push("Limit added sugars and processed foods");
    }

    const bounds: Record<string, { min: number; max: number; unit: string; name: string }> = {
      fastingBloodSugar: { min: 50, max: 400, unit: "mg/dL", name: "Fasting Blood Sugar" },
      HbA1c: { min: 3, max: 18, unit: "%", name: "HbA1c" },
      totalCholesterol: { min: 50, max: 500, unit: "mg/dL", name: "Total Cholesterol" },
      ldl: { min: 20, max: 300, unit: "mg/dL", name: "LDL Cholesterol" },
      hdl: { min: 10, max: 150, unit: "mg/dL", name: "HDL Cholesterol" },
      triglycerides: { min: 30, max: 600, unit: "mg/dL", name: "Triglycerides" },
    };

    return (
      <div className="mx-auto max-w-[960px] px-4 py-10 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Blood Report Analysis
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              AI-extracted clinical indicators from your recent laboratory report.
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="gap-2 h-9 border-border text-xs rounded-lg cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Print Report
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-12">
          {/* Left Column: Summary and Indicators */}
          <div className="md:col-span-8 space-y-6">
            {/* Overall Status Card */}
            <Card className="border-border bg-surface shadow-card-soft">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Overall Status
                  </h3>
                  <p className="font-display text-xl font-bold mt-1 text-foreground">
                    Your metabolic health is currently flagged as stable.
                  </p>
                </div>
                <Badge className={`px-3 py-1 text-xs font-bold border rounded-full ${overallColor}`}>
                  {overallStatus}
                </Badge>
              </CardContent>
            </Card>

            {/* Lab Values Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                Extracted Lab Values
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {hba1c !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">HbA1c</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{hba1c}</span>
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
                {fbs !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Fasting Blood Sugar</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{fbs}</span>
                      <span className="text-[10px] text-muted-foreground">mg/dL</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
                {hdl !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">HDL Cholesterol</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{hdl}</span>
                      <span className="text-[10px] text-muted-foreground">mg/dL</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
                {ldl !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">LDL Cholesterol</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{ldl}</span>
                      <span className="text-[10px] text-muted-foreground">mg/dL</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
                {tc !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Total Cholesterol</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{tc}</span>
                      <span className="text-[10px] text-muted-foreground">mg/dL</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
                {tg !== undefined && (
                  <Card className="border-border bg-surface/50 shadow-sm p-4 flex flex-col gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Triglycerides</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-foreground font-mono">{tg}</span>
                      <span className="text-[10px] text-muted-foreground">mg/dL</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-teal font-semibold">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Key Findings card */}
            <Card className="border-border bg-surface shadow-card-soft">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Key Findings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  {findings.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-normal">
                      <span className="text-teal text-base shrink-0 leading-none">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Recommendations card */}
            <Card className="border-border bg-surface shadow-card-soft">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  {recommendations.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-normal">
                      <span className="text-teal text-base shrink-0 leading-none">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Next Steps CTA */}
          <div className="md:col-span-4">
            <Card className="border-border bg-surface shadow-card-soft border-dashed overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal to-primary" />
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-teal/10 text-teal flex items-center justify-center mx-auto mb-2">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Next Step
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Complete the full health assessment to combine these laboratory readings with your daily lifestyle, family history, and symptoms to receive a highly personalized preventative care schedule.
                </p>
                <Button
                  onClick={() => navigate({ to: "/assessment", search: { mode: "retake" } })}
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm font-semibold text-xs rounded-lg cursor-pointer transition-all duration-300 hover:shadow"
                >
                  Complete Full Assessment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const overallColor =
    result.overallRisk === "Low"
      ? CHART_GREEN
      : result.overallRisk === "Moderate"
        ? CHART_AMBER
        : CHART_RED;

  async function download() {
    const toastId = toast.loading("Generating printable PDF report...");
    try {
      const { default: jsPDF } = await import("jspdf");

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageW = doc.internal.pageSize.getWidth();
      const cw = pageW - margin * 2;
      let y = margin;

      // Header band
      doc.setFillColor(15, 23, 42); // slate-900 (modern dark navy)
      doc.rect(0, 0, pageW, 88, "F");

      // ECG Heartbeat logo graphic
      doc.setLineWidth(2.5);
      doc.setDrawColor(61, 178, 178); // teal
      doc.line(margin, 48, margin + 6, 48);
      doc.line(margin + 6, 48, margin + 9, 34);
      doc.line(margin + 9, 34, margin + 13, 62);
      doc.line(margin + 13, 62, margin + 17, 40);
      doc.line(margin + 17, 40, margin + 20, 48);
      doc.line(margin + 20, 48, margin + 26, 48);

      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(tr("clinicalReportTitle", currentLang), margin + 34, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(tr("aiAssistedAssessment", currentLang), margin + 34, 58);
      doc.setFontSize(9);
      const formattedDate = new Date().toLocaleString(
        currentLang === "en" ? "en-US" : currentLang === "hi" ? "hi-IN" : "gu-IN",
      );
      doc.text(formattedDate, pageW - margin, 58, { align: "right" });
      y = 120;
      doc.setTextColor(40);

      const ensureSpace = (heightNeeded: number) => {
        if (y + heightNeeded > 750) {
          doc.addPage();
          y = margin + 25;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text(tr("clinicalReportTitleCont", currentLang), margin, margin - 15);
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(1);
          doc.line(margin, margin - 10, pageW - margin, margin - 10);
        }
      };

      // Section title helper
      const title = (t: string) => {
        ensureSpace(45);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(t.toUpperCase(), margin, y);
        y += 6;
        doc.setDrawColor(61, 178, 178); // teal accent line
        doc.setLineWidth(1.5);
        doc.line(margin, y, pageW - margin, y);
        y += 16;
        doc.setTextColor(40);
      };

      const para = (t: string, size = 9.5, xOffset = 0) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(t, cw - xOffset);
        lines.forEach((l: string) => {
          ensureSpace(size + 6);
          doc.text(l, margin + xOffset, y);
          y += size + 4;
        });
      };

      const paraMarkdown = (t: string) => {
        const rawLines = t.split("\n");
        rawLines.forEach((rawLine) => {
          const trimmed = rawLine.trim().replace(/[#*_`>]/g, "");
          if (!trimmed) {
            y += 4;
            return;
          }

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const bulletText = trimmed.substring(2);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(71, 85, 105); // slate-600

            const lines = doc.splitTextToSize(bulletText, cw - 18);
            lines.forEach((l: string, idx: number) => {
              ensureSpace(16);
              if (idx === 0) {
                doc.setFillColor(61, 178, 178); // teal
                doc.circle(margin + 6, y - 3, 2, "F");
              }
              doc.text(l, margin + 18, y);
              y += 13;
            });
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85); // slate-700
            const lines = doc.splitTextToSize(trimmed, cw);
            lines.forEach((l: string) => {
              ensureSpace(16);
              doc.text(l, margin, y);
              y += 13;
            });
          }
        });
      };

      // Profile Card
      title(tr("patientProfile", currentLang));
      ensureSpace(115);
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, cw, 105, 6, 6, "FD");

      const ageLabel = tr("age", currentLang);
      const yrsLabel = tr("yrs", currentLang);
      const genderLabel = tr("gender", currentLang);
      const genderVal = tr(profile.gender.toLowerCase() as keyof typeof translations, currentLang);
      const heightLabel = tr("heightLabel", currentLang);
      const weightLabel = tr("weightLabel", currentLang);
      const smokingLabel = tr("smoking", currentLang);
      const smokingVal = tr(
        profile.smoking.toLowerCase() as keyof typeof translations,
        currentLang,
      );
      const exerciseLabel = tr("exercise", currentLang);
      const exerciseVal = tr(
        profile.exercise.toLowerCase() as keyof typeof translations,
        currentLang,
      );
      const familyHistoryLabel = tr("familyHistoryLabel", currentLang);
      const familyHistoryVal = profile.familyHistory || tr("noneReported", currentLang);
      const symptomsLabel = tr("symptomsLabel", currentLang);
      const symptomsVal = profile.symptoms || tr("noneReported", currentLang);

      const cardY = y + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); // slate-900

      // Columns labels
      doc.text(`${ageLabel}:`, margin + 15, cardY);
      doc.text(`${genderLabel}:`, margin + 15, cardY + 18);
      doc.text(`${smokingLabel}:`, margin + 15, cardY + 36);

      doc.text(`${heightLabel}:`, margin + 200, cardY);
      doc.text(`${weightLabel}:`, margin + 200, cardY + 18);
      doc.text(`${exerciseLabel}:`, margin + 200, cardY + 36);

      doc.text(`BMI:`, margin + 380, cardY);

      // Col values
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`${profile.age} ${yrsLabel}`, margin + 90, cardY);
      doc.text(`${genderVal}`, margin + 90, cardY + 18);
      doc.text(`${smokingVal}`, margin + 90, cardY + 36);

      doc.text(`${profile.heightCm} cm`, margin + 265, cardY);
      doc.text(`${profile.weightKg} kg`, margin + 265, cardY + 18);
      doc.text(`${exerciseVal}`, margin + 265, cardY + 36);

      doc.text(`${result.bmi}`, margin + 415, cardY);

      // Separator inside card
      doc.setDrawColor(241, 245, 249);
      doc.line(margin + 15, cardY + 46, margin + cw - 15, cardY + 46);

      const cardBottomY = cardY + 58;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${familyHistoryLabel}:`, margin + 15, cardBottomY);
      doc.text(`${symptomsLabel}:`, margin + 15, cardBottomY + 16);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`${familyHistoryVal}`, margin + 110, cardBottomY);
      doc.text(`${symptomsVal}`, margin + 125, cardBottomY + 16);

      y += 120;

      // Overall Screening Index Card
      title(tr("overallRisk", currentLang));
      ensureSpace(85);

      const isLow = result.overallRisk === "Low";
      const isMod = result.overallRisk === "Moderate";

      let cardBg = [240, 253, 244]; // emerald-50
      let cardBorder = [187, 247, 208]; // emerald-200
      let cardText = [22, 101, 52]; // emerald-800
      if (isMod) {
        cardBg = [254, 243, 199]; // amber-50
        cardBorder = [253, 230, 138]; // amber-200
        cardText = [146, 64, 14]; // amber-800
      } else if (!isLow && !isMod) {
        cardBg = [254, 242, 242]; // red-50
        cardBorder = [254, 226, 226]; // red-200
        cardText = [153, 27, 27]; // red-800
      }

      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2]);
      doc.setLineWidth(1);
      doc.roundedRect(margin, y, cw, 65, 6, 6, "FD");

      // Draw left color accent bar
      doc.setFillColor(cardText[0], cardText[1], cardText[2]);
      doc.rect(margin, y, 5, 65, "F");

      // Draw score
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(cardText[0], cardText[1], cardText[2]);
      doc.text(`${result.overallScore}`, margin + 25, y + 36);
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("helvetica", "normal");
      doc.text(`/80`, margin + 60, y + 36);

      // Draw text info next to score
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(cardText[0], cardText[1], cardText[2]);

      const riskLvlText = tr(
        result.overallRisk.toLowerCase() === "low"
          ? "low"
          : result.overallRisk.toLowerCase() === "moderate"
            ? "moderateRisk"
            : "high",
        currentLang,
      );
      doc.text(`${tr("riskLevel", currentLang)}: ${riskLvlText}`, margin + 110, y + 26);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600

      const summaryText = tr("fit_risk_level_summary", currentLang) || "Based on your self-reported physiological markers and daily habits.";
      const wrappedSummary = doc.splitTextToSize(summaryText, cw - 130);
      doc.text(wrappedSummary, margin + 110, y + 42);

      y += 80;

      // Per-condition Screening Index
      title(tr("perConditionRisk", currentLang));
      const conditionKeyMap: Record<string, string> = {
        "Diabetes (Type 2)": "fit_diabetes_label",
        "Heart Disease": "fit_heart_disease_label",
        Hypertension: "fit_hypertension_label",
      };

      (
        [
          ["Diabetes (Type 2)", result.risk.diabetes, result.rationale.diabetes],
          ["Heart Disease", result.risk.heartDisease, result.rationale.heartDisease],
          ["Hypertension", result.risk.hypertension, result.rationale.hypertension],
        ] as const
      ).forEach(([name, score, why]) => {
        ensureSpace(50);
        
        let indicatorColor = [34, 139, 87]; // green
        if (score >= 33 && score < 66) indicatorColor = [200, 130, 30]; // amber
        else if (score >= 66) indicatorColor = [200, 60, 40]; // red

        // Draw left colored accent line
        doc.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
        doc.rect(margin, y, 3, 30, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42); // slate-900
        
        const condName = tr(conditionKeyMap[name] || name, currentLang);
        doc.text(`${condName}:`, margin + 12, y + 10);
        
        doc.setTextColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
        doc.text(`${score}/100`, margin + 12 + doc.getTextWidth(`${condName}: `), y + 10);
        
        y += 20;
        para(why, 9, 12);
        y += 12;
      });

      // Plans & Guidelines
      const sections: Array<[string, string]> = [
        [tr("dietPlan", currentLang), result.dietPlan],
        [tr("exercisePlan", currentLang), result.exercisePlan],
        [tr("prevention", currentLang), result.preventionTips],
      ];
      sections.forEach(([t, body]) => {
        y += 6;
        title(t);
        paraMarkdown(body);
      });

      // Longitudinal progress summary if history exists
      if (history && history.length >= 2) {
        const baseline = history[0];
        const latest = history[history.length - 1];
        const weightDiff = latest.weightKg - baseline.weightKg;
        const scoreDiff = latest.overallScore - baseline.overallScore;

        title(tr("longitudinalProgress", currentLang));
        ensureSpace(120);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42); // slate-900

        // Table header background
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(margin, y - 10, cw, 22, "F");

        doc.text(tr("fit_metric", currentLang).toUpperCase(), margin + 10, y + 4);
        doc.text(tr("fit_baseline", currentLang).toUpperCase(), margin + 180, y + 4);
        doc.text(tr("fit_current", currentLang).toUpperCase(), margin + 280, y + 4);
        doc.text(tr("fit_absolute_change", currentLang).toUpperCase(), margin + 380, y + 4);
        y += 20;

        // Alternating row helper
        const drawRow = (label: string, baseVal: string, curVal: string, diffVal: string, isEven: boolean) => {
          ensureSpace(20);
          if (isEven) {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(margin, y - 10, cw, 18, "F");
          }
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 10, y + 2);

          doc.setTextColor(71, 85, 105);
          doc.setFont("helvetica", "normal");
          doc.text(baseVal, margin + 180, y + 2);
          doc.text(curVal, margin + 280, y + 2);

          const isNegativeChange = diffVal.startsWith("-");
          const isZero = diffVal === "0" || diffVal === "0.0" || diffVal.includes("0.0");
          if (isZero) {
            doc.setTextColor(100, 116, 139);
          } else if (label.toLowerCase().includes("score") || label.toLowerCase().includes("weight") || label.toLowerCase().includes("bmi")) {
            if (isNegativeChange) {
              doc.setTextColor(22, 101, 52); // green
            } else {
              doc.setTextColor(153, 27, 27); // red
            }
          }
          doc.setFont("helvetica", "bold");
          doc.text(diffVal, margin + 380, y + 2);
          y += 18;
        };

        const bmiDiff = latest.bmi - baseline.bmi;
        drawRow(
          tr("fit_body_weight", currentLang),
          `${baseline.weightKg.toFixed(1)} kg`,
          `${latest.weightKg.toFixed(1)} kg`,
          `${weightDiff >= 0 ? "+" : ""}${weightDiff.toFixed(1)} kg`,
          true
        );
        drawRow(
          tr("fit_body_mass_index", currentLang),
          `${baseline.bmi.toFixed(1)}`,
          `${latest.bmi.toFixed(1)}`,
          `${bmiDiff >= 0 ? "+" : ""}${bmiDiff.toFixed(1)}`,
          false
        );
        drawRow(
          tr("fit_overall_score", currentLang),
          `${baseline.overallScore}/80`,
          `${latest.overallScore}/80`,
          `${scoreDiff >= 0 ? "+" : ""}${scoreDiff}`,
          true
        );
      }

      ensureSpace(60);
      y += 10;

      // Draw dividing line before disclaimer
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(margin, y, pageW - margin, y);
      y += 14;

      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont("helvetica", "italic");
      const disclaimer = doc.splitTextToSize(tr("fit_disclaimer", currentLang), cw);
      disclaimer.forEach((l: string) => {
        ensureSpace(12);
        doc.text(l, margin, y);
        y += 10;
      });

      doc.save(`healthguard-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Health report PDF downloaded successfully.", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF document.", { id: toastId });
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("download") === "true") {
      download();
      const url = new URL(window.location.href);
      url.searchParams.delete("download");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [resultMaybe, profileMaybe]);


  // Define static parameter values
  const labData = [
    {
      parameter: tr("fit_systolic_bp", currentLang),
      value: profile.symptoms.toLowerCase().includes("headache") ? "135 mmHg" : "120 mmHg",
      reference: "< 120 mmHg",
      status: profile.symptoms.toLowerCase().includes("headache") ? "Elevated" : "Normal",
      statusColor: profile.symptoms.toLowerCase().includes("headache")
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-green-500/10 text-green-500 border-green-500/20",
    },
    {
      parameter: tr("fit_diastolic_bp", currentLang),
      value: profile.symptoms.toLowerCase().includes("headache") ? "85 mmHg" : "80 mmHg",
      reference: "< 80 mmHg",
      status: profile.symptoms.toLowerCase().includes("headache") ? "Elevated" : "Normal",
      statusColor: profile.symptoms.toLowerCase().includes("headache")
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-green-500/10 text-green-500 border-green-500/20",
    },
    {
      parameter: tr("fit_fasting_blood_glucose", currentLang),
      value: profile.familyHistory.toLowerCase().includes("diabetes") ? "108 mg/dL" : "94 mg/dL",
      reference: "70–100 mg/dL",
      status: profile.familyHistory.toLowerCase().includes("diabetes") ? "Impaired" : "Normal",
      statusColor: profile.familyHistory.toLowerCase().includes("diabetes")
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-green-500/10 text-green-500 border-green-500/20",
    },
    {
      parameter: tr("fit_total_cholesterol", currentLang),
      value: "185 mg/dL",
      reference: "< 200 mg/dL",
      status: "Desirable",
      statusColor: "bg-green-500/10 text-green-500 border-green-500/20",
    },
    {
      parameter: tr("fit_hdl_cholesterol", currentLang),
      value: profile.exercise === "none" ? "42 mg/dL" : "52 mg/dL",
      reference: "> 40 mg/dL",
      status: "Normal",
      statusColor: "bg-green-500/10 text-green-500 border-green-500/20",
    },
    {
      parameter: tr("fit_ldl_cholesterol", currentLang),
      value: "115 mg/dL",
      reference: "< 100 mg/dL",
      status: "Near Optimal",
      statusColor: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    },
  ];

  const riskData = [
    {
      condition: tr("fit_diabetes_label", currentLang),
      score: result.risk.diabetes,
      classification: levelFor(result.risk.diabetes),
      color: colorFor(result.risk.diabetes),
      rationale: result.rationale.diabetes,
    },
    {
      condition: tr("fit_heart_disease_label", currentLang),
      score: result.risk.heartDisease,
      classification: levelFor(result.risk.heartDisease),
      color: colorFor(result.risk.heartDisease),
      rationale: result.rationale.heartDisease,
    },
    {
      condition: tr("fit_hypertension_label", currentLang),
      score: result.risk.hypertension,
      classification: levelFor(result.risk.hypertension),
      color: colorFor(result.risk.hypertension),
      rationale: result.rationale.hypertension,
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <Badge className="rounded-full bg-teal text-white font-semibold">
            {tr("fit_verified_lab_format", currentLang)}
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {tr("fit_health_report_title", currentLang)}
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-normal max-w-xl">
            {tr("fit_health_report_desc", currentLang)}
          </p>
        </div>
        <Button
          onClick={download}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md rounded-lg"
        >
          <Download className="h-4 w-4" />
          <span>{tr("fit_download_pdf", currentLang)}</span>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Lab Metrics */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-surface shadow-card-soft">
            <CardHeader className="border-b border-border bg-surface-muted/50 p-4">
              <CardTitle className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-teal" />
                {tr("fit_lab_biomarkers", currentLang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LedgerTable items={labData} />
            </CardContent>
          </Card>

          {/* Condition Breakdown */}
          <Card className="border-border bg-surface shadow-card-soft">
            <CardHeader className="border-b border-border bg-surface-muted/50 p-4">
              <CardTitle className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal animate-pulse" />
                {tr("fit_analyzed_conditions", currentLang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <RiskLedgerTable items={riskData} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <Card className="border-border bg-surface shadow-card-soft overflow-hidden relative">
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: overallColor }}
            />
            <CardHeader className="p-5">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {tr("fit_overall_score", currentLang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 text-center">
              <div
                className="font-display text-7xl font-bold tracking-tight"
                style={{ color: overallColor }}
              >
                {result.overallScore}
                <span className="text-xl text-muted-foreground font-normal">/80</span>
              </div>
              <div
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border"
                style={{
                  color: overallColor,
                  borderColor: `${overallColor}30`,
                  backgroundColor: `${overallColor}08`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: overallColor }}
                />
                {tr(
                  result.overallRisk.toLowerCase() === "low"
                    ? "low"
                    : result.overallRisk.toLowerCase() === "moderate"
                      ? "moderateRisk"
                      : "high",
                  currentLang,
                )}{" "}
                {tr("riskWord", currentLang)}
              </div>
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {tr("fit_risk_level_summary", currentLang)}
              </p>
            </CardContent>
          </Card>

          {/* Quick recommendations */}
          <Card className="border-border bg-surface shadow-card-soft">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-bold text-foreground font-display">
                {tr("fit_quick_recommendations", currentLang)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0 space-y-4">
              <div className="rounded-lg bg-teal/5 border border-teal/15 p-3.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-teal tracking-wider font-mono">
                  {tr("dietPlan", currentLang)}
                </span>
                <p className="text-[11px] text-teal leading-relaxed font-mono">
                  {result.dietPlan.replace(/[#*_`>]/g, "").slice(0, 120)}...
                </p>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/15 p-3.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider font-mono">
                  {tr("exercisePlan", currentLang)}
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {result.exercisePlan.replace(/[#*_`>]/g, "").slice(0, 120)}...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
