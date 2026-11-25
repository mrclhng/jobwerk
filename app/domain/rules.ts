import type { Application } from "./application";
import { addDays, daysBetween, type IsoDate } from "./dates";
import { isArchiveStatus, isBoardStatus, type BoardStatus, type Status } from "./status";

/** Nach so vielen Tagen ohne Rückmeldung wird Nachfassen fällig. */
export const FOLLOW_UP_DAYS = 14;
export const FOLLOW_UP_HINT = "Nachfassen, falls keine Rückmeldung";

/** Felder, die ein Statuswechsel verändern kann – und die ein Undo zurücksetzt. */
export const MOVE_FIELDS = [
  "status",
  "vorherStatus",
  "grund",
  "beworbenAm",
  "faelligAm",
  "naechster",
] as const;

export type MoveFields = Pick<Application, (typeof MOVE_FIELDS)[number]>;
export type MovePatch = Partial<MoveFields> & Pick<MoveFields, "status">;

export interface MoveOptions {
  /** Grund beim Verwerfen eines Vorschlags. */
  grund?: string | null;
  today: IsoDate;
}

/**
 * Berechnet die Feldänderungen für einen Statuswechsel – dieselben Regeln für
 * Board und MCP-Server:
 *
 * - Erster Wechsel nach "Beworben": Bewerbungsdatum = heute, Nachfass-Termin in
 *   14 Tagen und passender nächster Schritt (jeweils nur, wenn noch leer).
 * - Wechsel ins Archiv merkt sich den bisherigen Status (für "Zurückholen").
 * - "Verworfen" speichert den optionalen Grund als Präferenz-Signal.
 * - Zurück aufs Board löscht den gemerkten Archiv-Status.
 *
 * Gibt `null` zurück, wenn sich nichts ändert.
 */
export function planMove(
  current: Pick<Application, "status" | "beworbenAm" | "faelligAm" | "naechster">,
  target: Status,
  { grund, today }: MoveOptions,
): MovePatch | null {
  if (current.status === target) return null;

  const patch: MovePatch = { status: target };

  if (target === "Beworben" && !current.beworbenAm) {
    patch.beworbenAm = today;
    if (!current.faelligAm) {
      patch.faelligAm = addDays(today, FOLLOW_UP_DAYS);
      if (!current.naechster) patch.naechster = FOLLOW_UP_HINT;
    }
  }

  if (isArchiveStatus(target)) {
    // Archiv → Archiv (z. B. Absage → Stelle geschlossen) behält den Board-Status.
    if (isBoardStatus(current.status)) patch.vorherStatus = current.status;
    if (target === "Verworfen") patch.grund = grund?.trim() || null;
  } else {
    patch.vorherStatus = null;
  }

  return patch;
}

/** Ziel-Spalte für "Zurückholen" aus dem Archiv. */
export function restoreTarget(app: Pick<Application, "vorherStatus">): BoardStatus {
  return isBoardStatus(app.vorherStatus) ? app.vorherStatus : "Interessant";
}

/** Momentaufnahme der Felder, die `planMove` ändern kann – Grundlage für Undo. */
export function snapshotMoveFields(app: MoveFields): MoveFields {
  return {
    status: app.status,
    vorherStatus: app.vorherStatus,
    grund: app.grund,
    beworbenAm: app.beworbenAm,
    faelligAm: app.faelligAm,
    naechster: app.naechster,
  };
}

/**
 * "Nachfassen fällig": nur für Karten auf dem Board – wenn der Termin erreicht ist,
 * oder (ohne Termin) wenn die Bewerbung mindestens 14 Tage her ist.
 */
export function isFollowUpDue(
  app: Pick<Application, "status" | "faelligAm" | "beworbenAm">,
  today: IsoDate,
): boolean {
  if (!isBoardStatus(app.status)) return false;
  if (app.faelligAm) return app.faelligAm <= today;
  if (app.status !== "Beworben" || !app.beworbenAm) return false;
  return daysBetween(app.beworbenAm, today) >= FOLLOW_UP_DAYS;
}

/** Sortierung innerhalb einer Spalte: fällige zuerst, dann neueste zuerst. */
export function compareForColumn(today: IsoDate) {
  return (
    a: Pick<Application, "status" | "faelligAm" | "beworbenAm" | "erstellt">,
    b: Pick<Application, "status" | "faelligAm" | "beworbenAm" | "erstellt">,
  ): number => {
    const dueA = isFollowUpDue(a, today) ? 0 : 1;
    const dueB = isFollowUpDue(b, today) ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    const keyA = a.beworbenAm ?? a.erstellt.toISOString();
    const keyB = b.beworbenAm ?? b.erstellt.toISOString();
    return keyB.localeCompare(keyA);
  };
}
