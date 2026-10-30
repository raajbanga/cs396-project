import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  baselineOptions,
  baselineUnitYear,
  listModels,
  testPredictions,
} from "~/server/prediction";

/** Phase 2 Predict page: models, baseline unit-years, and test-year predictions. */
export const predictionRouter = createTRPCRouter({
  models: publicProcedure.query(() => listModels()),

  baselineOptions: publicProcedure
    .input(z.object({ search: z.string().max(100), year: z.number().int() }))
    .query(({ input }) => baselineOptions(input.search, input.year)),

  baseline: publicProcedure
    .input(
      z.object({
        facilityId: z.number().int(),
        unitId: z.string(),
        year: z.number().int(),
      }),
    )
    .query(({ input }) =>
      baselineUnitYear(input.facilityId, input.unitId, input.year),
    ),

  testPredictions: publicProcedure
    .input(z.object({ from: z.number().int(), to: z.number().int() }))
    .query(({ input }) => testPredictions(input.from, input.to)),
});
