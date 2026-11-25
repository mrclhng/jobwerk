import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Db } from "~/db/client.server";
import type { Application } from "~/domain/application";
import { STATUSES } from "~/domain/status";
import {
  addSuggestion,
  getApplication,
  listApplications,
  listRejectionReasons,
  moveApplication,
  NotFoundError,
  updateApplication,
} from "~/services/applications.server";

/*
 * Die Eingabe-Schemas hier sind bewusst "flach" (nur Strings, keine Transforms), damit
 * sie sauber als JSON-Schema beim Client ankommen. Die eigentliche Validierung und
 * Normalisierung übernimmt die Domäne – dieselbe wie im Board.
 */
const text = (description: string) => z.string().describe(description);
const status = z.enum(STATUSES);

const patchShape = {
  firma: text("Firmenname"),
  stelle: text("Stellentitel"),
  link: text("Link zur Anzeige (http/https)"),
  ort: text("Ort bzw. Remote-Angabe"),
  beworbenAm: text("Bewerbungsdatum JJJJ-MM-TT"),
  faelligAm: text("Nachfass-Termin JJJJ-MM-TT"),
  naechster: text("Nächster Schritt"),
  cv: text("Verwendete Lebenslauf-Version"),
  gehalt: text("Genannte Gehaltsvorstellung / Spanne"),
  kontakt: text("Ansprechpartner"),
  quelle: text("Quelle, z. B. Indeed"),
  remoteRegel: text("Zitat der Remote-Regel aus der Anzeige"),
  einschaetzung: text("Kurze Passungs-Einschätzung"),
  notizen: text("Freie Notizen"),
};

/** Kompakte Darstellung für Listen – spart Tokens im Kontext des Modells. */
function summary(app: Application) {
  return {
    id: app.id,
    firma: app.firma,
    stelle: app.stelle,
    status: app.status,
    ort: app.ort,
    link: app.link,
    beworbenAm: app.beworbenAm,
    faelligAm: app.faelligAm,
    naechster: app.naechster,
  };
}

function detail(app: Application) {
  return { ...app, erstellt: app.erstellt.toISOString(), aktualisiert: app.aktualisiert.toISOString() };
}

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Führt einen Tool-Handler aus und wandelt erwartbare Fehler in lesbare Tool-Fehler um. */
async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof NotFoundError) return fail(error.message);
    if (error instanceof z.ZodError) {
      return fail(
        `Ungültige Eingabe: ${error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`,
      );
    }
    throw error;
  }
}

export function createMcpServer(db: Db): McpServer {
  const server = new McpServer(
    { name: "jobwerk", version: "0.1.0" },
    {
      instructions:
        "Jobwerk ist Marcels Bewerbungs-Board. Neue Stellen nur über add_suggestion eintragen (Status 'Vorschlag', " +
        "Duplikate werden erkannt). Vor neuen Vorschlägen list_rejection_reasons lesen, um ähnlich unpassende Stellen zu vermeiden. " +
        "Statuswechsel immer über move_application – dort greifen dieselben Regeln wie im Board.",
    },
  );

  server.registerTool(
    "list_applications",
    {
      title: "Bewerbungen auflisten",
      description: "Listet Bewerbungen (kompakt), optional gefiltert nach Status.",
      inputSchema: { status: status.optional().describe("Nur Bewerbungen mit diesem Status") },
      annotations: { readOnlyHint: true },
    },
    ({ status }) => run(async () => json((await listApplications(db, { status })).map(summary))),
  );

  server.registerTool(
    "get_application",
    {
      title: "Bewerbung abrufen",
      description: "Alle Felder einer Bewerbung.",
      inputSchema: { id: text("ID der Bewerbung, z. B. acme-java-entwickler") },
      annotations: { readOnlyHint: true },
    },
    ({ id }) =>
      run(async () => {
        const app = await getApplication(db, id);
        return app ? json(detail(app)) : fail(`Bewerbung "${id}" nicht gefunden`);
      }),
  );

  server.registerTool(
    "add_suggestion",
    {
      title: "Stellenvorschlag eintragen",
      description:
        "Legt eine Stelle mit Status 'Vorschlag' an. Gibt es bereits einen Eintrag mit gleichem Link oder gleicher " +
        "Firma + Stelle (auch im Archiv), wird nichts angelegt und der vorhandene Eintrag gemeldet.",
      inputSchema: {
        firma: patchShape.firma,
        stelle: patchShape.stelle,
        link: patchShape.link.optional(),
        ort: patchShape.ort.optional(),
        quelle: patchShape.quelle.optional(),
        remoteRegel: patchShape.remoteRegel.optional(),
        einschaetzung: patchShape.einschaetzung.optional(),
        gehalt: patchShape.gehalt.optional(),
      },
      annotations: { idempotentHint: true },
    },
    (input) =>
      run(async () => {
        const result = await addSuggestion(db, input);
        return result.created
          ? json({ created: true, application: summary(result.application) })
          : json({
              created: false,
              reason: `Duplikat (${result.reason})`,
              existing: summary(result.duplicate),
            });
      }),
  );

  server.registerTool(
    "update_application",
    {
      title: "Bewerbung bearbeiten",
      description:
        "Ändert einzelne Felder. Leerer String löscht ein Feld. Den Status bitte über move_application ändern.",
      inputSchema: {
        id: text("ID der Bewerbung"),
        patch: z.object(patchShape).partial().strict().describe("Nur die zu ändernden Felder"),
      },
      annotations: { idempotentHint: true },
    },
    ({ id, patch }) => run(async () => json(detail(await updateApplication(db, id, patch)))),
  );

  server.registerTool(
    "move_application",
    {
      title: "Status ändern",
      description:
        "Wechselt den Status nach den Board-Regeln: erster Wechsel nach 'Beworben' setzt Datum (heute) und " +
        "Nachfass-Termin (+14 Tage); Archiv-Status merken sich den vorherigen Status; 'Verworfen' speichert den Grund.",
      inputSchema: {
        id: text("ID der Bewerbung"),
        status: status.describe("Neuer Status"),
        grund: text("Grund beim Verwerfen eines Vorschlags").optional(),
      },
    },
    ({ id, status, grund }) =>
      run(async () => {
        const { application, previous } = await moveApplication(db, id, status, { grund });
        return json({ changed: previous !== null, application: summary(application) });
      }),
  );

  server.registerTool(
    "list_rejection_reasons",
    {
      title: "Ablehnungsgründe",
      description: "Gründe, aus denen Vorschläge verworfen wurden – als Signal für bessere Vorschläge.",
      annotations: { readOnlyHint: true },
    },
    () => run(async () => json(await listRejectionReasons(db))),
  );

  return server;
}
