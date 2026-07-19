import { ShieldCheck, AlertTriangle, Users } from "lucide-react";
import { useLanguage, tr } from "@/lib/i18n";

export function SiteFooter({
  hideDisclaimer = false,
  showFeatures = false,
}: {
  hideDisclaimer?: boolean;
  showFeatures?: boolean;
}) {
  const currentLang = useLanguage();

  return (
    <footer className="border-t border-border bg-surface-muted/30">
      <div className="mx-auto max-w-[1440px] px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-stretch">
          {/* Project Overview */}
          <div className="col-span-1 md:col-span-6 lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 h-8">
                <div className="relative h-8 w-8 shrink-0 select-none glass-logo">
                  <span className="glass-logo__back" />
                  <span className="glass-logo__front">
                    <ShieldCheck className="h-4 w-4 text-teal" strokeWidth={2.4} />
                  </span>
                </div>
                <div className="font-display text-base font-bold tracking-tight text-foreground">
                  HealthGuard
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {tr("footerDesc", currentLang)}
              </p>
            </div>
          </div>

          {/* Developers */}
          <div className={`${showFeatures ? "md:col-span-3 lg:col-span-3" : "md:col-span-6 lg:col-span-7"} col-span-1 md:border-l md:border-border/60 md:pl-8 lg:pl-12 space-y-4`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground font-mono h-8">
              <Users className="h-4 w-4 text-teal" />
              <span>{tr("developers", currentLang)}</span>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground font-medium">
              <li>Krish Savaliya</li>
              <li>Krishna Vyas</li>
              <li>Jiya Singh</li>
            </ul>
          </div>

          {/* Features */}
          {showFeatures && (
            <div className="col-span-1 md:col-span-3 lg:col-span-4 md:border-l md:border-border/60 md:pl-8 lg:pl-12 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground font-mono h-8">
                <ShieldCheck className="h-4 w-4 text-teal" />
                <span>{tr("keyFeaturesTitle", currentLang)}</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground font-medium">
                <li>{tr("pillar1Title", currentLang)}</li>
                <li>{tr("pillar2Title", currentLang)}</li>
                <li>{tr("pillar3Title", currentLang)}</li>
              </ul>
            </div>
          )}
        </div>

        {/* Separator & Disclaimer */}
        <div className="mt-12 border-t border-border pt-8 flex flex-col gap-4">
          {!hideDisclaimer && (
            <div className="flex gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-amber-800 dark:text-amber-300 dark:bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <p className="text-xs leading-relaxed">
                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400 mr-2 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Disclaimer
                </span>
                {tr("footerDisclaimer", currentLang)}
              </p>
            </div>
          )}
          <div className="text-xs text-muted-foreground/80 pl-1">
            {tr("fit_report_copyright", currentLang).replace(
              "{year}",
              new Date().getFullYear().toString(),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
