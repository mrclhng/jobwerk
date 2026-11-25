import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDateDe, isIsoDate, todayIso } from "./dates";

describe("dates", () => {
  it("rechnet über Monats- und Sommerzeitgrenzen", () => {
    expect(addDays("2026-03-20", 14)).toBe("2026-04-03");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
    expect(daysBetween("2026-10-20", "2026-11-03")).toBe(14);
  });
  it("prüft ISO-Daten streng", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("28.02.2026")).toBe(false);
  });
  it("bestimmt 'heute' in Berliner Zeit", () => {
    // 23:30 UTC am 24.11. ist in Berlin schon der 25.11.
    expect(todayIso(new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-25");
  });
  it("formatiert deutsch", () => {
    expect(formatDateDe("2026-11-05")).toBe("05.11.2026");
    expect(formatDateDe(null)).toBe("");
  });
});
