import type { ComponentProps } from "react";
import { CloudDownload, Database } from "lucide-react";
import { getFuelTheme } from "~/lib/map-utils";
import { getCarbonIntensityTier } from "~/lib/plant-narrative";
import { cn, datasetOriginLabel } from "~/lib/utils";

/** Flat outlined tags; color only where the tag carries a status. */
const VARIANT_STYLES = {
  default: "bg-surface-2 text-fg border-transparent",
  secondary: "text-fg-muted border-edge",
  outline: "text-fg-2 border-edge",
  success: "text-success border-success/40",
  warning: "text-warn border-warn/45",
  destructive: "text-danger border-danger/40",
  sky: "text-info border-info/40",
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
        "inline-flex items-center gap-1 rounded-sm border px-1.5 text-xs leading-5 font-medium whitespace-nowrap select-none",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Where the numbers on screen come from: the local SQLite database, or a live call to the EPA
 * CAMPD API. `detail` adds context such as the last import date.
 */
export function SourceBadge({
  kind,
  detail,
  className,
}: {
  kind: "db" | "api";
  detail?: string;
  className?: string;
}) {
  const db = kind === "db";
  const Icon = db ? Database : CloudDownload;
  return (
    <Badge
      variant={db ? "secondary" : "sky"}
      className={cn("font-normal", className)}
      title={
        db
          ? "Read from the local SQLite database"
          : "Fetched live from the EPA CAMPD API (not stored until saved)"
      }
    >
      <Icon className="h-3 w-3 shrink-0" />
      {db ? "Local database" : "Live EPA API"}
      {detail && <span className="opacity-75">· {detail}</span>}
    </Badge>
  );
}

/** Which dataset wrote a unit-year: the CAMPD API or a file upload (date and dataset name on hover). */
export function OriginBadge({
  origin,
  datasetImportedAt,
  datasetName,
}: {
  origin: string | null;
  datasetImportedAt: Date | null;
  datasetName?: string | null;
}) {
  if (!origin || !datasetImportedAt) {
    return <span className="text-fg-muted text-xs">—</span>;
  }
  const api = origin === "API";
  return (
    <Badge
      variant={api ? "secondary" : "sky"}
      title={`${datasetOriginLabel({ source: origin, importedAt: datasetImportedAt })}${datasetName ? `\n${datasetName}` : ""}`}
    >
      {api ? "API" : "Upload"}
    </Badge>
  );
}

export function AuditSeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge variant={severity === "ERROR" ? "destructive" : "warning"}>
      {severity}
    </Badge>
  );
}

/** Fuel name with the map's fuel color as a dot, so table rows and the map legend read the same. */
export function FuelBadge({ fuel }: { fuel: string }) {
  return (
    <span className="text-fg-2 inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: getFuelTheme(fuel).color }}
      />
      {fuel}
    </span>
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
    return <span className="text-fg-muted text-xs">—</span>;
  }
  const tier = getCarbonIntensityTier(intensity);
  return (
    <Badge variant={tier.variant} title={tier.description}>
      {showValue && (
        <span className="tabular-nums">
          {Math.round(intensity).toLocaleString()} lbs/MWh ·
        </span>
      )}
      {tier.label}
    </Badge>
  );
}
