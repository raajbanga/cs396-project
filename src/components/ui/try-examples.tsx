import { cn } from "~/lib/utils";

/** "Try a, b, c": sample inputs that fill a form in one click, for first use and the demo. */
export function TryExamples({
  examples,
  className,
}: {
  examples: { label: string; onSelect: () => void }[];
  className?: string;
}) {
  return (
    <p className={cn("text-fg-muted text-sm", className)}>
      Try{" "}
      {examples.map(({ label, onSelect }, i) => (
        <span key={label}>
          {i > 0 && ", "}
          <button
            type="button"
            onClick={onSelect}
            className="text-fg-2 hover:text-primary cursor-pointer underline decoration-dotted underline-offset-2"
          >
            {label}
          </button>
        </span>
      ))}
    </p>
  );
}
