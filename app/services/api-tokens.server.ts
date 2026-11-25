import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "~/db/client.server";
import { apiTokens, user } from "~/db/schema";

/** Präfix macht Tokens in Logs/Secret-Scannern erkennbar. */
export const TOKEN_PREFIX = "jw_";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedToken {
  id: string;
  name: string;
  /** Klartext – wird nur dieses eine Mal zurückgegeben. */
  token: string;
}

export async function createApiToken(db: Db, userId: string, name: string): Promise<CreatedToken> {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url");
  const cleanName = name.trim().slice(0, 100) || "MCP";
  await db.insert(apiTokens).values({ id, name: cleanName, tokenHash: hashToken(token), userId });
  return { id, name: cleanName, token };
}

export async function listApiTokens(db: Db, userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      erstellt: apiTokens.erstellt,
      zuletztGenutzt: apiTokens.zuletztGenutzt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.erstellt));
}

export async function revokeApiToken(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });
  return rows.length > 0;
}

/**
 * Prüft ein Bearer-Token. Gibt den zugehörigen Nutzer (inkl. GitHub-Login für den
 * Allowlist-Check) zurück oder `null`.
 */
export async function verifyApiToken(db: Db, token: string) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const hash = hashToken(token);
  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      tokenHash: apiTokens.tokenHash,
      userId: user.id,
      githubLogin: user.githubLogin,
    })
    .from(apiTokens)
    .innerJoin(user, eq(apiTokens.userId, user.id))
    .where(eq(apiTokens.tokenHash, hash));
  // Lookup per Hash; der konstante Vergleich ist zusätzliche Vorsicht
  if (!row || !timingSafeEqual(Buffer.from(row.tokenHash), Buffer.from(hash))) return null;
  await db.update(apiTokens).set({ zuletztGenutzt: new Date() }).where(eq(apiTokens.id, row.tokenId));
  return { userId: row.userId, githubLogin: row.githubLogin, tokenId: row.tokenId };
}
