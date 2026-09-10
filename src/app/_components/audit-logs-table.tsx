import { Badge } from "~/components/ui/badge";
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
    <Card className="overflow-hidden border-edge/80 bg-surface/30 shadow-xs">
      <CardHeader className="border-b border-edge/60 p-4">
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
              <TableRow className="border-b border-edge/80 bg-surface/50 hover:bg-surface/50">
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
                    className="py-12 text-center text-fg-muted"
                  >
                    Loading audit records...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-fg-muted"
                  >
                    No audit violations recorded. Run CAMPD sync to evaluate
                    records.
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge
                        variant={
                          log.severity === "ERROR" ? "destructive" : "warning"
                        }
                        className="px-2 py-0.5 font-mono text-xs"
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-fg">
                      {log.flagType}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold text-fg">
                        {log.facilityName}
                      </div>
                      <div className="font-mono text-xs text-fg-muted">
                        #{log.facilityId} • Unit {log.unitId}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-fg-2">
                      {log.year}
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-fg-muted sm:text-sm">
                      {log.details}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-fg-muted">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card List (< sm) */}
        <div className="divide-y divide-edge/60 sm:hidden">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-fg-muted">
              Loading audit records...
            </div>
          ) : logs?.length === 0 ? (
            <div className="p-8 text-center text-xs text-fg-muted">
              No audit violations recorded.
            </div>
          ) : (
            logs?.map((log) => (
              <div key={log.id} className="space-y-2 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      log.severity === "ERROR" ? "destructive" : "warning"
                    }
                    className="px-2 py-0.5 font-mono text-xs"
                  >
                    {log.severity}
                  </Badge>
                  <span className="font-mono text-xs text-fg-muted">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-semibold text-fg">
                    {log.facilityName}
                  </span>
                  <span className="ml-1.5 font-mono text-xs text-fg-muted">
                    Unit {log.unitId} ({log.year})
                  </span>
                </div>
                <p className="rounded border border-edge/80 bg-canvas/80 px-2.5 py-1 font-mono text-xs text-fg">
                  {log.flagType}
                </p>
                <p className="leading-relaxed text-xs text-fg-muted">
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
