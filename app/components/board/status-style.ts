import type { Status } from "~/domain/status";

/** Spaltenfarbe (Punkt im Spaltenkopf) je Board-Status – wie im alten Tracker. */
export const COLUMN_DOT: Record<string, string> = {
  Vorschlag: "bg-warn",
  Interessant: "bg-neutral",
  Beworben: "bg-blue",
  Interview: "bg-violet",
  Angebot: "bg-green",
};

export function archivePillClass(status: Status): string {
  return status === "Absage" ? "bg-red-bg text-red" : "bg-neutral-bg text-neutral";
}

export const EMPTY_COLUMN_TEXT: Record<string, string> = {
  Vorschlag: "Neue Vorschläge der täglichen Suche landen hier.",
};
