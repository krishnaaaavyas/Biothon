import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Github,
  Linkedin,
  Sparkles,
  FileText,
  Heart,
  Lock,
  LineChart,
} from "lucide-react";
import { useLanguage, tr } from "@/lib/i18n";
import SplitText from "@/components/ui/split-text";
import { GlassIconBox } from "@/components/ui/glass-icons";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const currentLang = useLanguage();

  useEffect(() => {
    document.title = `${tr("about", currentLang)} HealthGuard — Educational Assessment Portal`;
  }, [currentLang]);

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <SiteHeader />

      <div className="pb-10">
        {/* 1. What is HealthGuard (At the Top, Centered) */}
        <section className="border-b border-border bg-gradient-to-b from-background to-surface-muted/5 pt-10 pb-12 text-center">
          <div className="mx-auto max-w-[1440px] px-4">
            <div className="max-w-3xl mx-auto space-y-6 flex flex-col items-center">
              <SplitText
                text={tr("whatIsHealthGuard", currentLang)}
                className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground"
                delay={35}
                duration={0.6}
                ease="power3.out"
                splitType="chars"
                tag="h1"
                textAlign="center"
                threshold={0}
                rootMargin="0px"
              />
              <p className="text-base sm:text-lg leading-relaxed text-muted-foreground/90 max-w-2xl mx-auto">
                {tr("whatIsHealthGuardDesc", currentLang)}
              </p>
            </div>
          </div>
        </section>

        {/* 2. How to Use Section (Centered Steps) */}
        <section className="border-b border-border bg-surface-muted/10 py-12">
          <div className="mx-auto max-w-[1440px] px-4">
            <div className="text-center max-w-xl mx-auto mb-8">
              <SplitText
                text={tr("howToUse", currentLang) + "?"}
                className="font-display text-3xl font-bold tracking-tight text-foreground"
                delay={35}
                duration={0.6}
                ease="power3.out"
                splitType="chars"
                tag="h2"
                textAlign="center"
                threshold={0}
                rootMargin="0px"
              />
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              {[
                {
                  title: tr("step1Title", currentLang),
                  desc: tr("step1Desc", currentLang),
                },
                {
                  title: tr("step2Title", currentLang),
                  desc: tr("step2Desc", currentLang),
                },
                {
                  title: tr("step3Title", currentLang),
                  desc: tr("step3Desc", currentLang),
                },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start p-5 rounded-2xl border border-border/80 bg-surface shadow-card-soft transition-all duration-300 hover:border-teal/30">
                  <GlassIconBox color="teal" size="sm" className="text-foreground font-bold text-sm">
                    {idx + 1}
                  </GlassIconBox>
                  <div className="space-y-1 text-left">
                    <h3 className="font-display font-bold text-base text-foreground leading-snug">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Why Choose HealthGuard Section */}
        <section className="border-b border-border bg-background py-16">
          <div className="mx-auto max-w-[1440px] px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <SplitText
                text={tr("whyChooseHealthGuard", currentLang)}
                className="font-display text-3xl font-bold tracking-tight text-foreground"
                delay={35}
                duration={0.6}
                ease="power3.out"
                splitType="chars"
                tag="h2"
                textAlign="center"
                threshold={0}
                rootMargin="0px"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {tr("whyChooseHealthGuardSub", currentLang)}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: tr("wcEvidenceTitle", currentLang),
                  desc: tr("wcEvidenceDesc", currentLang),
                  color: "teal",
                },
                {
                  icon: Sparkles,
                  title: tr("wcAiTitle", currentLang),
                  desc: tr("wcAiDesc", currentLang),
                  color: "purple",
                },
                {
                  icon: FileText,
                  title: tr("wcBloodTitle", currentLang),
                  desc: tr("wcBloodDesc", currentLang),
                  color: "blue",
                },
                {
                  icon: Heart,
                  title: tr("wcPreventiveTitle", currentLang),
                  desc: tr("wcPreventiveDesc", currentLang),
                  color: "green",
                },
                {
                  icon: Lock,
                  title: tr("wcPrivacyTitle", currentLang),
                  desc: tr("wcPrivacyDesc", currentLang),
                  color: "indigo",
                },
                {
                  icon: LineChart,
                  title: tr("wcInsightsTitle", currentLang),
                  desc: tr("wcInsightsDesc", currentLang),
                  color: "orange",
                },
              ].map((item, idx) => {
                const gradients: Record<string, string> = {
                  teal: "linear-gradient(135deg, hsl(174, 75%, 45%), hsl(174, 75%, 35%))",
                  slate: "linear-gradient(135deg, hsl(215, 20%, 50%), hsl(215, 20%, 40%))",
                  petrol: "linear-gradient(135deg, hsl(195, 50%, 48%), hsl(195, 50%, 38%))",
                  emerald: "linear-gradient(135deg, hsl(150, 45%, 45%), hsl(150, 45%, 35%))",
                  indigo: "linear-gradient(135deg, hsl(225, 40%, 52%), hsl(225, 40%, 42%))",
                  darkSlate: "linear-gradient(135deg, hsl(220, 15%, 40%), hsl(220, 15%, 30%))",
                };

                const colorMap: Record<string, string> = {
                  teal: "teal",
                  purple: "slate",
                  indigo: "indigo",
                  orange: "darkSlate",
                  blue: "petrol",
                  green: "emerald",
                };
                const themeColor = colorMap[item.color] || "teal";

                return (
                  <Card
                    key={idx}
                    className="group/card border-border/80 bg-surface shadow-card-soft hover:shadow-elevated hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <CardContent className="p-8 space-y-5">
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
                          <item.icon className="h-6 w-6 text-foreground" />
                        </span>
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Framework & Ethics (Educational Project Information) */}
        <section className="border-b border-border bg-surface-muted/10 py-12">
          <div className="mx-auto max-w-[1440px] px-4">
            <div className="text-center max-w-3xl mx-auto mb-10">
            <SplitText
              text={tr("eduProjectLinks", currentLang)}
              className="font-display text-3xl font-bold tracking-tight text-foreground"
              delay={35}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              tag="h2"
              textAlign="center"
              threshold={0}
              rootMargin="0px"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {tr("frameworkEthicsSub", currentLang)}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Privacy Card */}
            <Link to="/privacy" className="group block">
              <Card className="border-border bg-surface shadow-card-soft group-hover:border-teal/50 group-hover:shadow-md transition-all duration-300 h-full">
                <CardContent className="p-8 flex items-start gap-4">
                  <GlassIconBox color="teal" size="md">
                    <ShieldCheck className="h-5 w-5 text-foreground" />
                  </GlassIconBox>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-teal transition-colors flex items-center gap-1.5">
                      {tr("privacyPolicy", currentLang)}{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {tr("privacyPolicyDesc", currentLang)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Clinical Sources Card */}
            <Link to="/clinical-sources" className="group block">
              <Card className="border-border bg-surface shadow-card-soft group-hover:border-teal/50 group-hover:shadow-md transition-all duration-300 h-full">
                <CardContent className="p-8 flex items-start gap-4">
                  <GlassIconBox color="blue" size="md">
                    <BookOpen className="h-5 w-5 text-foreground" />
                  </GlassIconBox>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-teal transition-colors flex items-center gap-1.5">
                      {tr("clinicalSources", currentLang)}{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {tr("clinicalSourcesDesc", currentLang)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
          </div>
        </section>

        {/* 5. Strict Medical Disclaimer */}
        <section className="border-b border-border bg-background py-10">
          <div className="mx-auto max-w-[1100px] px-4">
            <Card className="border-red-500/20 bg-red-500/5 dark:bg-red-500/10">
            <CardContent className="p-6 sm:p-8 flex gap-4">
              <ShieldAlert className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-red-600 dark:text-red-400 text-[15px] tracking-wide">
                  {tr("medicalDisclaimer", currentLang)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {tr("medicalDisclaimerDesc", currentLang)}
                </p>
              </div>
            </CardContent>
            </Card>
          </div>
        </section>

        {/* 6. About the Developers */}
        <section className="bg-surface-muted/10 py-16">
          <div className="mx-auto max-w-[1440px] px-4">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <Badge
                variant="secondary"
                className="rounded-full bg-teal/10 text-teal border border-teal/20 text-xs sm:text-sm px-3.5 py-1 font-semibold hover:bg-teal/15 transition-colors duration-200"
              >
                {tr("devInfoTitle", currentLang) || "Meet the Developers"}
              </Badge>
              <SplitText
                text="Meet the Developers"
                className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground"
                delay={35}
                duration={0.6}
                ease="power3.out"
                splitType="chars"
                tag="h2"
                textAlign="center"
                threshold={0}
                rootMargin="0px"
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto py-4">
              {[
                {
                  name: "Krish Savaliya",
                  github: "https://github.com/Krish130910",
                  linkedin: "https://www.linkedin.com/in/krish-savaliya-5a139a31a/",
                },
                {
                  name: "Krishna Vyas",
                  github: "https://github.com/krishnaaaavyas",
                  linkedin: "https://www.linkedin.com/in/krishna-vyas-7bba15319/",
                },
                {
                  name: "Jiya Singh",
                  github: "https://github.com/jiya2401",
                  linkedin: "https://www.linkedin.com/in/jiya-singh24",
                },
              ].map((d, idx) => (
                <Card
                  key={idx}
                  className="group border border-border/80 bg-surface rounded-2xl p-6 flex flex-col items-center justify-between text-center shadow-card-soft hover:shadow-elevated hover:border-teal/30 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[140px]"
                >
                  {/* Subtle top decoration */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal/20 via-teal/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="my-auto">
                    <h3 className="font-display font-bold text-foreground text-base tracking-wide group-hover:text-teal transition-colors">
                      {d.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 mt-4 w-full justify-center">
                    <a
                      href={d.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/80 text-secondary-foreground hover:bg-secondary border border-border transition-all duration-200"
                    >
                      <Github className="h-3.5 w-3.5" />
                      GitHub
                    </a>
                    <a
                      href={d.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal/10 text-teal hover:bg-teal/20 border border-teal/20 transition-all duration-200"
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                      LinkedIn
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>

      <SiteFooter hideDisclaimer={true} showFeatures={true} />
    </div>
  );
}
