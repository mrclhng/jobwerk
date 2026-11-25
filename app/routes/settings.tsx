import { data, Form, Link, useNavigation } from "react-router";
import { getDb } from "~/db/client.server";
import { requireUser } from "~/lib/auth.server";
import { createApiToken, listApiTokens, revokeApiToken } from "~/services/api-tokens.server";
import type { Route } from "./+types/settings";

export const meta: Route.MetaFunction = () => [{ title: "Einstellungen · Jobwerk" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const tokens = await listApiTokens(getDb(), user.id);
  return { tokens, mcpUrl: new URL("/mcp", request.url).toString() };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const db = getDb();
  switch (form.get("intent")) {
    case "create": {
      const created = await createApiToken(db, user.id, String(form.get("name") ?? ""));
      return { created };
    }
    case "revoke": {
      await revokeApiToken(db, user.id, String(form.get("id") ?? ""));
      return { created: null };
    }
    default:
      throw data("Unbekannte Aktion", { status: 400 });
  }
}

const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { tokens, mcpUrl } = loaderData;
  const created = actionData?.created;
  const busy = useNavigation().state !== "idle";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/" className="text-sm text-accent hover:underline">
          ← Zum Board
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Einstellungen</h1>
      </div>

      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <div>
          <h2 className="font-display text-lg font-bold">MCP-Zugriff</h2>
          <p className="mt-1 text-sm text-muted">
            Über den MCP-Server kann Claude Vorschläge eintragen und Bewerbungen aktualisieren. Endpunkt:{" "}
            <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[13px] text-ink">{mcpUrl}</code>.
            Anfragen brauchen den Header{" "}
            <code className="font-mono text-[13px]">Authorization: Bearer &lt;Token&gt;</code>.
          </p>
        </div>

        {created && (
          <div role="status" className="rounded-lg border border-green bg-green-bg p-3 text-sm">
            <p className="font-semibold text-green">
              Token „{created.name}“ erstellt. Es wird nur jetzt angezeigt:
            </p>
            <code className="mt-2 block font-mono text-[13px] break-all text-ink select-all">
              {created.token}
            </code>
          </div>
        )}

        <Form method="post" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="create" />
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-[13px] font-semibold text-muted">
            Name
            <input
              name="name"
              placeholder="z. B. Claude – tägliche Suche"
              className="rounded-lg border border-line bg-bg px-2.5 py-2 font-normal text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-semibold text-accent-ink disabled:opacity-60"
          >
            Token erstellen
          </button>
        </Form>

        {tokens.length > 0 ? (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted">
                    erstellt {dateTime.format(t.erstellt)} ·{" "}
                    {t.zuletztGenutzt
                      ? `zuletzt genutzt ${dateTime.format(t.zuletztGenutzt)}`
                      : "noch nicht genutzt"}
                  </div>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="rounded-md px-2 py-1 text-[13px] text-red hover:bg-red-bg">
                    Widerrufen
                  </button>
                </Form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Noch keine Tokens.</p>
        )}
      </section>
    </main>
  );
}
