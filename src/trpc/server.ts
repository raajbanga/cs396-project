import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { headers } from "next/headers";
import { cache } from "react";

import { createCaller, type AppRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { getRequestQueryClient } from "./query-client";

/** tRPC context for calls made from React Server Components. */
const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(
  createCaller(createContext),
  getRequestQueryClient,
);
