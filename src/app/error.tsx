"use client";

import { useEffect } from "react";
import { QueryError } from "~/components/ui/empty-state";

/** Any page that throws shows the same retry box as a failed chart, inside the site layout. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return <QueryError error={error} onRetry={retry} className="my-16" />;
}
