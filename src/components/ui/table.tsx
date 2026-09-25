import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("text-fg-2 w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "border-edge bg-surface/80 text-fg-muted border-b text-xs font-medium tracking-wider uppercase [&_tr]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody className={cn("divide-edge/60 divide-y", className)} {...props} />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("hover:bg-surface-2/40 transition-colors", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("h-10 px-3 text-left align-middle font-medium", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("p-3 align-middle", className)} {...props} />;
}
