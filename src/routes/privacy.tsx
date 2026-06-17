import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, EyeOff, Lock, Database, Trash2, Key } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy — HealthGuard";
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
              Data Privacy & Security
            </Badge>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground">
              Your Health Data belongs to You
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              At HealthGuard, privacy isn't a setting—it's a core design principle. We believe that
              personal medical intelligence should be strictly private and fully under your control.
            </p>
          </div>
        </section>

        {/* Core Principles */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "On-Device Processing First",
                desc: "By default, your health parameters (BMI, smoking status, family history) are processed locally in your browser session. No medical details are sent to a remote server without your consent.",
              },
              {
                icon: EyeOff,
                title: "No Data Brokerage",
                desc: "We do not sell, share, rent, or monetize your health information, inputs, or generated risk profiles. Your data remains strictly confidential and closed to third-party trackers.",
              },
              {
                icon: Lock,
                title: "Optional Private Sync",
                desc: "If you choose to register an account, your data is securely synced with a private, authenticated Firebase Firestore database. This data is protected by industry-standard row-level security policies.",
              },
              {
                icon: Database,
                title: "Transparent Storage",
                desc: "All session metrics, completed questionnaires, and calculated scores are stored in your browser's local storage. You can inspect or clear this data instantly at any time.",
              },
              {
                icon: Trash2,
                title: "Right to Erasure",
                desc: "Deleting your account or logging out clears all personalized session data. We provide simple, one-click options to wipe your record from the database completely.",
              },
              {
                icon: Key,
                title: "Secure Authentication",
                desc: "We utilize Firebase Authentication for secure email and OAuth flows, ensuring that only you have the keys to view your medical risk summaries and dietitian schedules.",
              },
            ].map((p, idx) => (
              <Card
                key={idx}
                className="border-border bg-surface shadow-card-soft hover:shadow-md hover:border-teal/30 hover:-translate-y-0.5 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Transparency Banner */}
        <section className="border-t border-border bg-surface-muted/20 py-16">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Educational Project Transparency
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              HealthGuard is developed strictly as an educational and demonstration project. Unlike
              commercial platforms, we do not deploy analytics trackers (such as Google Analytics or
              Meta Pixel), ad networks, or marketing cookies. Your browsing behavior and assessment
              logs are purely yours.
            </p>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
