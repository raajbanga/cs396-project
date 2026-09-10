import * as React from "react";
import { Atom, Droplets, Factory, Flame, Sun, Wind, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { getFuelIcon, getFuelTheme, type FuelIconKind } from "~/lib/map-utils";
import { cn } from "~/lib/utils";

const FUEL_ICONS: Record<FuelIconKind, React.ReactNode> = {
  gas: <Flame className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />,
  nuclear: <Atom className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />,
  solar: <Sun className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />,
  wind: <Wind className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />,
  hydro: <Droplets className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />,
  fossil: <Factory className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-500" />,
  other: <Zap className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />,
};

export interface FuelBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  fuel: string;
}

export function FuelBadge({ fuel, className, ...props }: FuelBadgeProps) {
  const theme = getFuelTheme(fuel);

  return (
    <Badge
      variant={theme.variant}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium select-none px-2 py-0.5",
        className,
      )}
      {...props}
    >
      {FUEL_ICONS[getFuelIcon(fuel)]}
      <span>{fuel}</span>
    </Badge>
  );
}
