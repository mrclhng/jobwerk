import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema";

/**
 * Treiber-unabhängiger DB-Typ: Produktion nutzt Neon (HTTP), lokal/E2E node-postgres,
 * Unit-Tests PGlite. Services nehmen diesen Typ entgegen und bleiben ohne Mocks testbar.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

/** Neon-Hosts über den HTTP-Treiber (ideal für Serverless), alles andere per TCP. */
export function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL ist nicht gesetzt");
    const db = isNeonUrl(url)
      ? drizzleNeon(neon(url), { schema })
      : drizzlePg(new pg.Pool({ connectionString: url, max: 5 }), { schema });
    cached = db as unknown as Db;
  }
  return cached;
}
