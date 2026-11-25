import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import type { Application } from "~/domain/application";
import { daysBetween, formatDateDe } from "~/domain/dates";
import { isFollowUpDue } from "~/domain/rules";
import { isBoardStatus, neighbourColumn } from "~/domain/status";
import type { BoardActions } from "./types";

interface CardProps {
  app: Application;
  today: string;
  actions?: BoardActions;
  /** Darstellung im DragOverlay (ohne Interaktion). */
  overlay?: boolean;
}

const miniButton =
  "rounded-md px-2 py-0.5 text-[12.5px] hover:bg-neutral-bg disabled:opacity-40 disabled:hover:bg-transparent";
const dangerButton = "rounded-md px-2 py-0.5 text-[12.5px] text-red hover:bg-red-bg";

export function ApplicationCard({ app, today, actions, overlay = false }: CardProps) {
  const label = `${app.firma}${app.stelle ? ` – ${app.stelle}` : ""}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: app.id,
    data: { label },
    disabled: overlay,
    // Karte bleibt semantisch ein Artikel (enthält eigene Buttons) – kein role="button"
    attributes: { role: "article", roleDescription: "verschiebbare Karte" },
  });
  const due = isFollowUpDue(app, today);

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      aria-label={label}
      data-testid="card"
      data-id={app.id}
      className={`flex min-w-0 touch-manipulation flex-col gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 ${
        overlay ? "rotate-1 cursor-grabbing shadow-xl" : "cursor-grab hover:shadow-sm"
      } ${isDragging ? "opacity-40" : ""} ${due ? "border-l-[3px] border-l-warn" : ""}`}
    >
      <CardBody app={app} today={today} due={due} />
      {actions && !overlay && <CardActions app={app} actions={actions} />}
    </article>
  );
}

function CardBody({ app, today, due }: { app: Application; today: string; due: boolean }) {
  const since = app.beworbenAm ? daysBetween(app.beworbenAm, today) : null;
  return (
    <>
      <div className="font-display text-[14.5px] font-bold [overflow-wrap:anywhere]">{app.firma}</div>
      {(app.stelle || app.link) && (
        <div className="text-[13px] [overflow-wrap:anywhere]">
          {app.link ? (
            <a
              href={app.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {app.stelle || "Anzeige öffnen"}
            </a>
          ) : (
            app.stelle
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted">
        {app.ort && <span>{app.ort}</span>}
        {app.beworbenAm && (
          <span className="font-mono tabular-nums">
            beworben {formatDateDe(app.beworbenAm)}
            {since !== null && since >= 0 ? ` · ${since} T.` : ""}
          </span>
        )}
        {app.cv && <span>CV: {app.cv}</span>}
        {app.gehalt && <span>{app.gehalt}</span>}
        {app.quelle && <span>via {app.quelle}</span>}
      </div>
      {app.status === "Vorschlag" && app.einschaetzung && (
        <Labelled label="Einschätzung">{app.einschaetzung}</Labelled>
      )}
      {app.status === "Vorschlag" && app.remoteRegel && <Labelled label="Remote">{app.remoteRegel}</Labelled>}
      {(app.naechster || app.faelligAm) && (
        <Labelled label="Nächster Schritt">
          {app.naechster}
          {app.faelligAm && <span className="font-mono"> · {formatDateDe(app.faelligAm)}</span>}
        </Labelled>
      )}
      {due && (
        <span className="w-fit rounded-full bg-warn-bg px-2 py-px text-[11.5px] font-semibold text-warn">
          Nachfassen fällig
        </span>
      )}
    </>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-[12.5px]">
      <b className="mr-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</b>
      {children}
    </div>
  );
}

function CardActions({ app, actions }: { app: Application; actions: BoardActions }) {
  const [rejecting, setRejecting] = useState(false);
  const [grund, setGrund] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rejecting) inputRef.current?.focus();
  }, [rejecting]);

  if (!isBoardStatus(app.status)) return null;
  const prev = neighbourColumn(app.status, -1);
  const next = neighbourColumn(app.status, 1);
  // Buttons und Eingaben sollen keinen Drag starten
  const stop = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  };

  if (rejecting) {
    const confirm = () => {
      setRejecting(false);
      actions.move(app, "Verworfen", grund.trim() || undefined);
    };
    return (
      <div className="flex flex-col gap-1.5 border-t border-line pt-2" {...stop}>
        <input
          ref={inputRef}
          value={grund}
          onChange={(e) => setGrund(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") setRejecting(false);
          }}
          placeholder="Warum passt es nicht? (optional)"
          aria-label="Grund"
          className="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px]"
        />
        <div className="flex justify-end gap-1">
          <button type="button" className={miniButton} onClick={() => setRejecting(false)}>
            Abbrechen
          </button>
          <button type="button" className={dangerButton} onClick={confirm}>
            Verwerfen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex items-center justify-between gap-1 border-t border-line pt-1.5" {...stop}>
      <div className="flex gap-0.5">
        <button
          type="button"
          className={miniButton}
          disabled={!prev}
          onClick={() => prev && actions.move(app, prev)}
          aria-label={prev ? `Zurück nach ${prev}` : "Zurück"}
          title={prev ? `Zurück nach ${prev}` : undefined}
        >
          ‹
        </button>
        <button
          type="button"
          className={miniButton}
          disabled={!next}
          onClick={() => next && actions.move(app, next)}
          aria-label={next ? `Weiter nach ${next}` : "Weiter"}
          title={next ? `Weiter nach ${next}` : undefined}
        >
          ›
        </button>
      </div>
      <div className="flex gap-0.5">
        <button type="button" className={miniButton} onClick={() => actions.edit(app)}>
          Bearbeiten
        </button>
        {app.status === "Vorschlag" ? (
          <button type="button" className={dangerButton} onClick={() => setRejecting(true)}>
            Passt nicht
          </button>
        ) : (
          <button type="button" className={dangerButton} onClick={() => actions.move(app, "Absage")}>
            Absage
          </button>
        )}
      </div>
    </div>
  );
}
