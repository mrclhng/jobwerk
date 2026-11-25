import { createCookie } from "react-router";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const themeCookie = createCookie("theme", { maxAge: 60 * 60 * 24 * 365, sameSite: "lax", path: "/" });

export async function getTheme(request: Request): Promise<Theme> {
  const value = await themeCookie.parse(request.headers.get("Cookie"));
  return (THEMES as readonly string[]).includes(value) ? (value as Theme) : "system";
}

export function serializeTheme(theme: Theme): Promise<string> {
  return themeCookie.serialize(theme);
}
