/**
 * Kalenderdaten werden durchgängig als ISO-Strings `YYYY-MM-DD` behandelt
 * (so speichert sie auch Postgres als `date`). Gerechnet wird in UTC, damit
 * Sommerzeit-Wechsel keine Off-by-one-Fehler erzeugen.
 */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Heutiges Datum in der angegebenen Zeitzone (Default: Europe/Berlin). */
export function todayIso(now: Date = new Date(), timeZone = "Europe/Berlin"): IsoDate {
  // en-CA formatiert als YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ganze Tage von `from` bis `to` (positiv, wenn `from` in der Vergangenheit liegt). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatDateDe(date: IsoDate | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}
