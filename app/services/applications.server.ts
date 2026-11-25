import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "~/db/client.server";
import { applications } from "~/db/schema";
import {
  applicationFieldsSchema,
  applicationPatchSchema,
  normalizeLink,
  normalizeName,
  slugify,
  suggestionSchema,
  type Application,
  type ApplicationFieldsInput,
  type SuggestionInput,
} from "~/domain/application";
import { todayIso } from "~/domain/dates";
import { MOVE_FIELDS, planMove, snapshotMoveFields, type MoveFields } from "~/domain/rules";
import type { Status } from "~/domain/status";

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Bewerbung "${id}" nicht gefunden`);
    this.name = "NotFoundError";
  }
}

export async function listApplications(db: Db, filter: { status?: Status } = {}): Promise<Application[]> {
  return db
    .select()
    .from(applications)
    .where(filter.status ? eq(applications.status, filter.status) : undefined)
    .orderBy(desc(applications.aktualisiert), asc(applications.id));
}

export async function getApplication(db: Db, id: string): Promise<Application | null> {
  const [row] = await db.select().from(applications).where(eq(applications.id, id));
  return row ?? null;
}

async function requireApplication(db: Db, id: string): Promise<Application> {
  const app = await getApplication(db, id);
  if (!app) throw new NotFoundError(id);
  return app;
}

/** Freie ID aus Firma + Stelle; bei Kollision mit Suffix `-2`, `-3`, … */
async function uniqueId(db: Db, firma: string, stelle: string): Promise<string> {
  const base = slugify(firma, stelle);
  const taken = await db
    .select({ id: applications.id })
    .from(applications)
    .where(sql`${applications.id} = ${base} or ${applications.id} like ${`${base}-%`}`);
  const ids = new Set(taken.map((r) => r.id));
  if (!ids.has(base)) return base;
  for (let n = 2; ; n++) if (!ids.has(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createApplication(db: Db, input: ApplicationFieldsInput): Promise<Application> {
  const fields = applicationFieldsSchema.parse(input);
  const id = await uniqueId(db, fields.firma, fields.stelle);
  const [row] = await db
    .insert(applications)
    .values({ id, ...fields })
    .returning();
  return row!;
}

/** Ändert Felder (ohne Status). Unbekannte Felder oder ungültige Werte werfen einen ZodError. */
export async function updateApplication(db: Db, id: string, patch: unknown): Promise<Application> {
  const fields = applicationPatchSchema.parse(patch);
  if (Object.keys(fields).length === 0) return requireApplication(db, id);
  const [row] = await db.update(applications).set(fields).where(eq(applications.id, id)).returning();
  if (!row) throw new NotFoundError(id);
  return row;
}

export interface MoveResult {
  application: Application;
  /** Zustand vor dem Wechsel – für "Rückgängig". `null`, wenn sich nichts geändert hat. */
  previous: MoveFields | null;
}

/** Statuswechsel nach den Board-Regeln (siehe `planMove`). */
export async function moveApplication(
  db: Db,
  id: string,
  target: Status,
  options: { grund?: string | null; today?: string } = {},
): Promise<MoveResult> {
  const current = await requireApplication(db, id);
  const patch = planMove(current, target, { grund: options.grund, today: options.today ?? todayIso() });
  if (!patch) return { application: current, previous: null };
  const [row] = await db
    .update(applications)
    .set(patch)
    // Optimistische Sperre: nur wechseln, wenn niemand zwischendurch den Status geändert hat
    .where(and(eq(applications.id, id), eq(applications.status, current.status)))
    .returning();
  if (!row) throw new Error("Die Bewerbung wurde zwischenzeitlich geändert – bitte neu laden.");
  return { application: row, previous: snapshotMoveFields(current) };
}

/** Macht einen Statuswechsel rückgängig, indem die gemerkten Felder zurückgeschrieben werden. */
export async function revertMove(db: Db, id: string, previous: MoveFields): Promise<Application> {
  const values = Object.fromEntries(MOVE_FIELDS.map((k) => [k, previous[k]])) as MoveFields;
  const [row] = await db.update(applications).set(values).where(eq(applications.id, id)).returning();
  if (!row) throw new NotFoundError(id);
  return row;
}

export type AddSuggestionResult =
  | { created: true; application: Application }
  | { created: false; duplicate: Application; reason: "link" | "firma+stelle" };

/**
 * Legt einen Vorschlag an – außer es gibt schon eine Bewerbung mit gleichem Link
 * oder gleicher Firma + Stelle (egal in welchem Status, auch im Archiv).
 */
export async function addSuggestion(db: Db, input: SuggestionInput): Promise<AddSuggestionResult> {
  const s = suggestionSchema.parse(input);
  const link = normalizeLink(s.link);

  const candidates = await db
    .select()
    .from(applications)
    .where(
      sql`(lower(${applications.firma}) = ${normalizeName(s.firma)} and lower(${applications.stelle}) = ${normalizeName(s.stelle)})
          or ${applications.link} is not null`,
    );

  for (const c of candidates) {
    if (link && normalizeLink(c.link) === link) return { created: false, duplicate: c, reason: "link" };
  }
  for (const c of candidates) {
    if (
      normalizeName(c.firma) === normalizeName(s.firma) &&
      normalizeName(c.stelle) === normalizeName(s.stelle)
    ) {
      return { created: false, duplicate: c, reason: "firma+stelle" };
    }
  }

  const application = await createApplication(db, { ...s, status: "Vorschlag" });
  return { created: true, application };
}

export interface RejectionReason {
  id: string;
  firma: string;
  stelle: string;
  grund: string;
  datum: string;
}

/** Gründe verworfener Vorschläge – Präferenz-Signal für die tägliche Suche. */
export async function listRejectionReasons(db: Db): Promise<RejectionReason[]> {
  const rows = await db
    .select({
      id: applications.id,
      firma: applications.firma,
      stelle: applications.stelle,
      grund: applications.grund,
      aktualisiert: applications.aktualisiert,
    })
    .from(applications)
    .where(and(eq(applications.status, "Verworfen"), isNotNull(applications.grund)))
    .orderBy(desc(applications.aktualisiert));
  return rows.map(({ aktualisiert, grund, ...r }) => ({
    ...r,
    grund: grund!,
    datum: aktualisiert.toISOString().slice(0, 10),
  }));
}
