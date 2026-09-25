import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Validated env. Set `SKIP_ENV_VALIDATION` to skip (e.g. Docker builds); empty strings count as unset. */
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    CAMPD_API: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_CARTO_API: z.string().optional(),
  },
  // Destructured by hand: edge runtimes and the client can't enumerate `process.env`.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
    CAMPD_API: process.env.CAMPD_API,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CARTO_API: process.env.NEXT_PUBLIC_CARTO_API,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
