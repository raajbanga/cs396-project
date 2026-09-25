"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "~/components/ui/button";

/** Icons swap via the `dark:` variant, so no mount guard is needed to avoid hydration mismatches. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title="Toggle light/dark mode"
    >
      <Sun className="hidden h-3.5 w-3.5 text-amber-400 dark:block" />
      <Moon className="text-fg-muted h-3.5 w-3.5 dark:hidden" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
