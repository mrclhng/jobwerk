import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createApplication } from "~/services/applications.server";
import { setupTestDb } from "~/test/db";
import { createMcpServer } from "./server.server";

const t = setupTestDb();
let client: Client;

beforeEach(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createMcpServer(t.db).connect(serverTransport);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0]!.text;
  return { isError: result.isError ?? false, text, data: result.isError ? undefined : JSON.parse(text) };
}

describe("MCP-Server", () => {
  it("bietet die sechs Tools an", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "add_suggestion",
      "get_application",
      "list_applications",
      "list_rejection_reasons",
      "move_application",
      "update_application",
    ]);
    const add = tools.find((tool) => tool.name === "add_suggestion")!;
    expect(add.inputSchema.required).toEqual(["firma", "stelle"]);
  });

  it("trägt Vorschläge ein und erkennt Duplikate", async () => {
    const first = await call("add_suggestion", {
      firma: "Beispiel AG",
      stelle: "TypeScript Dev",
      link: "https://jobs.example.com/1",
      quelle: "Indeed",
    });
    expect(first.data).toMatchObject({ created: true, application: { status: "Vorschlag" } });

    const dup = await call("add_suggestion", {
      firma: "Andere",
      stelle: "X",
      link: "https://jobs.example.com/1/",
    });
    expect(dup.data).toMatchObject({ created: false, existing: { id: first.data.application.id } });
  });

  it("filtert die Liste nach Status", async () => {
    await createApplication(t.db, { firma: "A", status: "Vorschlag" });
    await createApplication(t.db, { firma: "B", status: "Interview" });
    const { data } = await call("list_applications", { status: "Interview" });
    expect(data.map((a: { firma: string }) => a.firma)).toEqual(["B"]);
  });

  it("ändert Status mit Board-Regeln und liefert Ablehnungsgründe", async () => {
    const app = await createApplication(t.db, { firma: "A", stelle: "Dev", status: "Vorschlag" });
    const moved = await call("move_application", { id: app.id, status: "Verworfen", grund: "nur vor Ort" });
    expect(moved.data).toMatchObject({ changed: true, application: { status: "Verworfen" } });

    const { data } = await call("list_rejection_reasons");
    expect(data).toEqual([expect.objectContaining({ firma: "A", grund: "nur vor Ort" })]);
  });

  it("aktualisiert Felder und meldet Fehler verständlich", async () => {
    const app = await createApplication(t.db, { firma: "A" });
    const updated = await call("update_application", { id: app.id, patch: { notizen: "Rückruf Freitag" } });
    expect(updated.data).toMatchObject({ id: app.id, notizen: "Rückruf Freitag" });

    const bad = await call("update_application", { id: app.id, patch: { beworbenAm: "morgen" } });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("beworbenAm");

    const missing = await call("get_application", { id: "gibt-es-nicht" });
    expect(missing).toMatchObject({ isError: true, text: expect.stringContaining("nicht gefunden") });
  });

  it("verbietet Statuswechsel über update_application", async () => {
    const app = await createApplication(t.db, { firma: "A" });
    const result = await call("update_application", { id: app.id, patch: { status: "Angebot" } });
    expect(result.isError).toBe(true);
  });
});
