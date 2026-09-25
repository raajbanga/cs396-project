import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import { db } from "~/server/db";

/** Request context shared by the HTTP handler and RSC caller. @see https://trpc.io/docs/server/context */
export const createTRPCContext = async (opts: { headers: Headers }) => ({
  db,
  ...opts,
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** Logs procedure timing in development to surface request waterfalls. */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  if (process.env.NODE_ENV === "development") {
    console.log(`[TRPC] ${path} took ${Date.now() - start}ms to execute`);
  }
  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);
