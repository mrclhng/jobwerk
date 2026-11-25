import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach } from "vitest";
import type { Db } from "~/db/client.server";
import * as schema from "~/db/schema";

/**
 * In-Memory-Postgres (PGlite) mit allen Migrationen – eine Instanz pro Testdatei,
 * vor jedem Test geleert. Echtes SQL statt Mocks, ohne externe Datenbank.
 */
export function setupTestDb(): { readonly db: Db } {
  let client: PGlite;
  const ctx = {} as { db: Db };

  beforeAll(async () => {
    client = new PGlite();
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    ctx.db = db as unknown as Db;
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table applications, api_tokens, session, account, verification, "user" cascade`,
    );
  });

  afterAll(async () => {
    await client.close();
  });

  return ctx;
}
