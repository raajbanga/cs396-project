"use client";

import { useState } from "react";
import { AuditSeverityBadge, OriginBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import {
  localSortProps,
  ResultsPanel,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Paging,
} from "~/components/ui/table";
import { AUDIT_RULES, AUDIT_THRESHOLDS } from "~/lib/emissions-metrics";
import type { AuditSortField, SortDirection } from "~/lib/facility-filters";
import { cn, formatNumber, sortRows, type SortValue } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { DetailLink } from "./detail-link";

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
  unitInternalId?: string;
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
  supersededUpload?: string | null;
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
              <div className="text-fg">{RULE_LABELS[log.flagType]}</div>
              <div className="text-fg-muted font-mono text-xs">
                {log.flagType}
              </div>
            </TableCell>
            {(has("facilityName") || has("unitId")) && (
              <TableCell>
                {log.facilityName &&
                  (log.unitInternalId ? (
                    <DetailLink
                      view={{ kind: "unit", id: log.unitInternalId }}
                      className="text-fg block"
                    >
                      {log.facilityName}
                    </DetailLink>
                  ) : (
                    <div className="text-fg">{log.facilityName}</div>
                  ))}
                <div className="text-fg-muted text-xs">
                  {log.facilityId !== undefined && `${log.facilityId}, `}
                  unit {log.unitId ?? "—"}
                </div>
              </TableCell>
            )}
            {has("year") && (
              <TableCell className="text-fg-2 tabular-nums">
                {log.year}
              </TableCell>
            )}
            <TableCell
              className={cn(
                "max-w-md",
                showValue ? "text-fg-2 tabular-nums" : "text-fg-muted",
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
                  supersededUpload={log.supersededUpload}
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
  paging,
  sortBy,
  sortDir,
  onSortChange,
}: {
  data?: AuditPage;
  paging: Paging;
  sortBy: AuditSortField;
  sortDir: SortDirection;
  onSortChange: (field: AuditSortField) => void;
}) {
  const logs = data?.items ?? [];
  return (
    <div className="space-y-3">
      <p className="text-fg-2 max-w-[75ch] text-sm">
        Unit-years that broke a physical-sanity rule when they were stored. The
        values shown are the ones that tripped the rule; hover a row for the
        full explanation.
        {data && data.summary.length > 0 && (
          <>
            {" "}
            In total:{" "}
            {data.summary.map((s, i) => (
              <span key={`${s.flagType}:${s.severity}`}>
                {i > 0 && ", "}
                <strong className="text-fg font-medium tabular-nums">
                  {formatNumber(s.count)}
                </strong>{" "}
                {RULE_LABELS[s.flagType] ?? s.flagType} ({s.severity})
              </span>
            ))}
            .
          </>
        )}
      </p>
      <ResultsPanel paging={paging} data={data} itemLabel="flags">
        <div className="hidden sm:block">
          <AuditTable logs={logs} sort={{ sortBy, sortDir, onSortChange }} />
        </div>
        <div className="divide-edge/70 divide-y sm:hidden">
          {logs.map((log) => (
            <div key={log.id} className="space-y-1 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-fg truncate">{log.facilityName}</span>
                <AuditSeverityBadge severity={log.severity} />
              </div>
              <div className="text-fg-muted text-xs">
                Unit {log.unitId}, {log.year} · {RULE_LABELS[log.flagType]}
              </div>
              <p className="text-fg-2 tabular-nums">{flaggedValue(log)}</p>
            </div>
          ))}
        </div>
      </ResultsPanel>
    </div>
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
      title="No data-quality flags"
      description="Every stored record passed the physical-sanity checks."
    />
  ) : (
    <DataPanel>
      <AuditTable logs={logs} />
    </DataPanel>
  );
}
