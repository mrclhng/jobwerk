import { data, redirect } from "react-router";
import { serializeTheme, THEMES, type Theme } from "~/lib/theme.server";
import type { Route } from "./+types/theme";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const theme = form.get("theme");
  if (!(THEMES as readonly unknown[]).includes(theme)) {
    throw data("Ungültiges Theme", { status: 400 });
  }
  const headers = { "Set-Cookie": await serializeTheme(theme as Theme) };
  const back = form.get("redirectTo");
  return typeof back === "string" && back.startsWith("/") && !back.startsWith("//")
    ? redirect(back, { headers })
    : data({ ok: true }, { headers });
}
