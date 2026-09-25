import type { ComponentProps } from "react";
import {
  Activity,
  Atom,
  Clock,
  Droplets,
  Factory,
  Flame,
  Power,
  Sun,
  Wind,
  Zap,
} from "lucide-react";
import { getFuelTheme, type FuelIconKind } from "~/lib/map-utils";
import {
  getCarbonIntensityTier,
  type PlantRoleInfo,
} from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";

const VARIANT_STYLES = {
  default: "bg-surface-2 text-fg border-edge",
  secondary: "bg-surface/90 text-fg-muted border-edge",
  outline: "text-fg-2 border-edge bg-transparent",
  success:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-500/20",
  warning:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300/60 dark:border-amber-500/20",
  destructive:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-500/20",
  sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-300/60 dark:border-sky-500/20",
  purple:
    "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300/60 dark:border-purple-500/20",
};

export type BadgeVariant = keyof typeof VARIANT_STYLES;

export function Badge({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight whitespace-nowrap transition-colors select-none",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AuditSeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      variant={severity === "ERROR" ? "destructive" : "warning"}
      className="font-mono"
    >
      {severity}
    </Badge>
  );
}

const ICON = "h-3 w-3 shrink-0";
const FUEL_ICONS: Record<FuelIconKind, React.ReactNode> = {
  gas: <Flame className={ICON} />,
  nuclear: <Atom className={ICON} />,
  solar: <Sun className={ICON} />,
  wind: <Wind className={ICON} />,
  hydro: <Droplets className={ICON} />,
  fossil: <Factory className={ICON} />,
  other: <Zap className={ICON} />,
};

export function FuelBadge({ fuel }: { fuel: string }) {
  const theme = getFuelTheme(fuel);
  return (
    <Badge variant={theme.variant}>
      {FUEL_ICONS[theme.icon]}
      {fuel}
    </Badge>
  );
}

export function CarbonIntensityBadge({
  intensity,
  showValue = false,
}: {
  intensity: number | null | undefined;
  showValue?: boolean;
}) {
  if (intensity == null) {
    return <span className="text-fg-muted font-mono text-xs">—</span>;
  }
  const tier = getCarbonIntensityTier(intensity);
  return (
    <Badge variant={tier.variant} title={tier.description}>
      {showValue && (
        <span className="font-mono font-semibold">
          {Math.round(intensity).toLocaleString()} lbs/MWh
        </span>
      )}
      {tier.label}
    </Badge>
  );
}

const ROLE_ICONS: Record<PlantRoleInfo["icon"], React.ReactNode> = {
  zap: <Zap className={ICON} />,
  clock: <Clock className={ICON} />,
  factory: <Factory className={ICON} />,
  power: <Power className={ICON} />,
  activity: <Activity className={ICON} />,
};

export function PlantRoleBadge({ roleInfo }: { roleInfo: PlantRoleInfo }) {
  return (
    <Badge
      variant={roleInfo.variant}
      title={roleInfo.description}
      className="shrink-0"
    >
      {ROLE_ICONS[roleInfo.icon]}
      {roleInfo.badgeLabel}
    </Badge>
  );
}
