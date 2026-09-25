import { AuditSeverityBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

interface AuditLog {
  id: string;
  flagType: string;
  severity: string;
  details: string;
}

interface AuditLogWithContext extends AuditLog {
  createdAt: Date | number;
  year: number;
  unitId: string;
  facilityId: number;
  facilityName: string;
}

const hasContext = (log: AuditLog): log is AuditLogWithContext =>
  "facilityName" in log;

/** Severity / rule / explanation table; adds facility, year, and timestamp columns when present. */
export function AuditTable({ logs }: { logs: AuditLog[] }) {
  const withContext = logs.some(hasContext);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Severity</TableHead>
          <TableHead>Rule Triggered</TableHead>
          {withContext && <TableHead>Facility / Unit</TableHead>}
          {withContext && <TableHead className="w-16">Year</TableHead>}
          <TableHead>Audit Explanation</TableHead>
          {withContext && (
            <TableHead className="w-24 text-right">Logged</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>
              <AuditSeverityBadge severity={log.severity} />
            </TableCell>
            <TableCell className="text-fg font-mono text-xs font-semibold">
              {log.flagType}
            </TableCell>
            {hasContext(log) && (
              <>
                <TableCell>
                  <div className="text-fg text-sm font-semibold">
                    {log.facilityName}
                  </div>
                  <div className="text-fg-muted font-mono text-xs">
                    #{log.facilityId} • Unit {log.unitId}
                  </div>
                </TableCell>
                <TableCell className="text-fg-2 font-mono text-xs">
                  {log.year}
                </TableCell>
              </>
            )}
            <TableCell className="text-fg-muted max-w-md text-xs sm:text-sm">
              {log.details}
            </TableCell>
            {hasContext(log) && (
              <TableCell className="text-fg-muted text-right font-mono text-xs">
                {new Date(log.createdAt).toLocaleDateString()}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AuditLogsTable({
  logs = [],
  isLoading,
}: {
  logs?: AuditLogWithContext[];
  isLoading: boolean;
}) {
  return (
    <DataPanel className="border-edge/80 bg-surface/30 shadow-xs">
      <div className="border-edge/60 space-y-1.5 border-b p-4">
        <h3 className="text-fg text-base font-semibold tracking-tight sm:text-lg">
          Automated Data Sanity & Quality Audits
        </h3>
        <p className="text-fg-muted text-xs leading-relaxed sm:text-sm">
          Thermodynamic validation flagging heat rate bounds, zero-emissions
          combustion, and phantom generation.
        </p>
      </div>

      {isLoading ? (
        <InlineLoading title="Loading audit records..." className="py-12" />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit violations recorded"
          description="Run CAMPD sync to evaluate records."
          className="border-0 py-12"
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <AuditTable logs={logs} />
          </div>
          <div className="divide-edge/60 divide-y sm:hidden">
            {logs.map((log) => (
              <div key={log.id} className="space-y-2 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <AuditSeverityBadge severity={log.severity} />
                  <span className="text-fg-muted font-mono">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
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
                <p className="text-fg-muted leading-relaxed">{log.details}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </DataPanel>
  );
}

export function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return logs.length === 0 ? (
    <EmptyState
      variant="success"
      title="All Physical Sanity Checks Clean"
      description="No thermodynamic anomalies or reporting violations detected for this plant."
    />
  ) : (
    <DataPanel>
      <AuditTable logs={logs} />
    </DataPanel>
  );
}
