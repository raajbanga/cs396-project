import { z } from "zod";

import { DIMENSION_KEYS } from "~/lib/analysis";
import { facilityFilterSchema } from "~/lib/facility-filters";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  aggregateTable,
  analysisRows,
  catalog,
  compareGroups,
  correlationMatrix,
  datasetSummary,
  describeVariable,
  distribution,
  findVariable,
  loadVariables,
  scatterPoints,
} from "~/server/analysis";

/** Phase 2 Analyze page: every procedure takes the Explore filters as the selection. */
const filters = facilityFilterSchema.default({});
const dimension = z.enum(DIMENSION_KEYS);

/** The selection's rows and the variables, with `keys` resolved to variables. */
async function load(input: z.infer<typeof filters>, keys: string[]) {
  const [rows, variables] = await Promise.all([
    analysisRows(input),
    loadVariables(),
  ]);
  return {
    rows,
    variables,
    picked: keys.map((k) => findVariable(variables, k)),
  };
}

export const analysisRouter = createTRPCRouter({
  catalog: publicProcedure.query(() => catalog()),

  summary: publicProcedure
    .input(z.object({ filters }))
    .query(async ({ input }) => {
      const { rows, variables } = await load(input.filters, []);
      return datasetSummary(rows, variables);
    }),

  describe: publicProcedure
    .input(
      z.object({ filters, variable: z.string(), by: dimension.optional() }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, [input.variable]);
      return describeVariable(rows, picked[0]!, input.by);
    }),

  aggregate: publicProcedure
    .input(
      z.object({
        filters,
        variables: z.array(z.string()).min(1).max(12),
        by: dimension,
        seriesBy: dimension.optional(),
        order: z.enum(["desc", "asc", "label"]).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, input.variables);
      return aggregateTable(rows, picked, input.by, input);
    }),

  distribution: publicProcedure
    .input(
      z.object({ filters, variable: z.string(), by: dimension.optional() }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, [input.variable]);
      return distribution(rows, picked[0]!, input.by);
    }),

  scatter: publicProcedure
    .input(
      z.object({ filters, x: z.string(), y: z.string(), color: dimension }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, [input.x, input.y]);
      return scatterPoints(rows, picked[0]!, picked[1]!, input.color);
    }),

  correlation: publicProcedure
    .input(
      z.object({
        filters,
        variables: z.array(z.string()).min(2).max(16),
        method: z.enum(["pearson", "spearman"]),
      }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, input.variables);
      return correlationMatrix(rows, picked, input.method);
    }),

  compare: publicProcedure
    .input(
      z.object({
        filters,
        variable: z.string(),
        by: dimension,
        groups: z.array(z.string()).min(2).max(8),
      }),
    )
    .query(async ({ input }) => {
      const { rows, picked } = await load(input.filters, [input.variable]);
      return compareGroups(rows, picked[0]!, input.by, input.groups);
    }),
});
