/** Gemeinsame Konfiguration für Playwright-Server und Setup (eigene, wegwerfbare Datenbank). */
export const E2E_PORT = 5179;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const e2eEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5433/jobwerk_e2e",
  BETTER_AUTH_SECRET: "e2e-secret-nur-fuer-tests-0123456789abcdef",
  BETTER_AUTH_URL: E2E_BASE_URL,
  GITHUB_CLIENT_ID: "e2e",
  GITHUB_CLIENT_SECRET: "e2e",
  ALLOWED_GITHUB_LOGINS: "e2e-user",
};
