import { HeartPulse } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/30">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Project Overview */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal">
                <HeartPulse className="h-4 w-4" strokeWidth={2.4} />
              </div>
              <div className="font-display text-base font-bold tracking-tight text-foreground">
                HealthGuard
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              An AI-powered preventive health intelligence portal built to evaluate metabolic and
              cardiovascular risk factors. It maps basic lifestyle indicators against evidence-based
              reference guidelines to generate personalized wellness recommendations.
            </p>
          </div>

          {/* Focus Areas */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Focus Areas
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Type 2 Diabetes</li>
              <li>Hypertension</li>
              <li>Heart Disease</li>
            </ul>
          </div>

          {/* Developers */}
          <div className="md:col-span-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Developers
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Krish Savaliya</li>
              <li>Krishna Vyas</li>
            </ul>
          </div>
        </div>

        {/* Separator & Disclaimer */}
        <div className="mt-12 border-t border-border pt-8 flex flex-col gap-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground font-semibold">Disclaimer:</strong> This project
            provides health risk awareness and preventive guidance. It is not a medical diagnosis
            tool.
          </p>
          <div className="text-xs text-muted-foreground/80">
            © {new Date().getFullYear()} HealthGuard. Developed strictly for educational and
            demonstration purposes.
          </div>
        </div>
      </div>
    </footer>
  );
}
