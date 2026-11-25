import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redirect } from "react-router";
import { getDb } from "~/db/client.server";
import * as schema from "~/db/schema";
import { isAllowedLogin, parseAllowlist } from "./allowlist";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt`);
  return value;
}

function createAuth() {
  const allowlist = parseAllowlist(process.env.ALLOWED_GITHUB_LOGINS);

  return betterAuth({
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    socialProviders: {
      github: {
        clientId: requireEnv("GITHUB_CLIENT_ID"),
        clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
        mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
      },
    },
    user: {
      additionalFields: {
        githubLogin: { type: "string", required: false, input: false },
      },
      /**
       * Allowlist: läuft bei Registrierung, Account-Verknüpfung und jedem GitHub-Login
       * mit dem frischen GitHub-Profil. Fremde Accounts werden gar nicht erst angelegt.
       */
      validateUserInfo: ({ source }) => {
        if (source.method !== "oauth" || source.oauth?.providerId !== "github") {
          return { error: "provider_not_allowed" };
        }
        if (!isAllowedLogin(source.oauth.profile?.login, allowlist)) {
          return { error: "not_allowed", errorDescription: "Dieser GitHub-Account hat keinen Zugriff." };
        }
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    onAPIError: { errorURL: "/login" },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** Lazy, damit Build und Tests ohne Secrets funktionieren. */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  githubLogin: string;
};

/**
 * Für geschützte Loader/Actions: liefert den angemeldeten Nutzer oder leitet zum Login um.
 * Prüft die Allowlist zusätzlich bei jedem Request – so wirkt ein Entfernen aus der
 * Liste sofort, auch für bestehende Sessions.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(redirectTo === "/" ? "/login" : `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  const { user } = session;
  if (!isAllowedLogin(user.githubLogin, parseAllowlist(process.env.ALLOWED_GITHUB_LOGINS))) {
    throw new Response("Kein Zugriff", { status: 403 });
  }
  return user as SessionUser;
}

export async function getOptionalUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
