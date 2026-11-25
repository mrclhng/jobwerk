import { describe, expect, it } from "vitest";
import { user } from "~/db/schema";
import { setupTestDb } from "~/test/db";
import {
  createApiToken,
  hashToken,
  listApiTokens,
  revokeApiToken,
  verifyApiToken,
} from "./api-tokens.server";

const t = setupTestDb();

async function createUser(id = "u1", githubLogin = "octocat") {
  await t.db.insert(user).values({ id, name: "Octo", email: `${id}@example.com`, githubLogin });
  return id;
}

describe("API-Tokens", () => {
  it("speichert nur den Hash und verifiziert das Klartext-Token", async () => {
    const userId = await createUser();
    const created = await createApiToken(t.db, userId, "Claude");
    expect(created.token).toMatch(/^jw_[A-Za-z0-9_-]{43}$/);

    const [stored] = await listApiTokens(t.db, userId);
    expect(stored).toMatchObject({ id: created.id, name: "Claude", zuletztGenutzt: null });
    expect(JSON.stringify(stored)).not.toContain(created.token);

    const verified = await verifyApiToken(t.db, created.token);
    expect(verified).toMatchObject({ userId, githubLogin: "octocat" });
    const [afterUse] = await listApiTokens(t.db, userId);
    expect(afterUse!.zuletztGenutzt).toBeInstanceOf(Date);
  });

  it("lehnt falsche, fremde und widerrufene Tokens ab", async () => {
    const userId = await createUser();
    const created = await createApiToken(t.db, userId, "Claude");
    expect(await verifyApiToken(t.db, "jw_falsch")).toBeNull();
    expect(await verifyApiToken(t.db, hashToken(created.token))).toBeNull();

    expect(await revokeApiToken(t.db, "anderer-user", created.id)).toBe(false);
    expect(await revokeApiToken(t.db, userId, created.id)).toBe(true);
    expect(await verifyApiToken(t.db, created.token)).toBeNull();
  });
});
