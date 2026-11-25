import { describe, expect, it } from "vitest";
import { mapLegacyRecord } from "./seed-mapping";

// Erfundene Beispieldaten – echte Seed-Daten gehören nie ins Repo.
const legacy = {
  id: "beispiel-ag-backend",
  firma: "Beispiel AG",
  stelle: "Backend-Entwickler (m/w/d)",
  link: "https://jobs.example.com/123",
  ort: "Remote",
  status: "Beworben",
  beworbenAm: "2026-11-11",
  faelligAm: "",
  naechster: "",
  cv: "v3",
  gehalt: "",
  kontakt: "Erika Mustermann",
  notizen: "",
  erstellt: "2026-11-11T15:00:00.000Z",
  aktualisiert: "2026-11-24T12:29:13.101Z",
};

describe("mapLegacyRecord", () => {
  it("übernimmt Felder, wandelt Leerstrings in null und parst Zeitstempel", () => {
    expect(mapLegacyRecord(legacy)).toEqual({
      id: "beispiel-ag-backend",
      firma: "Beispiel AG",
      stelle: "Backend-Entwickler (m/w/d)",
      link: "https://jobs.example.com/123",
      ort: "Remote",
      status: "Beworben",
      vorherStatus: null,
      grund: null,
      beworbenAm: "2026-11-11",
      faelligAm: null,
      naechster: null,
      cv: "v3",
      gehalt: null,
      kontakt: "Erika Mustermann",
      quelle: null,
      remoteRegel: null,
      einschaetzung: null,
      notizen: null,
      erstellt: new Date("2026-11-11T15:00:00.000Z"),
      aktualisiert: new Date("2026-11-24T12:29:13.101Z"),
    });
  });

  it("übernimmt Archiv-Status samt Vorher-Status", () => {
    const row = mapLegacyRecord({ ...legacy, status: "Absage", vorherStatus: "Interview" });
    expect(row).toMatchObject({ status: "Absage", vorherStatus: "Interview" });
  });

  it("lehnt unbekannte Status und kaputte Daten ab", () => {
    expect(() => mapLegacyRecord({ ...legacy, status: "Irgendwas" })).toThrow();
    expect(() => mapLegacyRecord({ ...legacy, beworbenAm: "11.11.2026" })).toThrow(/kein gültiges Datum/);
  });
});
