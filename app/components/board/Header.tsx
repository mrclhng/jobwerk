import { Form, Link, useLocation, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "~/root";

interface HeaderProps {
  user: { name: string; image: string | null };
  onAdd: () => void;
}

const THEME_LABEL = { system: "System", light: "Hell", dark: "Dunkel" } as const;
const NEXT_THEME = { system: "light", light: "dark", dark: "system" } as const;

export function Header({ user, onAdd }: HeaderProps) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const theme = root?.theme ?? "system";
  const location = useLocation();

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[clamp(24px,3.6vw,32px)] font-extrabold tracking-tight">
          Bewerbungen
        </h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          Vorschläge prüfen, dann per Drag &amp; Drop oder mit den Pfeilen weiterschieben.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-accent bg-accent px-3.5 py-1.5 font-semibold text-accent-ink"
        >
          + Bewerbung hinzufügen
        </button>
        <Form method="post" action="/theme">
          <input type="hidden" name="theme" value={NEXT_THEME[theme]} />
          <input type="hidden" name="redirectTo" value={location.pathname + location.search} />
          <button
            type="submit"
            className="rounded-lg border border-line bg-surface px-3 py-1.5"
            title="Farbschema wechseln"
          >
            Design: {THEME_LABEL[theme]}
          </button>
        </Form>
        <Link to="/einstellungen" className="rounded-lg border border-line bg-surface px-3 py-1.5">
          Einstellungen
        </Link>
        <Form method="post" action="/logout" className="flex items-center gap-2">
          {user.image && <img src={user.image} alt="" className="size-8 rounded-full border border-line" />}
          <button
            type="submit"
            className="rounded-lg border border-line bg-surface px-3 py-1.5"
            title={user.name}
          >
            Abmelden
          </button>
        </Form>
      </div>
    </header>
  );
}
