import { Globe, Check, ChevronDown } from "lucide-react";
import { useLangPref } from "@/lib/health-store";
import { languages, type Lang } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const shortLabel: Record<Lang, string> = { en: "EN", hi: "हि", gu: "ગુ" };
const fullLabel: Record<Lang, string> = { en: "English", hi: "Hindi", gu: "Gujarati" };

export function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "compact" }) {
  const [lang, setLang] = useLangPref();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          variant === "compact"
            ? "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            : "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        }
        aria-label="Change language"
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{fullLabel[lang]}</span>
        <span className="sm:hidden">{shortLabel[lang]}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((l) => {
          const active = l.code === lang;
          return (
            <DropdownMenuItem
              key={l.code}
              onSelect={() => setLang(l.code as Lang)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{fullLabel[l.code]}</span>
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
              {active && <Check className="h-4 w-4 text-teal" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
