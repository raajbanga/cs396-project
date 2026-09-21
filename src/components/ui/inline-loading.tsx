import { RefreshCw } from "lucide-react";
import { cn } from "~/lib/utils";

export function InlineLoading({
  title,
  subtitle,
  size = "md",
  className,
}: {
  title: string;
  subtitle?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-fg-muted text-center",
        size === "sm" ? "py-14" : "py-20 sm:py-24",
        className,
      )}
    >
      <RefreshCw
        className={cn(
          "mx-auto mb-2 animate-spin text-emerald-400",
          size === "sm" ? "h-6 w-6" : "h-6 w-6 sm:mb-3",
        )}
      />
      <p
        className={cn(
          "text-fg font-medium",
          size === "sm" ? "text-xs sm:text-sm" : "text-xs sm:text-sm",
        )}
      >
        {title}
      </p>
      {subtitle ? (
        <p className="text-fg-muted mt-1 text-xs">{subtitle}</p>
      ) : null}
    </div>
  );
}
