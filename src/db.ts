import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { orders, products } from "./schema";

export { orders, products } from "./schema";

const databasePath = Bun.env.SQLITE_DB_PATH ?? "./data/elysia-example.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath);

// Multiple service processes share this file. WAL allows readers alongside a
// writer, while busy_timeout lets SQLite wait briefly for the writer lock
// instead of failing immediately with SQLITE_BUSY.
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA busy_timeout = 5000");

export const db = drizzle(sqlite);

// Apply checked-in migrations at startup. The initial migration uses
// CREATE TABLE IF NOT EXISTS, so existing databases retain all data.
migrate(db, { migrationsFolder: "./drizzle" });
