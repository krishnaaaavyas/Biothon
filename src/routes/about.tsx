import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  Heart,
  Users,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  HeartPulse,
  Activity,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  useEffect(() => {
    document.title = "About HealthGuard — Educational Assessment Portal";
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <SiteHeader />

        {/* Hero Section */}
        <section className="border-b border-border bg-surface-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-35 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal/40 to-transparent" />
          <div className="mx-auto max-w-7xl px-6 py-24 relative text-center">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
            >
              About the Platform
            </Badge>
            <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
              HealthGuard
            </h1>
            <p className="mt-6 mx-auto max-w-3xl text-lg sm:text-xl leading-relaxed text-muted-foreground">
              AI-powered preventive health insights for Type 2 Diabetes, Hypertension, and Heart
              Disease.
            </p>
          </div>
        </section>

        {/* Developers Section */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <Card className="border-border/80 bg-surface shadow-card-soft overflow-hidden hover:border-teal/30 hover:shadow-md transition-all duration-300">
            <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal/10 text-teal">
                <Users className="h-7 w-7" />
              </div>
              <div className="space-y-1 text-center md:text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-teal font-mono">
                  Built By
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Krish Savaliya & Krishna Vyas
                </h2>
                <p className="text-sm text-muted-foreground">
                  Software Developers & AI Enthusiasts dedicated to accessible preventive health
                  technology solutions.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Focus Areas Section */}
        <section className="border-t border-b border-border bg-surface-muted/10 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <Badge
                variant="secondary"
                className="rounded-full bg-teal/10 text-teal border border-teal/20"
              >
                Core Domains
              </Badge>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
                Focus Areas
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Our platform targets metabolic and cardiovascular risk factors before symptoms
                present.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Brain,
                  title: "Diabetes Risk",
                  desc: "Evaluating glucose indicators, physical lifestyle habits, age-based onset vectors, and genetic family history.",
                },
                {
                  icon: Activity,
                  title: "Hypertension Risk",
                  desc: "Analyzing body metrics, high sodium dietary inputs, physical levels, and blood pressure markers.",
                },
                {
                  icon: Heart,
                  title: "Heart Disease Risk",
                  desc: "Determining cardiovascular profile, lipid indicators, tobacco habits, and custom preventive schedules.",
                },
              ].map((f, idx) => (
                <Card
                  key={idx}
                  className="border-border/80 bg-surface shadow-card-soft hover:shadow-md hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal">
                      <f.icon className="h-5.5 w-5.5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Educational Project Section */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20"
            >
              Framework & Ethics
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
              Educational Project Links
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              HealthGuard is designed with transparent development standards and secure data
              handling mechanisms.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Privacy Card */}
            <Link to="/privacy" className="group block">
              <Card className="border-border bg-surface shadow-card-soft group-hover:border-teal/50 group-hover:shadow-md transition-all duration-300 h-full">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-teal transition-colors flex items-center gap-1.5">
                      Privacy Policy{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Learn how we store data locally on your device, protect your authenticated
                      inputs, and guarantee that we never sell your records.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Clinical Sources Card */}
            <Link to="/clinical-sources" className="group block">
              <Card className="border-border bg-surface shadow-card-soft group-hover:border-teal/50 group-hover:shadow-md transition-all duration-300 h-full">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-teal transition-colors flex items-center gap-1.5">
                      Clinical Sources{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Explore the medical guidelines (ADA, AHA, ACC) and clinical screening
                      references powering our logic and scoring maps.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Disclaimer Section */}
        <section className="mx-auto max-w-4xl px-6 pb-20">
          <Card className="border border-danger/30 bg-danger/5 text-danger-foreground rounded-2xl overflow-hidden">
            <CardContent className="p-6 flex items-start gap-4">
              <ShieldAlert className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-foreground">
                  Medical Disclaimer
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This platform provides educational health insights and is not a medical diagnosis
                  tool. All calculations, diet suggestions, wellness schedules, and risk ratios are
                  purely educational. For diagnostic examinations, consult a qualified clinical
                  physician.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
