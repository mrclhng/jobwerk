import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Db } from "~/db/client.server";
import { isAllowedLogin } from "~/lib/allowlist";
import { verifyApiToken } from "~/services/api-tokens.server";
import { createMcpServer } from "./server.server";

function unauthorized(message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="jobwerk"' } },
  );
}

/**
 * MCP über Streamable HTTP, zustandslos (jede Anfrage bekommt Server + Transport) –
 * passt zu Serverless (Vercel), wo es keine langlebigen Prozesse gibt.
 *
 * Auth (Zwischenstufe): persönliches API-Token als Bearer. Der Token-Besitzer muss
 * weiterhin auf der Allowlist stehen.
 */
export async function handleMcpRequest(request: Request, db: Db, allowlist: Set<string>): Promise<Response> {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return unauthorized("Authorization: Bearer <Token> fehlt");

  const owner = await verifyApiToken(db, match[1]!);
  if (!owner) return unauthorized("Ungültiges oder widerrufenes Token");
  if (!isAllowedLogin(owner.githubLogin, allowlist)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32003, message: "Kein Zugriff" }, id: null },
      { status: 403 },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer(db);
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Bei JSON-Antworten ist die Antwort hier vollständig; Ressourcen freigeben.
    void server.close();
  }
}
