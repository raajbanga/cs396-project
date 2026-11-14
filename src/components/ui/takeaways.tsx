import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * The plain-language answer at the top of an analysis: a few sentences, read before any chart or
 * table. Empty sentences (nothing worth saying) are skipped; with none left it renders nothing.
 */
export function Takeaways({
  items,
  className,
}: {
  items: (ReactNode | null | undefined | false)[];
  className?: string;
}) {
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div
      className={cn(
        "border-primary/40 text-fg max-w-[75ch] space-y-1.5 border-l-2 pl-4 text-[15px] text-pretty",
        className,
      )}
    >
      {shown.map((item, i) => (
        <p key={i}>{item}</p>
      ))}
    </div>
  );
}
