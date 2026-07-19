import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, EyeOff, Lock, Database, Trash2, Key } from "lucide-react";
import { useLanguage, tr } from "@/lib/i18n";
import SplitText from "@/components/ui/split-text";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const currentLang = useLanguage();

  useEffect(() => {
    document.title = `${tr("privacyTitle", currentLang)} — HealthGuard`;
  }, [currentLang]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <SiteHeader />

        {/* Hero Section */}
        <section className="border-b border-border bg-surface-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
          <div className="mx-auto max-w-[1440px] px-4 py-10 relative">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
            >
              {tr("dataPrivacySecurity", currentLang)}
            </Badge>
            <SplitText
              text={tr("yourHealthDataBelongsToYou", currentLang)}
              className="mt-4 font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground"
              delay={35}
              duration={0.6}
              ease="power3.out"
              splitType="chars"
              tag="h1"
              textAlign="left"
            />
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              {tr("privacyHeroDesc", currentLang)}
            </p>
          </div>
        </section>

        {/* Core Principles */}
        <section className="mx-auto max-w-[1440px] px-4 py-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: tr("p1Title", currentLang),
                desc: tr("p1Desc", currentLang),
                color: "teal",
              },
              {
                icon: EyeOff,
                title: tr("p2Title", currentLang),
                desc: tr("p2Desc", currentLang),
                color: "purple",
              },
              {
                icon: Lock,
                title: tr("p3Title", currentLang),
                desc: tr("p3Desc", currentLang),
                color: "blue",
              },
              {
                icon: Database,
                title: tr("p4Title", currentLang),
                desc: tr("p4Desc", currentLang),
                color: "green",
              },
              {
                icon: Trash2,
                title: tr("p5Title", currentLang),
                desc: tr("p5Desc", currentLang),
                color: "orange",
              },
              {
                icon: Key,
                title: tr("p6Title", currentLang),
                desc: tr("p6Desc", currentLang),
                color: "indigo",
              },
            ].map((p, idx) => {
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
              const themeColor = colorMap[p.color] || "teal";

              return (
                <Card
                  key={idx}
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
                        <p.icon className="h-6 w-6 text-foreground" />
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-display text-base font-bold text-foreground leading-snug">
                        {p.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Transparency Banner */}
        <section className="border-t border-border bg-surface-muted/20 py-10">
          <div className="mx-auto max-w-[1100px] px-4 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {tr("eduTransparencyTitle", currentLang)}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {tr("eduTransparencyDesc", currentLang)}
            </p>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
