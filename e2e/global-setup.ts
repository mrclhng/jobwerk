import { mkdir, writeFile } from "node:fs/promises";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import * as schema from "../app/db/schema";
import { E2E_BASE_URL, e2eEnv } from "./env";
import { resetApplications, withE2eDb } from "./fixtures";

export const STORAGE_STATE = "e2e/.auth/user.json";

/**
 * Meldet einen Allowlist-Nutzer an, ohne GitHub zu bemühen: Eine test-only
 * better-auth-Instanz (gleiches Secret, gleiche DB) erzeugt eine echte, signierte
 * Session. Die App selbst enthält keinen Test-Bypass.
 */
export default async function globalSetup() {
  await resetApplications();

  await withE2eDb(async (db) => {
    await db.execute(sql`truncate table "user", session, account, verification, api_tokens cascade`);

    const auth = betterAuth({
      secret: e2eEnv.BETTER_AUTH_SECRET,
      baseURL: E2E_BASE_URL,
      database: drizzleAdapter(db, { provider: "pg", schema }),
      user: { additionalFields: { githubLogin: { type: "string", required: false, input: false } } },
      plugins: [testUtils()],
    });
    const { test } = await auth.$context;
    const user = await test.saveUser(
      test.createUser({ name: "E2E Nutzer", email: "e2e@example.com", githubLogin: "e2e-user" }),
    );
    const cookies = await test.getCookies({ userId: user.id, domain: "localhost" });

    await mkdir("e2e/.auth", { recursive: true });
    await writeFile(
      STORAGE_STATE,
      JSON.stringify({
        cookies: cookies.map((c) => ({
          ...c,
          expires: c.expires ?? -1,
          httpOnly: c.httpOnly ?? true,
          secure: false,
          sameSite: c.sameSite ?? "Lax",
        })),
        origins: [],
      }),
    );
  });
}
