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
  HeartPulse,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  useEffect(() => {
    document.title = "Contact & Portfolio — HealthGuard";
  }, []);
  const [sending, setSending] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      (e.target as HTMLFormElement).reset();
      toast.success("Feedback submitted successfully! Thank you.");
    }, 800);
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <SiteHeader />

      {/* Header section with reduced height */}
      <section className="border-b border-border bg-surface-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Badge
            variant="secondary"
            className="rounded-full bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20"
          >
            Project Portfolio & Support
          </Badge>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
            About HealthGuard AI
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Learn more about the project mission, developers, frequently asked questions, and submit
            your feedback.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Top Full-Width Section: About & Developers */}
        <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
                <HeartPulse className="h-6 w-6 text-teal" /> About HealthGuard
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                HealthGuard is a personal project built to help people learn about and prevent major
                chronic illnesses—specifically Type 2 Diabetes, Hypertension (high blood pressure),
                and Heart Disease. By answering a few everyday questions about your habits, family
                history, and symptoms, you get an instant understanding of your potential risks
                along with simple, actionable diet and exercise guides to help you live a healthier,
                preventive lifestyle.
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Developer Information
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                {/* Krish Savaliya Card */}
                <Card className="border-border/60 bg-surface shadow-sm hover:border-teal/40 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-foreground">Krish Savaliya</div>
                      <div className="text-xs text-teal font-medium">Software Developer</div>
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        Focused on building clean, intuitive frontend interfaces and responsive data
                        flows.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2.5 border-t border-border/40">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[10px] border-border hover:bg-accent/40 hover:border-teal/50 hover:-translate-y-0.5 gap-1.5 transition-all duration-200 group cursor-pointer"
                      >
                        <a
                          href="https://github.com/Krish130910"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <Github className="h-3 w-3 text-teal/70 group-hover:text-teal transition-colors duration-200" />
                          <span>GitHub</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[10px] border-border hover:bg-accent/40 hover:border-teal/50 hover:-translate-y-0.5 gap-1.5 transition-all duration-200 group cursor-pointer"
                      >
                        <a
                          href="https://www.linkedin.com/in/krish-savaliya-5a139a31a/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <Linkedin className="h-3 w-3 text-teal/70 group-hover:text-teal transition-colors duration-200" />
                          <span>LinkedIn</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Krishna Vyas Card */}
                <Card className="border-border/60 bg-surface shadow-sm hover:border-teal/40 hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                  <CardContent className="p-5 flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-foreground">Krishna Vyas</div>
                      <div className="text-xs text-teal font-medium">Software Developer</div>
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        Specialized in clinical logic integration, AI modeling, and backend database
                        systems.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2.5 border-t border-border/40">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[10px] border-border hover:bg-accent/40 hover:border-teal/50 hover:-translate-y-0.5 gap-1.5 transition-all duration-200 group cursor-pointer"
                      >
                        <a
                          href="https://github.com/krishnaaaavyas"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <Github className="h-3 w-3 text-teal/70 group-hover:text-teal transition-colors duration-200" />
                          <span>GitHub</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[10px] border-border hover:bg-accent/40 hover:border-teal/50 hover:-translate-y-0.5 gap-1.5 transition-all duration-200 group cursor-pointer"
                      >
                        <a
                          href="https://www.linkedin.com/in/krishna-vyas-7bba15319/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <Linkedin className="h-3 w-3 text-teal/70 group-hover:text-teal transition-colors duration-200" />
                          <span>LinkedIn</span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Grid for Q&A, Disclaimer, and Feedback */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left Column - FAQ and Disclaimer */}
          <div className="lg:col-span-3 space-y-6">
            {/* FAQ Section */}
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessagesSquare className="h-5 w-5 text-teal" />
                  <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                    Frequently Asked Questions
                  </h2>
                </div>

                <Accordion type="single" collapsible className="w-full space-y-1">
                  {[
                    {
                      q: "How are the risk scores calculated?",
                      a: "HealthGuard runs a multi-factorial deterministic calculation based on guidelines like ADA (American Diabetes Association) and AHA (American Heart Association). It evaluates age, body dimensions, physical exercise, tobacco habits, symptoms, and family records.",
                    },
                    {
                      q: "Is my personal data secure?",
                      a: "Yes, all assessment data is stored locally in your browser storage. If you sign in, it is synchronized using a secure, private Firestore instance. Your credentials and medical profiles are never shared.",
                    },
                    {
                      q: "Can I export my prevention plans?",
                      a: "Absolutely. Once the assessment is finished, navigate to the Reports tab or the dashboard top panel and click 'Download PDF' to save a printer-ready copy of your parameters and plans.",
                    },
                    {
                      q: "How does the AI create diet & exercise plans?",
                      a: "The clinical AI engine takes your calculated BMI, dietary habits, and physical activity level, then structures tailored guidelines. The diet schedule uses kitchen-familiar Indian vegetarian and non-vegetarian menus.",
                    },
                    {
                      q: "Does this replace a clinical diagnosis?",
                      a: "No. HealthGuard is strictly an educational tool to raise preventive healthcare awareness. It is not an FDA-approved diagnostic service. Please consult a primary physician for clinical examinations.",
                    },
                  ].map((faq, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`faq-${idx}`}
                      className="border-b border-border/80 last:border-0 py-1"
                    >
                      <AccordionTrigger className="text-left text-sm font-semibold hover:text-teal hover:no-underline py-2 transition-colors">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-muted-foreground leading-relaxed pt-1 pb-2">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Educational Disclaimer Card - Placed below FAQ */}
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              <CardContent className="p-6 space-y-3">
                <h2 className="font-display text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
                  <BookOpen className="h-5 w-5 text-teal" /> Educational Disclaimer
                </h2>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground">
                  ⚠️ <strong className="text-foreground">Informational Only:</strong> This platform
                  is developed strictly for educational and portfolio demonstration purposes. All
                  calculated risk ratings, rationales, diet suggestions, and exercise schedules are
                  generated by AI models for guidance and should not be used as clinical diagnostic
                  advice or as a replacement for qualified medical consultations.
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Project Feedback */}
          <div className="lg:col-span-2">
            <Card className="border-border/80 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full">
              <CardContent className="p-6 flex flex-col justify-between h-full">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight">
                    Project Feedback
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Have comments or questions? Drop a message below to let us know.
                  </p>

                  <form onSubmit={submit} className="mt-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs">
                        Full name
                      </Label>
                      <Input
                        id="name"
                        required
                        placeholder="Priya Sharma"
                        className="border-border/80 bg-surface/50 h-10 text-xs transition-all duration-200 focus:border-teal focus:ring-teal focus-visible:ring-teal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs">
                        Email
                      </Label>
                      <Input
                        id="email"
                        required
                        type="email"
                        placeholder="you@email.com"
                        className="border-border/80 bg-surface/50 h-10 text-xs transition-all duration-200 focus:border-teal focus:ring-teal focus-visible:ring-teal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-xs">
                        Message
                      </Label>
                      <Textarea
                        id="message"
                        required
                        rows={4}
                        placeholder="Your thoughts on the project..."
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
                        {sending ? "Sending…" : "Submit Feedback"}
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
