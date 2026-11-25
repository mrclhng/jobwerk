/**
 * Status-Modell des Boards.
 *
 * Die fünf Board-Spalten bilden den Bewerbungs-Funnel ab; die Archiv-Status
 * sind Endzustände, aus denen eine Karte per "Zurückholen" wieder aufs Board kann.
 */
export const BOARD_STATUSES = ["Vorschlag", "Interessant", "Beworben", "Interview", "Angebot"] as const;

export const ARCHIVE_STATUSES = ["Absage", "Verworfen", "Zurückgezogen", "Stelle geschlossen"] as const;

export const STATUSES = [...BOARD_STATUSES, ...ARCHIVE_STATUSES] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];
export type Status = (typeof STATUSES)[number];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isBoardStatus(value: unknown): value is BoardStatus {
  return typeof value === "string" && (BOARD_STATUSES as readonly string[]).includes(value);
}

export function isArchiveStatus(value: unknown): value is ArchiveStatus {
  return typeof value === "string" && (ARCHIVE_STATUSES as readonly string[]).includes(value);
}

/** Nachbar-Spalte für die Pfeil-Buttons; `null`, wenn es in die Richtung nicht weitergeht. */
export function neighbourColumn(status: BoardStatus, direction: -1 | 1): BoardStatus | null {
  const next = BOARD_STATUSES[BOARD_STATUSES.indexOf(status) + direction];
  return next ?? null;
}
