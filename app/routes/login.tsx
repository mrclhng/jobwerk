import { useState } from "react";
import { redirect, useSearchParams } from "react-router";
import { authClient } from "~/lib/auth-client";
import { getOptionalUser } from "~/lib/auth.server";
import type { Route } from "./+types/login";

export const meta: Route.MetaFunction = () => [{ title: "Anmelden · Jobwerk" }];

export async function loader({ request }: Route.LoaderArgs) {
  if (await getOptionalUser(request)) throw redirect("/");
  return null;
}

const ERRORS: Record<string, string> = {
  not_allowed: "Dieser GitHub-Account hat keinen Zugriff auf Jobwerk.",
};

/** Nur relative Pfade zulassen (kein Open Redirect). */
function safeRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function Login() {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const error = params.get("error");
  const callbackURL = safeRedirect(params.get("redirectTo"));

  async function signIn() {
    setPending(true);
    await authClient.signIn.social({ provider: "github", callbackURL, errorCallbackURL: "/login" });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Jobwerk</h1>
        <p className="mt-1 text-muted">Das Werkzeug für die Jobsuche.</p>
        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-red-bg px-3 py-2 text-sm text-red">
            {ERRORS[error] ?? "Die Anmeldung hat nicht geklappt. Bitte versuch es noch einmal."}
          </p>
        )}
        <button
          type="button"
          onClick={signIn}
          disabled={pending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 font-semibold text-bg disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {pending ? "Weiterleitung zu GitHub …" : "Mit GitHub anmelden"}
        </button>
      </div>
    </main>
  );
}
