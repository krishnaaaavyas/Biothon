import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  Heart,
  LineChart,
  Lock,
  MessageSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  Watch,
  ThumbsUp,
  BookOpen,
  Check,
  Plus,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  useEffect(() => {
    document.title = "HealthGuard — Health Awareness & Risk Assessment";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal/40 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:py-24 items-center">
          {/* Left side: Content & CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[52px]">
              Identify your chronic health risks in 10 minutes.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Understand your risk for Type 2 Diabetes, Hypertension, and Heart Disease using
              simple, everyday indicators. Get personalized, easy-to-follow lifestyle guidance to
              protect your health.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 px-6 font-semibold"
              >
                <Link to="/assessment">
                  Start Assessment <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base font-semibold hover:bg-accent/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground border-t border-border/60 pt-6">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> No medical records required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Private on-device processing
              </span>
            </div>
          </div>

          {/* Right side: Modern, minimal visual showcase of focus areas */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="relative w-full max-w-[420px] py-6 space-y-4">
              {/* Vibrant gradients and background glows */}
              <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-teal/20 via-primary/5 to-teal/10 blur-3xl opacity-75 pointer-events-none" />

              {/* Card 1: Type 2 Diabetes */}
              <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-teal/30 group">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-teal to-teal/60" />
                <div className="flex gap-4 items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors duration-300 group-hover:bg-teal group-hover:text-primary-foreground">
                    <Brain className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      Type 2 Diabetes
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Glucose baselines, family history, and physical activity indicators.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Hypertension */}
              <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8_30px_rgba(0,0,0,0.04)] hover:border-teal/30 group">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-teal to-teal/60" />
                <div className="flex gap-4 items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors duration-300 group-hover:bg-teal group-hover:text-primary-foreground">
                    <Activity className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">Hypertension</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Blood pressure markers, dietary habits, and weight indicators.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: Heart Disease */}
              <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-teal/30 group">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-teal to-teal/60" />
                <div className="flex gap-4 items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal transition-colors duration-300 group-hover:bg-teal group-hover:text-primary-foreground">
                    <Heart className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">
                      Heart Disease
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Cardiovascular risk baseline and personalized preventive guidance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why HealthGuard? */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xs shrink-0">
              <Badge
                variant="secondary"
                className="rounded-full bg-teal/10 text-teal border border-teal/20"
              >
                Why HealthGuard?
              </Badge>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
                Your Health Assistant
              </h2>
            </div>
            <div className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
              HealthGuard provides an independent, on-device assessment portal that helps you map
              metabolic and cardiovascular risk factors before symptoms manifest. Our platform
              offers clear, clinical-guideline-aligned guidance and generative diet and wellness
              plans tailored to your regional language.
            </div>
          </div>
        </div>
      </section>

      {/* Simple 3-Step Guide Section */}
      <section className="border-b border-border bg-surface-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl mb-12">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20"
            >
              How It Helps You
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
              A simple 3-step explanation
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              HealthGuard is designed to be simple, plain-language, and easy to use.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "Step 1",
                title: "Complete a health assessment",
                desc: "Fill out a simple, 10-minute questionnaire about your everyday habits, nutrition, physical activity, and family health history.",
              },
              {
                step: "Step 2",
                title: "Analyze lifestyle risk factors",
                desc: "Get a clear, plain-language summary showing your potential risk scores and what they mean in everyday terms.",
              },
              {
                step: "Step 3",
                title: "Receive personalized prevention guidance",
                desc: "Get an AI-designed weekly meal schedule and activity guideline customized specifically to fit your lifestyle.",
              },
            ].map((s) => (
              <Card
                key={s.step}
                className="border-border bg-surface shadow-card-soft hover:shadow-md transition-all duration-300"
              >
                <CardContent className="p-6 space-y-3">
                  <div className="text-xs font-bold text-teal uppercase tracking-widest">
                    {s.step}
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12">
          <div className="lg:col-span-4 flex flex-col justify-center">
            <Badge variant="secondary" className="rounded-full w-fit">
              FAQ
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">Questions.</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Have other inquiries? Reach out on our{" "}
              <Link
                to="/contact"
                className="text-teal underline underline-offset-4 hover:text-teal/80"
              >
                Support page
              </Link>
              .
            </p>
          </div>
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "Is HealthGuard a medical device?",
                  a: "No. HealthGuard is a preventive health information tool. It provides educational risk estimates and lifestyle guidance and is not a substitute for diagnosis, treatment, or professional medical advice.",
                },
                {
                  q: "How accurate is the risk scoring?",
                  a: "The scoring uses guideline-aligned risk factors (BMI, age, smoking, exercise, family history). Risk percentages are generated by a clinical AI model and are intended as directional indicators — not clinical diagnoses.",
                },
                {
                  q: "Where is my data stored?",
                  a: "Your assessment data is stored locally on your device by default. Reports you download are generated client-side. We do not sell or share personal health data.",
                },
                {
                  q: "Does it support Indian dietary preferences?",
                  a: "Yes. Diet plans are generated in English, Hindi, or Gujarati and adapt to regional cuisines and vegetarian/non-vegetarian preferences.",
                },
                {
                  q: "Can I share my report with my doctor?",
                  a: "Absolutely. The Health Report page generates a clinician-friendly PDF you can email, print, or upload to your patient portal.",
                },
                {
                  q: "How often should I reassess?",
                  a: "We recommend reassessing every 4–8 weeks if you're actively working on lifestyle changes, and at least quarterly for general monitoring.",
                },
              ].map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/80">
                  <AccordionTrigger className="text-left text-sm font-semibold hover:text-teal hover:no-underline py-3">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs leading-relaxed text-muted-foreground pb-4">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Why Prevention Matters */}
      <section className="border-t border-border bg-surface-muted/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20"
            >
              Public Health Evidence
            </Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Why Chronic Disease Prevention Matters
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Metabolic and cardiovascular conditions develop gradually. Public health evidence
              shows that identifying risk factors early enables lifestyle modifications that
              significantly reduce disease onset.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 mb-16">
            {/* Stat Card 1: Cardiovascular Disease */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">80%</div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    Preventable Heart Conditions
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The World Health Organization (WHO) estimates that up to 80% of premature heart
                    attacks and strokes are preventable through risk identification, dietary
                    adjustments, and regular exercise.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 2: Hypertension */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">46%</div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    Undiagnosed Hypertension
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    According to WHO reports, approximately 46% of adults with hypertension are
                    unaware they have high blood pressure. Early detection and habit tracking are
                    essential first steps for cardiovascular care.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 3: Type 2 Diabetes */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">58%</div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    Reduced Diabetes Risk
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Clinical research from the landmark Diabetes Prevention Program (DPP)
                    demonstrates that structured lifestyle changes in diet and physical activity can
                    reduce the risk of progressing to type 2 diabetes by 58%.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Natural transition to assessment */}
          <div className="border border-border bg-surface rounded-2xl p-8 max-w-4xl mx-auto text-center space-y-6 shadow-sm">
            <div className="space-y-2 max-w-2xl mx-auto">
              <h3 className="font-display text-xl font-bold text-foreground">
                Assess Your Risk Markers
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                HealthGuard offers an educational, on-device questionnaire designed to evaluate your
                risk factors for these conditions and generate personalized guidelines. The
                assessment is private, free, and takes under 10 minutes.
              </p>
            </div>
            <div className="flex justify-center flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/95 px-6 font-semibold"
              >
                <Link to="/assessment">
                  Start Health Assessment <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-6 text-sm font-semibold hover:bg-accent/40"
              >
                <Link to="/about">Read Methodology</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
