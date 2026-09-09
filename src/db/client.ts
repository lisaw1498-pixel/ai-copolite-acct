import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

type DB = BetterSQLite3Database<typeof schema>;

// Reuse a single connection across hot reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __sqlite__: Database.Database | undefined;
  // eslint-disable-next-line no-var
  var __drizzle__: DB | undefined;
}

let cached: DB | undefined;

/**
 * Opens the database lazily, on first query rather than at import time.
 *
 * This matters for more than tidiness: `next build` collects page data in
 * several parallel worker processes, and each one imports every route module.
 * Connecting eagerly meant every worker raced to set `journal_mode = WAL` on
 * the same file and the build died with SQLITE_BUSY.
 */

/**
 * Adds a column if it is missing. SQLite has no "ADD COLUMN IF NOT EXISTS",
 * and the schema bootstrap above only runs on a brand-new database, so an
 * existing local db would never pick up a new column otherwise.
 */
function ensureColumn(sqlite: Database.Database, table: string, column: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function connect(): DB {
  if (cached) return cached;
  if (global.__drizzle__) {
    cached = global.__drizzle__;
    return cached;
  }

  const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db");

  // Ensure the parent directory exists - a fresh clone won't have an empty
  // data/ folder checked in, and better-sqlite3 won't create missing parents.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = global.__sqlite__ ?? new Database(DB_PATH);
  // Wait instead of failing immediately if another process holds the lock.
  sqlite.pragma("busy_timeout = 10000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Auto-bootstrap the schema on first run so `npm install && npm run dev`
  // works immediately on a fresh clone with no separate migration step.
  // `npm run db:push` remains the way to apply schema *changes* later.
  const hasUsersTable = sqlite
    .prepare("select name from sqlite_master where type = 'table' and name = 'users'")
    .get();
  if (!hasUsersTable) {
    // Read from the project root (not __dirname) since Next.js bundles server
    // code and doesn't preserve source-relative paths for non-JS assets.
    const schemaSql = fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf-8");
    sqlite.exec(schemaSql);
  }

  // Lightweight forward migrations for databases created before a column existed.
  ensureColumn(sqlite, "resumes", "status_message", "text");
  // Provenance for AI-derived records, so re-analysis can replace what it
  // previously produced instead of stacking near-duplicates on top of it.
  for (const t of ["employers", "skills", "technologies", "career_stories"]) {
    ensureColumn(sqlite, t, "source_resume_id", "text");
  }

  const instance = drizzle(sqlite, { schema });
  if (process.env.NODE_ENV !== "production") {
    global.__sqlite__ = sqlite;
    global.__drizzle__ = instance;
  }
  cached = instance;
  return instance;
}

/**
 * Behaves exactly like a drizzle instance at every call site (`db.select()...`),
 * but defers the actual connection until the first property access.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(connect() as object, prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(connect() as object, prop);
  },
});

/** Escape hatch for raw SQL / maintenance scripts. */
export function getSqlite(): Database.Database {
  connect();
  return global.__sqlite__ ?? new Database(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.db"));
}
