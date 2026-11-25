import { z } from "zod";
import type { NewApplicationRow } from "~/db/schema";
import { applicationFieldsSchema } from "~/domain/application";
import { isIsoDate } from "~/domain/dates";
import { statusSchema } from "~/domain/application";

/**
 * Ein Datensatz aus dem Export des alten Trackers (claude.ai-Artifact).
 * Dort sind alle Felder Strings; "nicht gesetzt" ist meist "".
 */
const legacyRecordSchema = z
  .object({
    id: z.string().min(1),
    firma: z.string(),
    stelle: z.string().optional(),
    status: z.string(),
    vorherStatus: z.string().optional(),
    erstellt: z.string().optional(),
    aktualisiert: z.string().optional(),
  })
  .passthrough();

function parseTimestamp(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** Wandelt einen Alt-Datensatz in eine Tabellenzeile um. Wirft bei ungültigen Daten. */
export function mapLegacyRecord(raw: unknown, now = new Date()): NewApplicationRow {
  const rec = legacyRecordSchema.parse(raw);
  const { id, erstellt, aktualisiert, vorherStatus, ...rest } = rec;

  // Ungültige Datumsangaben nicht still übernehmen, sondern als Fehler melden
  for (const key of ["beworbenAm", "faelligAm"] as const) {
    const v = rest[key];
    if (typeof v === "string" && v !== "" && !isIsoDate(v)) {
      throw new Error(`${id}: ${key} "${v}" ist kein gültiges Datum`);
    }
  }

  const fields = applicationFieldsSchema.parse(rest);
  const created = parseTimestamp(erstellt, now);
  return {
    id,
    ...fields,
    vorherStatus: vorherStatus ? statusSchema.parse(vorherStatus) : null,
    erstellt: created,
    aktualisiert: parseTimestamp(aktualisiert, created),
  };
}
