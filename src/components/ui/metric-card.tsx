import * as React from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtext?: string;
  icon: React.ReactNode;
  valueClassName?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtext,
  icon,
  valueClassName,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden border-edge/80 bg-surface/30", className)}>
      <CardHeader className="p-3 pb-1.5 sm:p-4 sm:pb-2">
        <div className="flex items-center justify-between text-sm text-fg-muted">
          <span className="font-medium tracking-tight text-fg">{title}</span>
          <span className="opacity-80">{icon}</span>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <div
          className={cn(
            "text-2xl font-bold tracking-tight text-fg sm:text-3xl",
            valueClassName,
          )}
        >
          {value}
        </div>
        {subtext && (
          <p className="mt-1 truncate text-xs text-fg-muted" title={subtext}>
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
