import { describe, expect, it } from "vitest";
import { compareForColumn, FOLLOW_UP_HINT, isFollowUpDue, planMove, restoreTarget } from "./rules";

const today = "2026-11-25";
const base = { status: "Interessant" as const, beworbenAm: null, faelligAm: null, naechster: null };

describe("planMove", () => {
  it("gibt null zurück, wenn sich der Status nicht ändert", () => {
    expect(planMove(base, "Interessant", { today })).toBeNull();
  });

  it("setzt beim ersten Wechsel nach Beworben Datum, Nachfass-Termin und nächsten Schritt", () => {
    expect(planMove(base, "Beworben", { today })).toEqual({
      status: "Beworben",
      beworbenAm: "2026-11-25",
      faelligAm: "2026-12-09",
      naechster: FOLLOW_UP_HINT,
      vorherStatus: null,
    });
  });

  it("überschreibt vorhandene Daten beim Wechsel nach Beworben nicht", () => {
    const patch = planMove(
      { ...base, beworbenAm: "2026-11-01", faelligAm: "2026-11-10", naechster: "Anrufen" },
      "Beworben",
      { today },
    );
    expect(patch).toEqual({ status: "Beworben", vorherStatus: null });
  });

  it("lässt einen vorhandenen Nachfass-Termin samt nächstem Schritt stehen", () => {
    const patch = planMove({ ...base, faelligAm: "2026-12-01" }, "Beworben", { today });
    expect(patch).toEqual({ status: "Beworben", beworbenAm: today, vorherStatus: null });
  });

  it("merkt sich beim Archivieren den bisherigen Board-Status", () => {
    expect(planMove({ ...base, status: "Interview" }, "Absage", { today })).toEqual({
      status: "Absage",
      vorherStatus: "Interview",
    });
  });

  it("speichert beim Verwerfen den Grund (getrimmt, leer → null)", () => {
    const status = "Vorschlag" as const;
    expect(planMove({ ...base, status }, "Verworfen", { today, grund: "  nur vor Ort " })).toEqual({
      status: "Verworfen",
      vorherStatus: "Vorschlag",
      grund: "nur vor Ort",
    });
    expect(planMove({ ...base, status }, "Verworfen", { today, grund: "  " })?.grund).toBeNull();
  });

  it("behält den Board-Status bei einem Wechsel innerhalb des Archivs", () => {
    const patch = planMove({ ...base, status: "Absage" }, "Stelle geschlossen", { today });
    expect(patch).toEqual({ status: "Stelle geschlossen" });
  });

  it("löscht den gemerkten Status beim Zurückholen", () => {
    const patch = planMove({ ...base, status: "Absage" }, "Beworben", { today });
    expect(patch?.vorherStatus).toBeNull();
  });
});

describe("restoreTarget", () => {
  it("holt in die vorherige Spalte zurück", () => {
    expect(restoreTarget({ vorherStatus: "Interview" })).toBe("Interview");
  });
  it("fällt ohne gültigen Vorher-Status auf Interessant zurück", () => {
    expect(restoreTarget({ vorherStatus: null })).toBe("Interessant");
    expect(restoreTarget({ vorherStatus: "Absage" })).toBe("Interessant");
  });
});

describe("isFollowUpDue", () => {
  it("ist fällig, wenn der Termin heute oder früher ist", () => {
    expect(isFollowUpDue({ status: "Beworben", faelligAm: today, beworbenAm: null }, today)).toBe(true);
    expect(isFollowUpDue({ status: "Interview", faelligAm: "2026-11-20", beworbenAm: null }, today)).toBe(
      true,
    );
    expect(isFollowUpDue({ status: "Beworben", faelligAm: "2026-11-26", beworbenAm: null }, today)).toBe(
      false,
    );
  });

  it("ist ohne Termin ab 14 Tagen nach der Bewerbung fällig", () => {
    expect(isFollowUpDue({ status: "Beworben", faelligAm: null, beworbenAm: "2026-11-11" }, today)).toBe(
      true,
    );
    expect(isFollowUpDue({ status: "Beworben", faelligAm: null, beworbenAm: "2026-11-12" }, today)).toBe(
      false,
    );
  });

  it("gilt die 14-Tage-Regel nur für Beworben", () => {
    expect(isFollowUpDue({ status: "Interview", faelligAm: null, beworbenAm: "2026-10-01" }, today)).toBe(
      false,
    );
  });

  it("ist im Archiv nie fällig", () => {
    expect(isFollowUpDue({ status: "Absage", faelligAm: "2026-01-01", beworbenAm: null }, today)).toBe(false);
  });
});

describe("compareForColumn", () => {
  it("sortiert fällige Karten zuerst, dann die neuesten", () => {
    const mk = (id: string, beworbenAm: string | null, faelligAm: string | null = null) => ({
      id,
      status: "Beworben" as const,
      beworbenAm,
      faelligAm,
      erstellt: new Date("2026-11-01T10:00:00Z"),
    });
    const items = [
      mk("alt", "2026-11-15"),
      mk("neu", "2026-11-20"),
      mk("faellig", "2026-11-01", "2026-11-24"),
    ];
    expect(items.sort(compareForColumn(today)).map((i) => i.id)).toEqual(["faellig", "neu", "alt"]);
  });
});
