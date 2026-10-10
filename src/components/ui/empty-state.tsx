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
        "px-4 py-10 text-center",
        success && "text-success",
        className,
      )}
    >
      {success && <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />}
      <p
        className={cn(
          "text-sm font-medium",
          success ? "text-success" : "text-fg",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="text-fg-muted mt-1 text-sm">{description}</p>
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
    <div className={cn("text-fg-muted py-10 text-center", className)}>
      <RefreshCw className="text-fg-muted mx-auto mb-2 h-4 w-4 animate-spin" />
      <p className="text-fg-2 text-sm">{title}</p>
      {subtitle && <p className="text-fg-muted mt-1 text-xs">{subtitle}</p>}
    </div>
  );
}
