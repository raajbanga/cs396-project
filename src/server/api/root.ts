import { facilitiesRouter } from "~/server/api/routers/facilities";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  facilities: facilitiesRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller, e.g. `createCaller(createContext).facilities.getStats()`. */
export const createCaller = createCallerFactory(appRouter);
