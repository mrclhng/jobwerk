import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "../app/db/schema";
import { e2eEnv } from "./env";

/** Erfundene Testdaten – echte Bewerbungsdaten gehören nie ins Repo. */
export const FIXTURES: schema.NewApplicationRow[] = [
  {
    id: "beispiel-ag-typescript",
    firma: "Beispiel AG",
    stelle: "TypeScript-Entwickler (m/w/d)",
    link: "https://jobs.example.com/beispiel-ag",
    ort: "Remote",
    status: "Vorschlag",
    quelle: "Indeed",
    einschaetzung: "Passt gut: React + Node.",
  },
  {
    id: "muster-gmbh-backend",
    firma: "Muster GmbH",
    stelle: "Backend Java",
    ort: "Köln",
    status: "Interessant",
  },
  {
    id: "demo-kg-fullstack",
    firma: "Demo KG",
    stelle: "Fullstack",
    status: "Beworben",
    beworbenAm: "2026-01-05",
    faelligAm: "2026-01-19",
    naechster: "Nachfassen",
  },
  { id: "archiv-se-dev", firma: "Archiv SE", stelle: "Dev", status: "Absage", vorherStatus: "Interview" },
];

export async function withE2eDb<T>(
  fn: (db: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>,
): Promise<T> {
  const pool = new pg.Pool({ connectionString: e2eEnv.DATABASE_URL });
  try {
    return await fn(drizzle(pool, { schema }));
  } finally {
    await pool.end();
  }
}

/** Migriert die E2E-Datenbank und setzt die Bewerbungen auf die Fixtures zurück. */
export async function resetApplications() {
  await withE2eDb(async (db) => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.execute(sql`truncate table applications`);
    await db.insert(schema.applications).values(FIXTURES);
  });
}
