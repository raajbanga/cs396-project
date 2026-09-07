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
      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">
            Automated Ingestion Quality & Physical Sanity Engine
          </CardTitle>
          <CardDescription>
            Audit logs flagged according to PRD Section 3.3: High heat with zero
            CO2, phantom generation without operating hours, and extreme heat
            rate violations.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-t border-zinc-800 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead>Rule Triggered</TableHead>
                <TableHead>Facility / Unit</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Audit Explanation</TableHead>
                <TableHead className="text-right">Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-zinc-400"
                  >
                    Loading audit records...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-zinc-400"
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
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-white">
                      {log.flagType}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-zinc-200">
                        {log.facilityName} (#{log.facilityId})
                      </div>
                      <div className="font-mono text-[11px] text-emerald-400">
                        Unit {log.unitId}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-zinc-300">
                      {log.year}
                    </TableCell>
                    <TableCell className="max-w-md text-zinc-300">
                      {log.details}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-zinc-500">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
