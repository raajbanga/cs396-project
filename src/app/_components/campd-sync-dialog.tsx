"use client";

import { AlertCircle, Check, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface CampdSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncYear: number;
  onSyncYearChange: (year: number) => void;
  syncState: string;
  onSyncStateChange: (state: string) => void;
  syncLimit: number;
  onSyncLimitChange: (limit: number) => void;
  states?: string[];
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage?: string;
  mutationData?: {
    rawRecordCount: number;
    validRecords: number;
    flaggedRecords: number;
  };
  onTriggerSync: () => void;
}

export function CampdSyncDialog({
  open,
  onOpenChange,
  syncYear,
  onSyncYearChange,
  syncState,
  onSyncStateChange,
  syncLimit,
  onSyncLimitChange,
  states,
  isPending,
  isSuccess,
  isError,
  errorMessage,
  mutationData,
  onTriggerSync,
}: CampdSyncDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-w-md space-y-4 p-4 sm:p-6">
        <DialogClose onClose={() => onOpenChange(false)} />

        <DialogHeader className="pr-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-400" />
            <DialogTitle>EPA CAMPD Live Sync</DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription>
          Ingest apportioned annual emissions and heat rates from the official
          EPA CAMPD API, calculate unit-level carbon intensity, and execute
          physical sanity checks.
        </DialogDescription>

        <div className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block font-medium text-fg-2">
              Reporting Year
            </label>
            <Select
              value={String(syncYear)}
              onValueChange={(val) => onSyncYearChange(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2022">2022 Reporting Year</SelectItem>
                <SelectItem value="2023">2023 Reporting Year</SelectItem>
                <SelectItem value="2024">2024 Reporting Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-fg-2">
              State Scope
            </label>
            <Select value={syncState} onValueChange={onSyncStateChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Nationwide (All States)</SelectItem>
                {states?.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-fg-2">
              Batch Size
            </label>
            <Select
              value={String(syncLimit)}
              onValueChange={(val) => onSyncLimitChange(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 records</SelectItem>
                <SelectItem value="250">250 records</SelectItem>
                <SelectItem value="500">500 records</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isSuccess && mutationData && (
          <div className="space-y-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold">
              <Check className="h-3.5 w-3.5" />
              <span>Ingestion Successful</span>
            </div>
            <div>Processed: {mutationData.rawRecordCount} records</div>
            <div>Valid Records: {mutationData.validRecords}</div>
            <div>Anomalies Logged: {mutationData.flaggedRecords}</div>
          </div>
        )}

        {isError && errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Sync error: {errorMessage}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={isPending}
            onClick={onTriggerSync}
            className="gap-1.5"
          >
            {isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <span>Trigger Ingestion</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
