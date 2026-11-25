import { describe, expect, it } from "vitest";
import { user } from "~/db/schema";
import { parseAllowlist } from "~/lib/allowlist";
import { createApiToken } from "~/services/api-tokens.server";
import { setupTestDb } from "~/test/db";
import { handleMcpRequest } from "./http.server";

const t = setupTestDb();
const allowlist = parseAllowlist("octocat");

async function tokenFor(githubLogin: string) {
  const id = `u-${githubLogin}`;
  await t.db.insert(user).values({ id, name: githubLogin, email: `${githubLogin}@example.com`, githubLogin });
  return (await createApiToken(t.db, id, "test")).token;
}

function rpc(body: unknown, token?: string) {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

describe("MCP-HTTP-Endpunkt", () => {
  it("verlangt ein Bearer-Token", async () => {
    const res = await handleMcpRequest(rpc(initialize), t.db, allowlist);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("lehnt ungültige Tokens ab", async () => {
    const res = await handleMcpRequest(rpc(initialize, "jw_falsch"), t.db, allowlist);
    expect(res.status).toBe(401);
  });

  it("lehnt Tokens von Nutzern außerhalb der Allowlist ab", async () => {
    const token = await tokenFor("mallory");
    const res = await handleMcpRequest(rpc(initialize, token), t.db, allowlist);
    expect(res.status).toBe(403);
  });

  it("beantwortet initialize und tools/call mit gültigem Token", async () => {
    const token = await tokenFor("octocat");
    const init = await handleMcpRequest(rpc(initialize, token), t.db, allowlist);
    expect(init.status).toBe(200);
    expect(await init.json()).toMatchObject({ result: { serverInfo: { name: "jobwerk" } } });

    const call = await handleMcpRequest(
      rpc(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_applications", arguments: {} } },
        token,
      ),
      t.db,
      allowlist,
    );
    expect(call.status).toBe(200);
    const body = await call.json();
    expect(JSON.parse(body.result.content[0].text)).toEqual([]);
  });
});
