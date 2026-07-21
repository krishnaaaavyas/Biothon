import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  Droplet,
  Gauge,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage, tr } from "@/lib/i18n";
import { Threads } from "@/components/ui/threads";
import SplitText from "@/components/ui/split-text";
import { LogoLoop } from "@/components/ui/logo-loop";
import CountUp from "@/components/ui/count-up";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading, hasCompletedAssessment } = useAuth();
  const navigate = useNavigate();
  const currentLang = useLanguage();

  useEffect(() => {
    document.title = "HealthGuard — Evidence-Aware Preventive Health Intelligence";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading HealthGuard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-background py-10 lg:py-14">
        {/* Threads Background */}
        <div className="absolute inset-0 z-0 opacity-35 pointer-events-none">
          <Threads
            color={[0.2392, 0.6980, 0.6980]}
            amplitude={1.4}
            distance={0.3}
            enableMouseInteraction={true}
          />
        </div>
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none z-0" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal/40 to-transparent z-0" />
        <div className="relative z-10 mx-auto max-w-[1440px] px-4 items-center">
          <div className="max-w-3xl flex flex-col justify-center">
            <SplitText
              text={tr("homeTitle", currentLang)}
              className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[54px] lg:leading-[1.05]"
              delay={35}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              tag="h1"
              textAlign="left"
            />
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              {tr("homeSubtitle", currentLang)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/95 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 px-6 font-semibold"
              >
                {user ? (
                  <Link to="/assessment">
                    {tr("startAssessment", currentLang)} <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/login" search={{ redirect: "/assessment" }}>
                    {tr("startAssessment", currentLang)} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base font-semibold border-teal/20 text-teal hover:bg-teal/5 hover:border-teal/45 hover:text-teal hover:-translate-y-0.5 transition-all duration-300"
              >
                {user ? (
                  <Link to="/assessment" search={{ step: 5 }}>
                    Analyze Blood Report
                  </Link>
                ) : (
                  <Link to="/login" search={{ redirect: "/assessment?step=5" }}>
                    Analyze Blood Report
                  </Link>
                )}
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 px-6 text-base font-semibold hover:bg-accent/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                <Link to="/about">{tr("learnMore", currentLang)}</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground border-t border-border/60 pt-6">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {tr("noMedicalRecords", currentLang)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> {tr("privateProcessing", currentLang)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Why HealthGuard? */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1440px] px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xs shrink-0">
              <Badge
                variant="secondary"
                className="rounded-full bg-teal/10 text-teal border border-teal/20"
              >
                {tr("whyHealthGuard", currentLang)}
              </Badge>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">
                {tr("healthAssistant", currentLang)}
              </h2>
            </div>
            <div className="text-sm leading-relaxed text-muted-foreground max-w-3xl">
              {tr("healthAssistantDesc", currentLang)}
            </div>
          </div>
        </div>
      </section>

      {/* Evidence-Aware Screening Framework Section */}
      <section className="border-b border-border bg-surface-muted/30">
        <div className="mx-auto max-w-[1440px] px-4 py-10">
          <div className="max-w-3xl mb-12">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20"
            >
              {tr("howItHelps", currentLang)}
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {tr("featureSectionTitle", currentLang)}
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
              {tr("featureSectionDesc", currentLang)}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ClipboardList,
                title: tr("featEvidenceTitle", currentLang),
                desc: tr("featEvidenceDesc", currentLang),
                color: "teal",
              },
              {
                icon: Stethoscope,
                title: tr("featLabTitle", currentLang),
                desc: tr("featLabDesc", currentLang),
                color: "purple",
              },
              {
                icon: BookOpen,
                title: tr("featResearchTitle", currentLang),
                desc: tr("featResearchDesc", currentLang),
                color: "indigo",
              },
              {
                icon: Activity,
                title: tr("featRuleEngineTitle", currentLang),
                desc: tr("featRuleEngineDesc", currentLang),
                color: "orange",
              },
              {
                icon: Users,
                title: tr("featIndiaContextTitle", currentLang),
                desc: tr("featIndiaContextDesc", currentLang),
                color: "blue",
              },
              {
                icon: Brain,
                title: tr("featAIExplanationTitle", currentLang),
                desc: tr("featAIExplanationDesc", currentLang),
                color: "green",
              },
            ].map((f, i) => {
              const gradients: Record<string, string> = {
                teal: "linear-gradient(135deg, hsl(174, 75%, 45%), hsl(174, 75%, 35%))",
                slate: "linear-gradient(135deg, hsl(215, 20%, 50%), hsl(215, 20%, 40%))",
                petrol: "linear-gradient(135deg, hsl(195, 50%, 48%), hsl(195, 50%, 38%))",
                emerald: "linear-gradient(135deg, hsl(150, 45%, 45%), hsl(150, 45%, 35%))",
                indigo: "linear-gradient(135deg, hsl(225, 40%, 52%), hsl(225, 40%, 42%))",
                darkSlate: "linear-gradient(135deg, hsl(220, 15%, 40%), hsl(220, 15%, 30%))",
              };

              // Map original generic names to refined matching themes
              const colorMap: Record<string, string> = {
                teal: "teal",
                purple: "slate",
                indigo: "indigo",
                orange: "darkSlate",
                blue: "petrol",
                green: "emerald",
              };
              const themeColor = colorMap[f.color] || "teal";

              return (
                <Card
                  key={i}
                  className="group/card border-border/80 bg-surface shadow-card-soft hover:shadow-elevated hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <CardContent className="p-6 space-y-4">
                    <div
                      className="relative w-14 h-14 select-none"
                      style={{ perspective: "20rem", transformStyle: "preserve-3d" }}
                    >
                      <span
                        className="absolute inset-0 rounded-2xl shadow-sm transition-all duration-300 group-hover/card:translate-x-[4px] group-hover/card:translate-y-[4px] group-hover/card:scale-[0.95]"
                        style={{
                          background: gradients[themeColor],
                        }}
                      />
                      <span
                        className="absolute inset-0 rounded-2xl bg-surface/50 border border-border/80 backdrop-blur-md flex items-center justify-center transition-all duration-300 group-hover/card:translate-x-[-3px] group-hover/card:translate-y-[-3px] group-hover/card:scale-[1.02] shadow-sm dark:bg-card/50"
                        style={{
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                        }}
                      >
                        <f.icon className="h-6 w-6 text-foreground" />
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-display text-base font-bold text-foreground leading-snug">
                        {f.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-10 lg:grid-cols-12">
          <div className="lg:col-span-4 flex flex-col justify-center items-center text-center lg:items-start lg:text-left">
            <Badge variant="secondary" className="rounded-full w-fit">
              FAQ
            </Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
              {tr("faqTitle", currentLang)}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {tr("faqSupportText1", currentLang)}
              <Link
                to="/contact"
                className="text-teal underline underline-offset-4 hover:text-teal/80"
              >
                {tr("support", currentLang)}
              </Link>
              {tr("faqSupportText2", currentLang)}
            </p>
          </div>
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: tr("faq1Q", currentLang),
                  a: tr("faq1A", currentLang),
                },
                {
                  q: tr("faq2Q", currentLang),
                  a: tr("faq2A", currentLang),
                },
                {
                  q: tr("faq3Q", currentLang),
                  a: tr("faq3A", currentLang),
                },
                {
                  q: tr("faq4Q", currentLang),
                  a: tr("faq4A", currentLang),
                },
                {
                  q: tr("faq5Q", currentLang),
                  a: tr("faq5A", currentLang),
                },
                {
                  q: tr("faq6Q", currentLang),
                  a: tr("faq6A", currentLang),
                },
              ].map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/80 last:border-b-0">
                  <AccordionTrigger className="text-left text-base sm:text-lg font-bold hover:text-teal hover:no-underline py-4">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm sm:text-base leading-7 text-muted-foreground pb-4">
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
        <div className="mx-auto max-w-[1440px] px-4 pt-10 pb-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20"
            >
              {tr("publicHealthEvidence", currentLang)}
            </Badge>
            <SplitText
              text={tr("whyPreventionMatters", currentLang)}
              className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              delay={35}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              tag="h2"
              textAlign="center"
            />
            <p className="text-muted-foreground text-sm leading-relaxed">
              {tr("whyPreventionMattersDesc", currentLang)}
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {/* Stat Card 1: Cardiovascular Disease */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">
                  <CountUp to={80} duration={1.5} />%
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    {tr("preventableHeartConditions", currentLang)}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tr("preventableHeartConditionsDesc", currentLang)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 2: Hypertension */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">
                  <CountUp to={46} duration={1.5} />%
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    {tr("undiagnosedHypertension", currentLang)}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tr("undiagnosedHypertensionDesc", currentLang)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Stat Card 3: Type 2 Diabetes */}
            <Card className="border border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-teal/30 transition-all duration-300">
              <CardContent className="p-6 space-y-4">
                <div className="font-display text-4xl font-extrabold text-teal">
                  <CountUp to={58} duration={1.5} />%
                </div>
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-foreground">
                    {tr("reducedDiabetesRisk", currentLang)}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tr("reducedDiabetesRiskDesc", currentLang)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Scroll Velocity Marquee - Full Screen Edge-to-Edge */}
      <div className="py-6 w-full overflow-hidden select-none bg-surface-muted/10 border-y border-border/10">
        <LogoLoop
          logos={[
            "Lifestyle Assessment",
            "Symptoms",
            "Blood Pressure",
            "Blood Reports",
            "Diabetes Screening",
            "Hypertension Screening",
            "Anaemia Screening",
            "Evidence-Based Analysis",
            "Personalized Health Insights",
            "AI Explanation",
            "Preventive Healthcare",
          ].flatMap((text) => [
            {
              node: (
                <span className="text-lg md:text-xl font-bold uppercase tracking-wider text-teal/40 font-display whitespace-nowrap transition-colors duration-300 hover:text-teal cursor-default">
                  {text}
                </span>
              ),
              title: text,
            },
            {
              node: (
                <span className="text-lg md:text-xl font-bold uppercase tracking-wider text-teal/40 font-display select-none cursor-default">
                  •
                </span>
              ),
              title: "separator",
            },
          ])}
          speed={60}
          direction="left"
          logoHeight={28}
          gap={36}
          pauseOnHover={false}
          scaleOnHover
          fadeOut
          fadeOutColor="var(--color-background)"
        />
      </div>

      <section className="bg-surface-muted/10 pt-8 pb-10">
        <div className="mx-auto max-w-[1440px] px-4">
          <div className="border border-border bg-surface rounded-2xl p-8 max-w-4xl mx-auto text-center space-y-6 shadow-sm">
            <div className="space-y-2 max-w-2xl mx-auto">
              <h3 className="font-display text-xl font-bold text-foreground">
                {tr("assessYourRiskMarkers", currentLang)}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tr("assessYourRiskMarkersDesc", currentLang)}
              </p>
            </div>
            <div className="flex justify-center flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/95 px-6 font-semibold"
              >
                {user ? (
                  <Link to="/assessment">
                    {tr("startHealthAssessment", currentLang)} <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/login" search={{ redirect: "/assessment" }}>
                    {tr("startHealthAssessment", currentLang)} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-6 text-sm font-semibold border-teal/20 text-teal hover:bg-teal/5 hover:border-teal/45 hover:text-teal"
              >
                {user ? (
                  <Link to="/assessment" search={{ step: 5 }}>
                    Analyze Blood Report
                  </Link>
                ) : (
                  <Link to="/login" search={{ redirect: "/assessment?step=5" }}>
                    Analyze Blood Report
                  </Link>
                )}
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-11 px-6 text-sm font-semibold hover:bg-accent/40"
              >
                <Link to="/about">{tr("readMethodology", currentLang)}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
