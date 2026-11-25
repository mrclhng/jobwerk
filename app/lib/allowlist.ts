/** Kommagetrennte Liste von GitHub-Logins → normalisiertes Set (GitHub-Logins sind case-insensitiv). */
export function parseAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedLogin(login: unknown, allowlist: Set<string>): boolean {
  return typeof login === "string" && login !== "" && allowlist.has(login.toLowerCase());
}
