import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage, tr } from "@/lib/i18n";

export const Route = createFileRoute("/_app/dashboard")({});

export function EmptyState() {
  return null;
}

export function LedgerTable({
  items,
}: {
  items: Array<{
    parameter: string;
    value: string;
    reference: string;
    status?: string;
    statusColor?: string;
  }>;
}) {
  const currentLang = useLanguage();
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-semibold">{tr("parameterDesc", currentLang)}</th>
            <th className="px-4 py-3 text-right font-semibold">{tr("resultValue", currentLang)}</th>
            <th className="px-4 py-3 font-semibold">{tr("referenceInterval", currentLang)}</th>
            <th className="px-4 py-3 text-right font-semibold">{tr("status", currentLang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 bg-surface">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-accent/5 transition-colors">
              <td className="px-4 py-3 font-semibold text-foreground">{item.parameter}</td>
              <td className="px-4 py-3 text-right font-bold text-teal font-mono">{item.value}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.reference}</td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    item.statusColor || "bg-accent text-accent-foreground border border-border/50"
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {item.status || tr("recordedStatus", currentLang)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RiskLedgerTable({
  items,
}: {
  items: Array<{
    condition: string;
    score: number;
    classification: string;
    color: string;
    rationale: string;
  }>;
}) {
  const currentLang = useLanguage();
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3 font-semibold">{tr("analyzedCondition", currentLang)}</th>
            <th className="px-4 py-3 text-right font-semibold">{tr("riskIndex", currentLang)}</th>
            <th className="px-4 py-3 font-semibold">{tr("riskLevel", currentLang)}</th>
            <th className="px-4 py-3 font-semibold">{tr("statisticalRationale", currentLang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40 bg-surface">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-accent/5 transition-colors">
              <td className="px-4 py-3 font-semibold text-foreground">{item.condition}</td>
              <td
                className="px-4 py-3 text-right font-bold font-mono"
                style={{ color: item.color }}
              >
                {item.score}/100
              </td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    color: item.color,
                    backgroundColor: `${item.color}08`,
                    border: `1px solid ${item.color}20`,
                  }}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                  {item.classification}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">
                {item.rationale}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
