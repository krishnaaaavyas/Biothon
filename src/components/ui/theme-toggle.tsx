import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-lg border border-border bg-surface hover:bg-muted/80 flex items-center justify-center cursor-pointer group focus-visible:ring-1 focus-visible:ring-ring shrink-0"
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0 text-foreground group-hover:text-teal" />
      <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100 text-foreground group-hover:text-teal" />
    </Button>
  );
}
