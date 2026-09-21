"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "~/components/ui/dialog";
import { InlineLoading } from "~/components/ui/inline-loading";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils";

export type PlantAnalysisTabId =
  "overview" | "emissions" | "fleet" | "granular" | "audit";

interface PlantDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size: "inspect" | "compare";
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function PlantDialogShell({
  open,
  onOpenChange,
  size,
  header,
  footer,
  children,
  contentClassName,
}: PlantDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} className={contentClassName}>
        <DialogClose onClose={() => onOpenChange(false)} />
        {header}
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  );
}

export function PlantDialogHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <DialogHeader
      className={cn("border-edge shrink-0 border-b pr-10 pb-3", className)}
    >
      {children}
    </DialogHeader>
  );
}

export function PlantDialogScrollBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "-mr-1 min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PlantDialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <DialogFooter
      className={cn("border-edge mt-auto shrink-0 border-t pt-3", className)}
    >
      {children}
    </DialogFooter>
  );
}

export function PlantDialogLoading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <InlineLoading
      title={title}
      subtitle={subtitle}
      size="md"
      className={className}
    />
  );
}

interface PlantAnalysisTabsProps<T extends PlantAnalysisTabId> {
  value: T;
  onChange: (value: T) => void;
  options: readonly {
    value: T;
    label: ReactNode;
  }[];
}

export function PlantAnalysisTabs<T extends PlantAnalysisTabId>({
  value,
  onChange,
  options,
}: PlantAnalysisTabsProps<T>) {
  return (
    <SegmentedControl
      variant="tabs"
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}
