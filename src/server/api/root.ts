import { analysisRouter } from "~/server/api/routers/analysis";
import { facilitiesRouter } from "~/server/api/routers/facilities";
import { predictionRouter } from "~/server/api/routers/prediction";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  facilities: facilitiesRouter,
  analysis: analysisRouter,
  prediction: predictionRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller, e.g. `createCaller(createContext).facilities.getStats()`. */
export const createCaller = createCallerFactory(appRouter);
