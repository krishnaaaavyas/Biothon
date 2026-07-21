import React from "react";
import { CheckCircle2, Circle, UserCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { type ProfileCompleteness } from "@/lib/evidence-summary";

interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness;
  className?: string;
}

export const ProfileCompletenessCard: React.FC<ProfileCompletenessCardProps> = ({
  completeness,
  className = "",
}) => {
  return (
    <div className={`rounded-xl border border-border/40 bg-card p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-teal" />
          <h3 className="font-display font-semibold text-lg text-foreground">Health Profile Completeness</h3>
        </div>
        <Badge variant="outline" className="rounded-full bg-teal/10 text-teal border-teal/20 px-3 py-0.5 text-xs font-bold">
          {completeness.percentage}% Complete
        </Badge>
      </div>

      <div className="space-y-1.5">
        <Progress value={completeness.percentage} className="h-2.5" />
        <p className="text-xs text-muted-foreground">
          {completeness.completedSections.length} of {completeness.categories.length} health sections completed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/10">
        {completeness.categories.map((cat) => (
          <div key={cat.key} className="flex items-center gap-2 p-2 rounded-lg bg-surface-muted/30 border border-border/10 text-xs">
            {cat.complete ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <span className={`font-medium block truncate ${cat.complete ? "text-foreground" : "text-muted-foreground"}`}>
                {cat.name}
              </span>
              {cat.detail && (
                <span className="text-[10px] text-muted-foreground/70 block truncate">{cat.detail}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
