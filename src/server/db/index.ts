import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "~/env";
import * as schema from "./schema";

function resolveDatabaseUrl(rawUrl: string) {
  if (!rawUrl.startsWith("file:")) return rawUrl;
  const filePath = path.resolve(process.cwd(), rawUrl.slice(5));

  // Serverless deploy filesystems are read-only: copy the bundled SQLite file to
  // writable /tmp on cold start so SQLite can take locks and write journals.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = "/tmp/db.sqlite";
    try {
      if (!fs.existsSync(tmpPath)) {
        const source = [
          filePath,
          path.join(process.cwd(), "db.sqlite"),
          path.join(process.cwd(), ".next", "server", "db.sqlite"),
        ].find((p) => fs.existsSync(p));
        if (source) fs.copyFileSync(source, tmpPath);
      }
      if (fs.existsSync(tmpPath)) return `file:${tmpPath}`;
    } catch (err) {
      console.error("Failed to copy db.sqlite to /tmp:", err);
    }
  }
  return `file:${filePath}`;
}

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
