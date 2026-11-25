import { describe, expect, it } from "vitest";
import { setupTestDb } from "~/test/db";
import {
  addSuggestion,
  createApplication,
  getApplication,
  listApplications,
  listRejectionReasons,
  moveApplication,
  NotFoundError,
  revertMove,
  updateApplication,
} from "./applications.server";

const t = setupTestDb();

describe("createApplication", () => {
  it("vergibt sprechende, eindeutige IDs", async () => {
    const a = await createApplication(t.db, { firma: "ACME GmbH", stelle: "Java Dev" });
    const b = await createApplication(t.db, { firma: "ACME GmbH", stelle: "Java Dev" });
    const c = await createApplication(t.db, { firma: "ACME GmbH", stelle: "Java Dev" });
    expect([a.id, b.id, c.id]).toEqual([
      "acme-gmbh-java-dev",
      "acme-gmbh-java-dev-2",
      "acme-gmbh-java-dev-3",
    ]);
    expect(a.status).toBe("Interessant");
    expect(a.erstellt).toBeInstanceOf(Date);
  });
});

describe("listApplications", () => {
  it("filtert nach Status", async () => {
    await createApplication(t.db, { firma: "A", status: "Vorschlag" });
    await createApplication(t.db, { firma: "B", status: "Beworben" });
    expect((await listApplications(t.db)).length).toBe(2);
    expect((await listApplications(t.db, { status: "Vorschlag" })).map((a) => a.firma)).toEqual(["A"]);
  });
});

describe("updateApplication", () => {
  it("ändert nur übergebene Felder", async () => {
    const a = await createApplication(t.db, { firma: "A", stelle: "Dev", ort: "Köln" });
    const updated = await updateApplication(t.db, a.id, { notizen: "Gespräch lief gut", ort: "" });
    expect(updated).toMatchObject({ stelle: "Dev", notizen: "Gespräch lief gut", ort: null });
    expect(updated.aktualisiert.getTime()).toBeGreaterThanOrEqual(a.aktualisiert.getTime());
  });

  it("lehnt Statusänderungen und unbekannte IDs ab", async () => {
    const a = await createApplication(t.db, { firma: "A" });
    await expect(updateApplication(t.db, a.id, { status: "Angebot" })).rejects.toThrow();
    await expect(updateApplication(t.db, "gibt-es-nicht", { notizen: "x" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("moveApplication / revertMove", () => {
  it("wendet die Board-Regeln an und lässt sich rückgängig machen", async () => {
    const a = await createApplication(t.db, { firma: "A", stelle: "Dev" });
    const { application, previous } = await moveApplication(t.db, a.id, "Beworben", { today: "2026-11-25" });
    expect(application).toMatchObject({
      status: "Beworben",
      beworbenAm: "2026-11-25",
      faelligAm: "2026-12-09",
    });
    expect(previous).toMatchObject({ status: "Interessant", beworbenAm: null });

    const reverted = await revertMove(t.db, a.id, previous!);
    expect(reverted).toMatchObject({
      status: "Interessant",
      beworbenAm: null,
      faelligAm: null,
      naechster: null,
    });
  });

  it("meldet 'keine Änderung' beim gleichen Status", async () => {
    const a = await createApplication(t.db, { firma: "A" });
    expect((await moveApplication(t.db, a.id, "Interessant")).previous).toBeNull();
  });

  it("wirft NotFoundError für unbekannte IDs", async () => {
    await expect(moveApplication(t.db, "nope", "Absage")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("addSuggestion", () => {
  const suggestion = {
    firma: "Nordlicht Software",
    stelle: "Senior Fullstack",
    link: "https://www.example.com/jobs/42?utm_source=indeed",
    quelle: "Indeed",
  };

  it("legt einen Vorschlag an", async () => {
    const result = await addSuggestion(t.db, suggestion);
    expect(result.created).toBe(true);
    if (result.created) expect(result.application).toMatchObject({ status: "Vorschlag", quelle: "Indeed" });
  });

  it("erkennt Duplikate über den Link – auch im Archiv", async () => {
    const first = await addSuggestion(t.db, suggestion);
    if (!first.created) throw new Error("expected created");
    await moveApplication(t.db, first.application.id, "Verworfen", { grund: "zu weit weg" });

    const again = await addSuggestion(t.db, {
      ...suggestion,
      firma: "Nordlicht Software GmbH",
      link: "http://example.com/jobs/42/",
    });
    expect(again).toMatchObject({ created: false, reason: "link", duplicate: { id: first.application.id } });
  });

  it("erkennt Duplikate über Firma + Stelle (Groß-/Kleinschreibung egal)", async () => {
    await addSuggestion(t.db, suggestion);
    const again = await addSuggestion(t.db, { firma: "nordlicht software", stelle: "senior  fullstack" });
    expect(again).toMatchObject({ created: false, reason: "firma+stelle" });
  });
});

describe("listRejectionReasons", () => {
  it("liefert nur verworfene Einträge mit Grund", async () => {
    const a = await createApplication(t.db, { firma: "A", stelle: "Dev", status: "Vorschlag" });
    const b = await createApplication(t.db, { firma: "B", stelle: "Dev", status: "Vorschlag" });
    const c = await createApplication(t.db, { firma: "C", stelle: "Dev" });
    await moveApplication(t.db, a.id, "Verworfen", { grund: "nur Präsenz" });
    await moveApplication(t.db, b.id, "Verworfen");
    await moveApplication(t.db, c.id, "Absage");

    const reasons = await listRejectionReasons(t.db);
    expect(reasons).toEqual([
      {
        id: a.id,
        firma: "A",
        stelle: "Dev",
        grund: "nur Präsenz",
        datum: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    ]);
    expect(await getApplication(t.db, b.id)).toMatchObject({ status: "Verworfen", grund: null });
  });
});
