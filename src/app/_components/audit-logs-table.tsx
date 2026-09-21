import { AuditSeverityBadge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { InlineLoading } from "~/components/ui/inline-loading";
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
                  <TableCell colSpan={6} className="p-0">
                    <InlineLoading
                      size="sm"
                      title="Loading audit records..."
                      className="py-12"
                    />
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="No audit violations recorded"
                      description="Run CAMPD sync to evaluate records."
                      className="border-0 py-12"
                    />
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

        <div className="divide-edge/60 divide-y sm:hidden">
          {isLoading ? (
            <InlineLoading
              size="sm"
              title="Loading audit records..."
              className="py-6"
            />
          ) : logs?.length === 0 ? (
            <EmptyState
              title="No audit violations recorded."
              className="border-0"
            />
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
