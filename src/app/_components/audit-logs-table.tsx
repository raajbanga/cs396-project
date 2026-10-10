"use client";

import { useState } from "react";
import { AuditSeverityBadge, Badge, OriginBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import {
  localSortProps,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "~/components/ui/table";
import { AUDIT_RULES, AUDIT_THRESHOLDS } from "~/lib/emissions-metrics";
import type { AuditSortField, SortDirection } from "~/lib/facility-filters";
import { cn, formatNumber, sortRows, type SortValue } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

/**
 * A physical-sanity flag. Context fields are optional: the Audits tab has all of them, detail
 * dialogs add the year, unit, and measured values, and the upload preview has only the flag.
 */
interface AuditLog {
  id: string;
  flagType: string;
  severity: string;
  details: string;
  year?: number;
  unitId?: string;
  facilityId?: number;
  facilityName?: string;
  heatInputMMBtu?: number | null;
  co2MassTons?: number | null;
  grossGenerationMWh?: number | null;
  operatingHours?: number | null;
  heatRateMMBtuMWh?: number | null;
  origin?: string | null;
  datasetImportedAt?: Date | null;
  datasetName?: string | null;
}

type AuditPage = RouterOutputs["facilities"]["getAuditLogs"];
type SortState = { sortBy: AuditSortField; sortDir: SortDirection };

const RULE_LABELS: Record<string, string> = Object.fromEntries(
  AUDIT_RULES.map((r) => [r.flagType, r.label]),
);

/** The measured values that tripped the rule, e.g. "48,210 MMBtu · 0 t CO₂" or "31.2 MMBtu/MWh (5–25)". */
function flaggedValue(log: AuditLog) {
  switch (log.flagType) {
    case "ZERO_EMISSIONS_HIGH_HEAT":
      return `${formatNumber(log.heatInputMMBtu)} MMBtu · ${formatNumber(log.co2MassTons, 1)} t CO₂`;
    case "CO2_NOT_REPORTED":
      return `${formatNumber(log.heatInputMMBtu)} MMBtu · CO₂ not reported`;
    case "PHANTOM_GENERATION":
      return `${formatNumber(log.grossGenerationMWh)} MWh · ${formatNumber(log.operatingHours, 1)} h`;
    case "EXTREME_HEAT_RATE":
      return `${log.heatRateMMBtuMWh?.toFixed(2) ?? "—"} MMBtu/MWh (${AUDIT_THRESHOLDS.HEAT_RATE_MIN_MMBTU_MWH}–${AUDIT_THRESHOLDS.HEAT_RATE_MAX_MMBTU_MWH})`;
    default:
      return "—";
  }
}

/** Client-side sort keys, matching the server's AUDIT_SORT_FIELDS. */
const SORT_KEYS: Record<AuditSortField, (log: AuditLog) => SortValue> = {
  year: (l) => l.year,
  severity: (l) => l.severity,
  rule: (l) => l.flagType,
  facility: (l) => l.facilityName ?? l.unitId,
  source: (l) => l.datasetImportedAt,
};

/**
 * Flag table with sortable columns. With `sort` the parent sorts (the paged Audits tab, server-side);
 * without it, the rows given are sorted here. Columns appear for the context the rows carry.
 */
export function AuditTable({
  logs,
  sort,
}: {
  logs: AuditLog[];
  sort?: SortState & { onSortChange: (field: AuditSortField) => void };
}) {
  const [localSort, setLocalSort] = useState<SortState>({
    sortBy: "severity",
    sortDir: "asc",
  });
  const has = (key: keyof AuditLog) => logs.some((l) => l[key] !== undefined);
  const head =
    sort ??
    localSortProps(
      localSort,
      setLocalSort,
      (f) => f === "year" || f === "source",
    );
  const rows = sort
    ? logs
    : sortRows(logs, SORT_KEYS[localSort.sortBy], localSort.sortDir);
  const showValue = has("heatInputMMBtu");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            label="Severity"
            sort="severity"
            className="w-24"
            {...head}
          />
          <SortableTableHead label="Rule" sort="rule" {...head} />
          {(has("facilityName") || has("unitId")) && (
            <SortableTableHead
              label={has("facilityName") ? "Facility / Unit" : "Unit"}
              sort="facility"
              {...head}
            />
          )}
          {has("year") && (
            <SortableTableHead
              label="Year"
              sort="year"
              className="w-20"
              {...head}
            />
          )}
          {showValue ? (
            <TableHead>Flagged values</TableHead>
          ) : (
            <TableHead>Explanation</TableHead>
          )}
          {has("origin") && (
            <SortableTableHead
              label="Source"
              sort="source"
              className="w-28"
              {...head}
            />
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              <AuditSeverityBadge severity={log.severity} />
            </TableCell>
            <TableCell>
              <div className="text-fg font-mono text-xs font-semibold">
                {log.flagType}
              </div>
              <div className="text-fg-muted text-xs">
                {RULE_LABELS[log.flagType]}
              </div>
            </TableCell>
            {(has("facilityName") || has("unitId")) && (
              <TableCell>
                {log.facilityName && (
                  <div className="text-fg text-sm font-semibold">
                    {log.facilityName}
                  </div>
                )}
                <div className="text-fg-muted font-mono text-xs">
                  {log.facilityId !== undefined && `#${log.facilityId} • `}
                  Unit {log.unitId ?? "—"}
                </div>
              </TableCell>
            )}
            {has("year") && (
              <TableCell className="text-fg-2 font-mono text-xs">
                {log.year}
              </TableCell>
            )}
            <TableCell
              className={cn(
                "max-w-md text-xs",
                showValue ? "text-fg font-mono" : "text-fg-muted sm:text-sm",
              )}
              title={showValue ? log.details : undefined}
            >
              {showValue ? flaggedValue(log) : log.details}
            </TableCell>
            {has("origin") && (
              <TableCell>
                <OriginBadge
                  origin={log.origin ?? null}
                  datasetImportedAt={log.datasetImportedAt ?? null}
                  datasetName={log.datasetName}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Audits tab: flags matching the explorer filters, server-sorted and paged, with per-rule counts. */
export function AuditLogsTable({
  data,
  page,
  pageSize,
  sortBy,
  sortDir,
  onSortChange,
  isLoading,
  isPlaceholderData,
  onPageChange,
  onPageSizeChange,
}: {
  data?: AuditPage;
  page: number;
  pageSize: number;
  sortBy: AuditSortField;
  sortDir: SortDirection;
  onSortChange: (field: AuditSortField) => void;
  isLoading: boolean;
  isPlaceholderData: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const logs = data?.items ?? [];
  return (
    <DataPanel className="border-edge/80 bg-surface/30 shadow-xs">
      <div className="border-edge/60 space-y-2 border-b p-4">
        <h3 className="text-fg text-base font-semibold tracking-tight sm:text-lg">
          Data-Quality Audit Flags
        </h3>
        <p className="text-fg-muted text-xs leading-relaxed sm:text-sm">
          Unit-years that broke a physical-sanity rule when they were stored.
          The values shown are the ones that tripped the rule; hover for the
          full explanation.
        </p>
        {data && data.summary.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {data.summary.map((s) => (
              <Badge
                key={`${s.flagType}:${s.severity}`}
                variant="outline"
                className="gap-1.5"
                title={RULE_LABELS[s.flagType]}
              >
                <AuditSeverityBadge severity={s.severity} />
                <span className="font-mono">{s.flagType}</span>
                <span className="text-fg font-semibold">
                  {formatNumber(s.count)}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <InlineLoading title="Loading audit records..." className="py-12" />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No flags match these filters"
          description="Clear filters, or retrieve or upload data to run the checks."
          className="border-0 py-12"
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <AuditTable logs={logs} sort={{ sortBy, sortDir, onSortChange }} />
          </div>
          <div className="divide-edge/60 divide-y sm:hidden">
            {logs.map((log) => (
              <div key={log.id} className="space-y-2 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <AuditSeverityBadge severity={log.severity} />
                  <OriginBadge {...log} />
                </div>
                <div>
                  <span className="text-fg text-sm font-semibold">
                    {log.facilityName}
                  </span>
                  <span className="text-fg-muted ml-1.5 font-mono">
                    Unit {log.unitId} ({log.year})
                  </span>
                </div>
                <p className="border-edge/80 bg-canvas/80 text-fg rounded border px-2.5 py-1 font-mono">
                  {log.flagType}
                </p>
                <p className="text-fg font-mono">{flaggedValue(log)}</p>
                <p className="text-fg-muted leading-relaxed">{log.details}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {data && data.totalCount > 0 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={data.totalCount}
          totalPages={Math.max(data.totalPages, 1)}
          itemLabel="flags"
          isPlaceholderData={isPlaceholderData}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </DataPanel>
  );
}

/** Flags of stored annual records, with each record's year, unit, and measured values (detail dialogs). */
export const flagsOfRecords = (
  records: {
    year: number;
    operatingHours: number | null;
    grossGenerationMWh: number | null;
    heatInputMMBtu: number | null;
    co2MassTons: number | null;
    heatRateMMBtuMWh: number | null;
    unit?: { unitId: string } | null;
    auditLogs: Pick<AuditLog, "id" | "flagType" | "severity" | "details">[];
  }[],
  unitId?: string,
): AuditLog[] =>
  records.flatMap((r) =>
    r.auditLogs.map((log) => ({
      ...log,
      year: r.year,
      unitId: r.unit?.unitId ?? unitId,
      operatingHours: r.operatingHours,
      grossGenerationMWh: r.grossGenerationMWh,
      heatInputMMBtu: r.heatInputMMBtu,
      co2MassTons: r.co2MassTons,
      heatRateMMBtuMWh: r.heatRateMMBtuMWh,
    })),
  );

/** Flags of one facility or unit (detail dialogs): client-sorted table, or a clean state. */
export function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return logs.length === 0 ? (
    <EmptyState
      variant="success"
      title="All Physical Sanity Checks Clean"
      description="No data-quality flags for this facility."
    />
  ) : (
    <DataPanel>
      <AuditTable logs={logs} />
    </DataPanel>
  );
}
