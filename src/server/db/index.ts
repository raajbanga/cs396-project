import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

function getDbUrl() {
  if (env.DATABASE_URL.startsWith("file:")) {
    const rawPath = env.DATABASE_URL.slice(5);
    if (!path.isAbsolute(rawPath)) {
      return `file:${path.resolve(process.cwd(), rawPath)}`;
    }
  }
  return env.DATABASE_URL;
}

export const client =
  globalForDb.client ??
  createClient({
    url: getDbUrl(),
    authToken: env.DATABASE_AUTH_TOKEN,
  });
if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
