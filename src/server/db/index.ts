import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./url";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

function getDbUrl() {
  if (env.DATABASE_URL.startsWith("file:")) {
    const resolvedPath = resolveDatabaseUrl(env.DATABASE_URL).slice(5);

    // In Vercel / AWS Lambda serverless environments, the deployment filesystem is read-only.
    // Copy the bundled SQLite database to /tmp (writable) on cold start so SQLite can acquire locks and journals.
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const tmpPath = path.join("/tmp", "db.sqlite");
      try {
        if (!fs.existsSync(tmpPath)) {
          const candidatePaths = [
            resolvedPath,
            path.join(process.cwd(), "db.sqlite"),
            path.join(process.cwd(), ".next", "server", "db.sqlite"),
          ];
          const sourcePath = candidatePaths.find((p) => {
            try {
              return fs.existsSync(p);
            } catch {
              return false;
            }
          });

          if (sourcePath) {
            fs.copyFileSync(sourcePath, tmpPath);
          } else {
            console.warn("Could not find source db.sqlite to copy to /tmp");
          }
        }
        if (fs.existsSync(tmpPath)) {
          return `file:${tmpPath}`;
        }
      } catch (err) {
        console.error("Failed to copy db.sqlite to /tmp:", err);
      }
    }

    return `file:${resolvedPath}`;
  }
  return env.DATABASE_URL;
}

const client =
  globalForDb.client ??
  createClient({
    url: getDbUrl(),
    authToken: env.DATABASE_AUTH_TOKEN,
  });
if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
