import type { ReactNode } from "react";
import { glossSegments } from "~/lib/glossary";

/** The dotted underline that says "hover for a definition", shared with table headers. */
export const GLOSS_CLASS =
  "decoration-fg-muted/60 cursor-help underline decoration-dotted underline-offset-4";

/** Renders `glossSegments` output: terms underlined with their definition as the tooltip. */
export function renderGloss(parts: ReturnType<typeof glossSegments>) {
  return parts.map((part, i) =>
    part.definition ? (
      <span key={i} title={part.definition} className={GLOSS_CLASS}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

/**
 * Running text with its jargon explained on hover: each glossary term's first mention gets a
 * dotted underline and the definition as its tooltip. Anything but a string passes through.
 */
export function GlossedText({ children }: { children: ReactNode }) {
  return typeof children === "string"
    ? renderGloss(glossSegments(children))
    : children;
}
