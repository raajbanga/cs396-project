import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
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
  return (
    <div
      className={cn(
        "p-8 text-center",
        variant === "neutral" &&
          "border-edge text-fg-muted rounded-lg border border-dashed",
        variant === "success" &&
          "rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/5",
        className,
      )}
    >
      {variant === "success" && (
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
      )}
      <p
        className={cn(
          "text-sm font-semibold",
          variant === "success" ? "text-emerald-400" : "text-fg",
        )}
      >
        {title}
      </p>
      {description ? (
        <p className="text-fg-muted mt-0.5 text-xs">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
