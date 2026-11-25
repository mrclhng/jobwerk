import type { Application } from "~/domain/application";
import { restoreTarget } from "~/domain/rules";
import type { Status } from "~/domain/status";
import { archivePillClass } from "./status-style";

interface ArchiveListProps {
  applications: Application[];
  onRestore: (app: Application, status: Status) => void;
}

export function ArchiveList({ applications, onRestore }: ArchiveListProps) {
  const sorted = [...applications].sort((a, b) => b.aktualisiert.getTime() - a.aktualisiert.getTime());
  return (
    <details className="group rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-display text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
          ▸
        </span>
        Archiv: Absagen, verworfene Vorschläge &amp; geschlossene Stellen
        <span className="rounded-full border border-line bg-surface px-2 font-mono text-xs font-normal text-muted">
          {sorted.length}
        </span>
      </summary>
      {sorted.length === 0 ? (
        <p className="border-t border-line px-4 py-3 text-sm text-muted">Noch nichts im Archiv.</p>
      ) : (
        <ul>
          {sorted.map((app) => (
            <li
              key={app.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 border-t border-line px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="font-display font-bold [overflow-wrap:anywhere]">{app.firma}</div>
                <div className="text-[13px] [overflow-wrap:anywhere]">{app.stelle}</div>
                {app.grund && <div className="text-[13px] text-muted">Grund: {app.grund}</div>}
              </div>
              <span
                className={`rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap ${archivePillClass(app.status)}`}
              >
                {app.status}
              </span>
              <button
                type="button"
                className="rounded-md px-2 py-0.5 text-[12.5px] hover:bg-neutral-bg"
                onClick={() => onRestore(app, restoreTarget(app))}
              >
                Zurückholen
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
