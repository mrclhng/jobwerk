import { z } from "zod";
import { isIsoDate, type IsoDate } from "./dates";
import { STATUSES, type Status } from "./status";

/** Eine Bewerbung, wie sie Domäne, Board und MCP-Server sehen. */
export interface Application {
  id: string;
  firma: string;
  stelle: string;
  link: string | null;
  ort: string | null;
  status: Status;
  vorherStatus: Status | null;
  grund: string | null;
  beworbenAm: IsoDate | null;
  faelligAm: IsoDate | null;
  naechster: string | null;
  cv: string | null;
  gehalt: string | null;
  kontakt: string | null;
  quelle: string | null;
  remoteRegel: string | null;
  einschaetzung: string | null;
  notizen: string | null;
  erstellt: Date;
  aktualisiert: Date;
}

/** Leere Strings werden zu `null` – so bleibt "nicht gesetzt" eindeutig. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), { message: "Datum im Format JJJJ-MM-TT erwartet" });

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^https?:\/\//i.test(v), {
    message: "Link muss mit http:// oder https:// beginnen",
  });

export const statusSchema = z.enum(STATUSES);

/** Alle editierbaren Felder ohne Defaults (Basis für Anlegen und Teil-Update). */
const editableFields = z.object({
  firma: z.string().trim().min(1, "Firma fehlt").max(200),
  stelle: z.string().trim().max(300),
  link: optionalUrl,
  ort: optionalText(200),
  status: statusSchema,
  beworbenAm: optionalDate,
  faelligAm: optionalDate,
  naechster: optionalText(500),
  cv: optionalText(100),
  gehalt: optionalText(200),
  kontakt: optionalText(500),
  quelle: optionalText(100),
  remoteRegel: optionalText(1000),
  einschaetzung: optionalText(2000),
  notizen: optionalText(10_000),
  grund: optionalText(1000),
});

/** Felder beim Anlegen bzw. vollständigen Speichern aus dem Editor. */
export const applicationFieldsSchema = editableFields.extend({
  stelle: editableFields.shape.stelle.default(""),
  status: statusSchema.default("Interessant"),
});

export type ApplicationFields = z.output<typeof applicationFieldsSchema>;
export type ApplicationFieldsInput = z.input<typeof applicationFieldsSchema>;

/**
 * Teil-Update: nur übergebene Felder werden geändert. Der Status ist hier bewusst
 * ausgenommen – Statuswechsel laufen über `planMove`, damit die Regeln greifen.
 */
export const applicationPatchSchema = editableFields.omit({ status: true }).partial().strict();

export type ApplicationPatch = z.output<typeof applicationPatchSchema>;

/** Eingabe für Vorschläge der täglichen Suche (MCP `add_suggestion`). */
export const suggestionSchema = z.object({
  firma: z.string().trim().min(1).max(200),
  stelle: z.string().trim().min(1).max(300),
  link: optionalUrl,
  ort: optionalText(200),
  quelle: optionalText(100),
  remoteRegel: optionalText(1000),
  einschaetzung: optionalText(2000),
  gehalt: optionalText(200),
});

export type SuggestionInput = z.input<typeof suggestionSchema>;

/**
 * Sprechende, stabile ID aus Firma und Stelle, z. B. `beispiel-ag-senior-java-entwickler`.
 * Umlaute werden transkribiert, alles andere auf [a-z0-9-] reduziert.
 */
export function slugify(...parts: string[]): string {
  const slug = parts
    .join(" ")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "bewerbung";
}

/** Normalisierung für die Duplikat-Erkennung (Link ohne Query/Fragment/Slash). */
export function normalizeLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link.trim());
    url.hash = "";
    url.search = "";
    const host = url.host.toLowerCase().replace(/^www\./, "");
    return `${host}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return link.trim().toLowerCase();
  }
}

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

const nullableDate = z
  .string()
  .nullable()
  .refine((v) => v === null || isIsoDate(v), { message: "Datum im Format JJJJ-MM-TT erwartet" });

/** Gemerkter Zustand vor einem Statuswechsel (für "Rückgängig"). */
export const moveSnapshotSchema = z
  .object({
    status: statusSchema,
    vorherStatus: statusSchema.nullable(),
    grund: z.string().max(1000).nullable(),
    beworbenAm: nullableDate,
    faelligAm: nullableDate,
    naechster: z.string().max(500).nullable(),
  })
  .strict();
