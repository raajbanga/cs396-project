import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

/** Relative `file:` URLs resolve against the project root, so scripts and the server share one file. */
const resolveDatabaseUrl = (rawUrl: string) =>
  rawUrl.startsWith("file:")
    ? `file:${path.resolve(process.cwd(), rawUrl.slice(5))}`
    : rawUrl;

/** Cache the connection in development so HMR doesn't open a new one per update. */
const globalForDb = globalThis as unknown as { client: Client | undefined };

const client =
  globalForDb.client ??
  createClient({
    url: resolveDatabaseUrl(env.DATABASE_URL),
    authToken: env.DATABASE_AUTH_TOKEN,
  });
if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
