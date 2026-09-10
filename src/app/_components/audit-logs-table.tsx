import { AuditSeverityBadge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

interface AuditLogRow {
  id: string;
  flagType: string;
  severity: string;
  details: string;
  createdAt: Date | number;
  year: number;
  unitId: string;
  facilityId: number;
  facilityName: string;
}

interface AuditLogsTableProps {
  logs?: AuditLogRow[];
  isLoading: boolean;
}

export function AuditLogsTable({ logs, isLoading }: AuditLogsTableProps) {
  return (
    <Card className="border-edge/80 bg-surface/30 overflow-hidden shadow-xs">
      <CardHeader className="border-edge/60 border-b p-4">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
          Automated Data Sanity & Quality Audits
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Thermodynamic validation flagging heat rate bounds, zero-emissions
          combustion, and phantom generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop Table (>= sm) */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="border-edge/80 bg-surface/50 hover:bg-surface/50 border-b">
                <TableHead className="w-24">Severity</TableHead>
                <TableHead>Rule Triggered</TableHead>
                <TableHead>Facility / Unit</TableHead>
                <TableHead className="w-16">Year</TableHead>
                <TableHead>Audit Explanation</TableHead>
                <TableHead className="w-24 text-right">Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-fg-muted py-12 text-center"
                  >
                    Loading audit records...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-fg-muted py-12 text-center"
                  >
                    No audit violations recorded. Run CAMPD sync to evaluate
                    records.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <AuditSeverityBadge severity={log.severity} />
                    </TableCell>
                    <TableCell className="text-fg font-mono text-xs font-semibold">
                      {log.flagType}
                    </TableCell>
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
                    <TableCell className="text-fg-muted max-w-md text-xs sm:text-sm">
                      {log.details}
                    </TableCell>
                    <TableCell className="text-fg-muted text-right font-mono text-xs">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card List (< sm) */}
        <div className="divide-edge/60 divide-y sm:hidden">
          {isLoading ? (
            <div className="text-fg-muted p-6 text-center text-xs">
              Loading audit records...
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-fg-muted p-8 text-center text-xs">
              No audit violations recorded.
            </div>
          ) : (
            logs?.map((log) => (
              <div key={log.id} className="space-y-2 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <AuditSeverityBadge severity={log.severity} />
                  <span className="text-fg-muted font-mono text-xs">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-fg text-sm font-semibold">
                    {log.facilityName}
                  </span>
                  <span className="text-fg-muted ml-1.5 font-mono text-xs">
                    Unit {log.unitId} ({log.year})
                  </span>
                </div>
                <p className="border-edge/80 bg-canvas/80 text-fg rounded border px-2.5 py-1 font-mono text-xs">
                  {log.flagType}
                </p>
                <p className="text-fg-muted text-xs leading-relaxed">
                  {log.details}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
