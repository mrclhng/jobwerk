/**
 * Einmaliger Import der Daten aus dem alten Tracker.
 *
 *   npm run db:seed                      # liest seed/bewerbungen.json
 *   npm run db:seed -- pfad/zur/datei.json --overwrite
 *
 * Bestehende IDs werden übersprungen, mit --overwrite ersetzt.
 * Die Seed-Datei enthält personenbezogene Daten und liegt deshalb in seed/ (gitignored).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getDb } from "~/db/client.server";
import { applications } from "~/db/schema";
import { mapLegacyRecord } from "./seed-mapping";

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const file = args.find((a) => !a.startsWith("--")) ?? "seed/bewerbungen.json";

const raw: unknown = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(raw)) throw new Error(`${file}: Array von Bewerbungen erwartet`);

const rows = raw.map((r) => mapLegacyRecord(r));
const db = getDb();

let written = 0;
for (const row of rows) {
  const { id: _id, ...rest } = row;
  const query = db.insert(applications).values(row);
  const result = await (
    overwrite ? query.onConflictDoUpdate({ target: applications.id, set: rest }) : query.onConflictDoNothing()
  ).returning({ id: applications.id });
  written += result.length;
}

console.log(`${rows.length} Datensätze gelesen, ${written} ${overwrite ? "geschrieben" : "neu angelegt"}.`);
