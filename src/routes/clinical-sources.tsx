import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HeartPulse, Activity, Brain, BookOpen, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/clinical-sources")({
  component: ClinicalSourcesPage,
});

function ClinicalSourcesPage() {
  useEffect(() => {
    document.title = "Clinical Sources — HealthGuard";
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <SiteHeader />

        {/* Hero Section */}
        <section className="border-b border-border bg-surface-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
          <div className="mx-auto max-w-7xl px-6 py-20 relative">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
            >
              Evidence-Based Medicine
            </Badge>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground">
              Clinical Guidelines & Sources
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              HealthGuard's deterministic risk scoring and AI insights are structured based on
              recognized clinical guidelines and publications from leading global health
              organizations.
            </p>
          </div>
        </section>

        {/* Sources Detail */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-3">
            {/* Source 1: Diabetes */}
            <Card className="border-border bg-surface shadow-card-soft hover:shadow-md hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Diabetes Risk
                    </h3>
                    <p className="text-xs text-muted-foreground">Type 2 Diabetes Screening</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal font-mono">
                    Primary Source
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    American Diabetes Association (ADA) Standards of Care in Diabetes
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Our scoring adapts risk criteria such as age threshold (onset risk changes at
                    35+ or 45+), body mass index (BMI) thresholds, physical inactivity, family
                    history of diabetes, and gestational considerations.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Source 2: Hypertension */}
            <Card className="border-border bg-surface shadow-card-soft hover:shadow-md hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Hypertension Risk
                    </h3>
                    <p className="text-xs text-muted-foreground">Blood Pressure Classifications</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal font-mono">
                    Primary Source
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    ACC/AHA Hypertension Guidelines & JNC 8 Reference
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Classification ranges mapping systolic/diastolic metrics into normal (&lt;120/80
                    mmHg), elevated (120-129/&lt;80 mmHg), Stage 1 (130-139 or 80-89 mmHg), and
                    Stage 2 (&ge;140/90 mmHg) to determine active cardiovascular lifestyle
                    guidelines.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Source 3: Heart Disease */}
            <Card className="border-border bg-surface shadow-card-soft hover:shadow-md hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">
                      Heart Disease Risk
                    </h3>
                    <p className="text-xs text-muted-foreground">Cardiovascular Risk Estimation</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal font-mono">
                    Primary Source
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    AHA/ACC ASCVD Risk Estimator & Pooled Cohort Equations
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Predictive risk evaluation incorporating cholesterol ratios, blood pressure
                    management status, diabetes diagnostics, smoking status, age range, and gender
                    factor as standard parameters for general cardiovascular tracking.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Disclaimer section */}
        <section className="border-t border-border bg-surface-muted/20 py-16">
          <div className="mx-auto max-w-4xl px-6 flex flex-col items-center gap-4">
            <BookOpen className="h-8 w-8 text-teal" />
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Educational Project Statement
            </h2>
            <p className="text-center text-sm leading-relaxed text-muted-foreground max-w-2xl">
              HealthGuard's algorithms are structured as a demonstration of technical logic and
              public health framework implementations. Calculations are estimates and must never be
              interpreted as diagnostic, prescriptive, or clinical advice. Always review symptoms
              and health plans with a certified healthcare provider.
            </p>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
