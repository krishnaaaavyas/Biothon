import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  LifeBuoy,
  Mail,
  MessagesSquare,
  Phone,
  Send,
  ShieldCheck,
  Github,
  Linkedin,
  Terminal,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/auth-context";
import { db, isConfigured } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useLanguage, tr } from "@/lib/i18n";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const currentLang = useLanguage();

  useEffect(() => {
    document.title = `${tr("support", currentLang)} & Portfolio — HealthGuard`;
  }, [currentLang]);

  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const message = formData.get("message") as string;

    try {
      if (isConfigured) {
        await addDoc(collection(db, "feedback"), {
          userId: user?.uid ?? null,
          name: name || user?.displayName || "Anonymous",
          email: email || user?.email || null,
          message,
          type: "support",
          createdAt: serverTimestamp(),
        });
      } else {
        console.warn("Firebase is not configured. Local submission only.");
      }
      toast.success(tr("feedbackSuccess", currentLang));
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      console.error("Feedback submit failed:", err);
      toast.error(tr("feedbackError", currentLang));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <SiteHeader />

      {/* Header section with grid layout */}
      <section className="border-b border-border bg-surface-muted/30">
        <div className="mx-auto max-w-[1440px] px-4 py-10 grid gap-8 md:grid-cols-12 items-center">
          <div className="md:col-span-7 lg:col-span-8">
            <Badge
              variant="secondary"
              className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
            >
              {tr("support", currentLang)}
            </Badge>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-foreground">
              {tr("support", currentLang)}
            </h1>
            <p className="mt-2 text-base text-muted-foreground leading-relaxed max-w-2xl">
              {tr("projectFeedbackDesc", currentLang)}
            </p>
          </div>

          <div className="md:col-span-5 lg:col-span-4">
            {/* Educational Disclaimer Card */}
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <CardContent className="p-5 space-y-3">
                <h2 className="font-display text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
                  <BookOpen className="h-4.5 w-4.5 text-teal" />{" "}
                  {tr("educationalDisclaimer", currentLang)}
                </h2>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
                  ⚠️ {tr("educationalDisclaimerDesc", currentLang)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 py-10 space-y-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Column - FAQ and Disclaimer */}
          <div className="lg:col-span-3 space-y-6">
            {/* FAQ Section */}
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessagesSquare className="h-5 w-5 text-teal" />
                  <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                    {tr("faqContactTitle", currentLang)}
                  </h2>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-1">
                  {[
                    {
                      q: tr("faqContact1Q", currentLang),
                      a: tr("faqContact1A", currentLang),
                    },
                    {
                      q: tr("faqContact2Q", currentLang),
                      a: tr("faqContact2A", currentLang),
                    },
                    {
                      q: tr("faqContact3Q", currentLang),
                      a: tr("faqContact3A", currentLang),
                    },
                    {
                      q: tr("faqContact4Q", currentLang),
                      a: tr("faqContact4A", currentLang),
                    },
                    {
                      q: tr("faqContact5Q", currentLang),
                      a: tr("faqContact5A", currentLang),
                    },
                  ].map((faq, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`faq-${idx}`}
                      className="border-b border-border/80 last:border-0 py-1"
                    >
                      <AccordionTrigger className="text-left text-base sm:text-lg font-bold hover:text-teal hover:no-underline py-3.5 transition-colors">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm sm:text-base leading-7 text-muted-foreground pt-1 pb-3">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

          </div>

          {/* Right Column - Project Feedback */}
          <div className="lg:col-span-2">
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    {tr("projectFeedback", currentLang)}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr("projectFeedbackDesc", currentLang)}
                  </p>

                  <form onSubmit={submit} className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs">
                        {tr("fullName", currentLang)}
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Priya Sharma"
                        className="border-border/80 bg-surface/50 h-10 text-xs transition-all duration-200 focus:border-teal focus:ring-teal focus-visible:ring-teal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs">
                        {tr("email", currentLang)}
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        required
                        type="email"
                        placeholder="you@email.com"
                        className="border-border/80 bg-surface/50 h-10 text-xs transition-all duration-200 focus:border-teal focus:ring-teal focus-visible:ring-teal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-xs">
                        {tr("message", currentLang)}
                      </Label>
                      <Textarea
                        id="message"
                        name="message"
                        required
                        rows={4}
                        placeholder={tr("yourThoughtsPlaceholder", currentLang)}
                        className="border-border/80 bg-surface/50 text-xs transition-all duration-200 focus:border-teal focus:ring-teal focus-visible:ring-teal"
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={sending}
                        className="w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 font-semibold shadow-sm text-xs h-9"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sending ? tr("sending", currentLang) : tr("submitFeedback", currentLang)}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
