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
    <Card className={className}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium">{title}</span>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={cn("text-2xl font-bold text-white", valueClassName)}>
          {value}
        </div>
        {subtext && (
          <p className="mt-0.5 text-[11px] text-zinc-500">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
