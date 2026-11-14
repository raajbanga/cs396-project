import type { ReactNode } from "react";
import { renderGloss } from "~/components/ui/glossed-text";
import { glossSegments } from "~/lib/glossary";
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
  // Glossed in one pass with one set, so each term is underlined at its first mention in the
  // block only (computed here, not in children, so a re-render gives the same result).
  const seen = new Set<string>();
  const parts = shown.map((item) =>
    typeof item === "string" ? renderGloss(glossSegments(item, seen)) : item,
  );
  return (
    <div
      className={cn(
        "border-primary/40 text-fg max-w-[75ch] space-y-1.5 border-l-2 pl-4 text-[15px] text-pretty",
        className,
      )}
    >
      {parts.map((part, i) => (
        <p key={i}>{part}</p>
      ))}
    </div>
  );
}
