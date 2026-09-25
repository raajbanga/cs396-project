import type { ReactNode } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { cn } from "~/lib/utils";

export function EmptyState({
  variant = "neutral",
  title,
  description,
  action,
  className,
}: {
  variant?: "neutral" | "success";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const success = variant === "success";
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed p-8 text-center",
        success ? "border-emerald-500/20 bg-emerald-500/5" : "border-edge",
        className,
      )}
    >
      {success && (
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
      )}
      <p
        className={cn(
          "text-sm font-semibold",
          success ? "text-emerald-400" : "text-fg",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="text-fg-muted mt-0.5 text-xs">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InlineLoading({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-fg-muted py-14 text-center", className)}>
      <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
      <p className="text-fg text-xs font-medium sm:text-sm">{title}</p>
      {subtitle && <p className="text-fg-muted mt-1 text-xs">{subtitle}</p>}
    </div>
  );
}
