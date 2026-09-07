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

export interface AuditLogRow {
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
    <div className="space-y-4">
      <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-hidden shadow-xs">
        <CardHeader className="p-4 border-b border-zinc-800/60">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Automated Data Sanity & Quality Audits
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-zinc-400">
            Thermodynamic validation flagging heat rate bounds, zero-emissions combustion, and phantom generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View (>= sm) */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-zinc-800/80 bg-zinc-900/50">
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Rule Triggered</TableHead>
                  <TableHead>Facility / Unit</TableHead>
                  <TableHead className="w-16">Year</TableHead>
                  <TableHead>Audit Explanation</TableHead>
                  <TableHead className="text-right w-24">Logged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-zinc-400"
                    >
                      Loading audit records...
                    </TableCell>
                  </TableRow>
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-zinc-400"
                    >
                      No audit violations recorded. Run CAMPD sync to evaluate records.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log) => (
                    <TableRow key={log.id} className="hover:bg-zinc-850/40">
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
                      <TableCell className="font-mono text-xs font-semibold text-zinc-200">
                        {log.flagType}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-zinc-100">
                          {log.facilityName}
                        </div>
                        <div className="font-mono text-xs text-zinc-400">
                          #{log.facilityId} • Unit {log.unitId}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">
                        {log.year}
                      </TableCell>
                      <TableCell className="max-w-md text-zinc-300 text-xs sm:text-sm">
                        {log.details}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List (< sm) */}
          <div className="divide-y divide-zinc-800/60 sm:hidden">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                Loading audit records...
              </div>
            ) : logs?.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No audit violations recorded.
              </div>
            ) : (
              logs?.map((log) => (
                <div key={log.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={log.severity === "ERROR" ? "destructive" : "warning"}
                      className="px-2 py-0.5 font-mono text-xs"
                    >
                      {log.severity}
                    </Badge>
                    <span className="font-mono text-xs text-zinc-500">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-100">{log.facilityName}</span>
                    <span className="text-xs text-zinc-400 ml-1.5 font-mono">Unit {log.unitId} ({log.year})</span>
                  </div>
                  <p className="font-mono text-xs text-zinc-200 bg-zinc-950/80 rounded px-2.5 py-1 border border-zinc-800/80">
                    {log.flagType}
                  </p>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {log.details}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
