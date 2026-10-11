"use client";

import { use, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { SelectionContext, type DetailView } from "./selection-context";

/** A name that opens its facility or unit in the detail dialog (§8.4: results link to details). */
export function DetailLink({
  view,
  className,
  children,
  title,
}: {
  view: Exclude<DetailView, { kind: "compare" }>;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  const { inspect } = use(SelectionContext);
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        inspect(view);
      }}
      className={cn(
        "cursor-pointer text-left hover:underline",
        className ?? "text-primary",
      )}
    >
      {children}
    </button>
  );
}
