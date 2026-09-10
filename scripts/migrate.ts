import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "~/server/db";

await migrate(db, { migrationsFolder: "drizzle" });
console.log("Database migrations applied.");
