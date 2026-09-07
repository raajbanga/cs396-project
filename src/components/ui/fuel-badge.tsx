import * as React from "react";
import { Atom, Droplets, Factory, Flame, Sun, Wind, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { getFuelTheme } from "~/lib/map-utils";
import { cn } from "~/lib/utils";

export interface FuelBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  fuel: string;
}

export function FuelBadge({
  fuel,
  className,
  ...props
}: FuelBadgeProps) {
  const theme = getFuelTheme(fuel);
  const f = fuel.toLowerCase();

  const renderIcon = () => {
    if (f.includes("gas") || f.includes("methane")) {
      return <Flame className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />;
    }
    if (f.includes("nuclear")) {
      return <Atom className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />;
    }
    if (f.includes("solar")) {
      return <Sun className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />;
    }
    if (f.includes("wind")) {
      return <Wind className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />;
    }
    if (f.includes("hydro") || f.includes("water")) {
      return <Droplets className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />;
    }
    if (f.includes("coal") || f.includes("oil") || f.includes("petroleum")) {
      return <Factory className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-500" />;
    }
    return <Zap className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />;
  };

  return (
    <Badge
      variant={theme.variant}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium select-none px-2 py-0.5",
        className,
      )}
      {...props}
    >
      {renderIcon()}
      <span>{fuel}</span>
    </Badge>
  );
}
