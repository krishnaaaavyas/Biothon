import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { type EvidenceSummary } from "@/lib/evidence-summary";

interface EvidenceSummaryCardProps {
  summary: EvidenceSummary;
  className?: string;
}

export const EvidenceSummaryCard: React.FC<EvidenceSummaryCardProps> = ({ summary, className = "" }) => {
  const qualityBadges = {
    high: { label: "High Quality", variant: "default" as const, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    moderate: { label: "Moderate Quality", variant: "secondary" as const, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    low: { label: "Low Quality", variant: "destructive" as const, color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  };

  const confidenceIcons = {
    high: <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />,
    moderate: <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />,
    limited: <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />,
  };

  const currentQuality = qualityBadges[summary.quality];

  return (
    <div className={`rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal" />
          <h3 className="font-display font-semibold text-lg text-foreground">Evidence Quality Summary</h3>
        </div>
        <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-xs font-semibold ${currentQuality.color}`}>
          {currentQuality.label}
        </Badge>
      </div>

      {/* Completeness Score Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Evidence Completeness</span>
          <span className="font-semibold text-foreground">{summary.score}%</span>
        </div>
        <Progress value={summary.score} className="h-2" />
        <p className="text-[11px] text-muted-foreground italic">
          Completeness score reflects input availability only. Not a medical accuracy or probability score.
        </p>
      </div>

      {/* Confidence Level in Available Evidence */}
      <div className="rounded-lg bg-surface-muted/40 p-3 border border-border/20 space-y-1">
        <div className="flex items-center gap-2">
          {confidenceIcons[summary.confidence]}
          <span className="text-sm font-semibold capitalize text-foreground">
            Confidence in available evidence: <span className="font-bold">{summary.confidence}</span>
          </span>
        </div>
        {summary.reasons.length > 0 && (
          <p className="text-xs text-muted-foreground pl-7 leading-relaxed">
            {summary.reasons[0]}
          </p>
        )}
      </div>

      {/* Missing Evidence Suggestions */}
      {summary.missingEvidence.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Missing Evidence Recommendations</span>
          </div>
          <div className="space-y-1.5">
            {summary.criticalMissingEvidence.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Required First</span>
                <ul className="space-y-1 pl-4 list-disc text-xs text-muted-foreground">
                  {summary.criticalMissingEvidence.map((item, idx) => (
                    <li key={idx} className="text-rose-600/90 font-medium">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Useful Next</span>
              <ul className="space-y-1 pl-4 list-disc text-xs text-muted-foreground">
                {summary.missingEvidence.slice(0, 4).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
