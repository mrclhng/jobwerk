import { useDroppable } from "@dnd-kit/core";
import { useMemo } from "react";
import type { Application } from "~/domain/application";
import { compareForColumn } from "~/domain/rules";
import type { BoardStatus } from "~/domain/status";
import { ApplicationCard } from "./ApplicationCard";
import { COLUMN_DOT, EMPTY_COLUMN_TEXT } from "./status-style";
import type { BoardActions } from "./types";

interface ColumnProps {
  status: BoardStatus;
  applications: Application[];
  today: string;
  actions: BoardActions;
}

export function Column({ status, applications, today, actions }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sorted = useMemo(() => [...applications].sort(compareForColumn(today)), [applications, today]);

  return (
    <section
      ref={setNodeRef}
      aria-label={status}
      data-status={status}
      className={`flex min-h-36 min-w-0 snap-start flex-col gap-2 rounded-xl border p-2.5 transition-colors ${
        isOver ? "border-accent bg-drop" : "border-line bg-col"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-1 pt-0.5 pb-1">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${COLUMN_DOT[status]}`} />
          {status}
        </h2>
        <span className="rounded-full border border-line bg-surface px-2 font-mono text-xs text-muted">
          {sorted.length}
        </span>
      </header>
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-2 py-5 text-center text-[12.5px] text-muted">
          {EMPTY_COLUMN_TEXT[status] ?? "Karte hierher ziehen"}
        </p>
      ) : (
        sorted.map((app) => <ApplicationCard key={app.id} app={app} today={today} actions={actions} />)
      )}
    </section>
  );
}
