import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { useFetchers, useSubmit } from "react-router";
import type { Application } from "~/domain/application";
import { planMove, snapshotMoveFields, type MoveFields } from "~/domain/rules";
import { ARCHIVE_STATUSES, BOARD_STATUSES, isBoardStatus, type Status } from "~/domain/status";
import { ApplicationCard } from "./ApplicationCard";
import { ArchiveList } from "./ArchiveList";
import { Column } from "./Column";
import { EditorDialog } from "./EditorDialog";
import { Header } from "./Header";
import { columnKeyboardCoordinates } from "./keyboard";
import { UndoToast, type ToastState } from "./UndoToast";

interface BoardProps {
  user: { name: string; image: string | null };
  applications: Application[];
  today: string;
}

/**
 * Optimistische Sicht: Laufende Statuswechsel (Fetcher mit intent=move) werden
 * mit denselben Regeln wie auf dem Server vorweggenommen, damit Karten sofort springen.
 */
function useOptimisticApplications(applications: Application[], today: string): Application[] {
  const fetchers = useFetchers();
  return useMemo(() => {
    const pending = new Map<string, { status: Status; grund?: string }>();
    for (const f of fetchers) {
      if (f.formData?.get("intent") !== "move") continue;
      pending.set(String(f.formData.get("id")), {
        status: f.formData.get("status") as Status,
        grund: (f.formData.get("grund") as string | null) ?? undefined,
      });
    }
    if (pending.size === 0) return applications;
    return applications.map((app) => {
      const p = pending.get(app.id);
      if (!p) return app;
      const patch = planMove(app, p.status, { grund: p.grund, today });
      return patch ? { ...app, ...patch } : app;
    });
  }, [applications, fetchers, today]);
}

const announcements: Announcements = {
  onDragStart: ({ active }) => `${active.data.current?.label ?? "Karte"} aufgenommen.`,
  onDragOver: ({ active, over }) =>
    over
      ? `${active.data.current?.label ?? "Karte"} über Spalte ${over.id}.`
      : `${active.data.current?.label ?? "Karte"} ist über keiner Spalte.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `${active.data.current?.label ?? "Karte"} nach ${over.id} verschoben.`
      : `${active.data.current?.label ?? "Karte"} abgelegt, ohne Änderung.`,
  onDragCancel: ({ active }) => `Verschieben von ${active.data.current?.label ?? "Karte"} abgebrochen.`,
};

export function Board({ user, applications, today }: BoardProps) {
  const submit = useSubmit();
  const items = useOptimisticApplications(applications, today);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editing, setEditing] = useState<Application | "new" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const move = useCallback(
    (app: Application, status: Status, grund?: string) => {
      if (app.status === status) return;
      const previous: MoveFields = snapshotMoveFields(app);
      const form: Record<string, string> = { intent: "move", id: app.id, status };
      if (grund) form.grund = grund;
      submit(form, { method: "post", action: "/?index", navigate: false, fetcherKey: `move:${app.id}` });
      setToast({ key: Date.now(), message: `${app.firma}: ${status}`, id: app.id, previous });
    },
    [submit],
  );

  const undo = useCallback(
    (t: ToastState) => {
      submit(
        { intent: "revert", id: t.id, previous: JSON.stringify(t.previous) },
        { method: "post", action: "/?index", navigate: false, fetcherKey: `revert:${t.id}` },
      );
      setToast(null);
    },
    [submit],
  );

  const byStatus = useMemo(() => {
    const map = new Map<Status, Application[]>();
    for (const app of items) map.set(app.status, [...(map.get(app.status) ?? []), app]);
    return map;
  }, [items]);

  const archived = items.filter((a) => (ARCHIVE_STATUSES as readonly string[]).includes(a.status));
  const activeApp = activeId ? items.find((a) => a.id === activeId) : undefined;
  const dismissToast = useCallback(() => setToast(null), []);
  const closeEditor = useCallback(() => setEditing(null), []);
  const actions = useMemo(() => ({ move, edit: (app: Application) => setEditing(app) }), [move]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const app = items.find((a) => a.id === e.active.id);
    const target = e.over?.id;
    if (app && isBoardStatus(target)) move(app, target);
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 pt-6 pb-24 sm:px-6">
      <Header user={user} onAdd={() => setEditing("new")} />

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Leertaste oder Enter zum Aufnehmen, Pfeiltasten zum Verschieben zwischen Spalten, erneut Leertaste oder Enter zum Ablegen, Escape zum Abbrechen.",
          },
        }}
      >
        <main
          aria-label="Bewerbungs-Board"
          className="grid snap-x snap-proximity auto-cols-[minmax(250px,1fr)] grid-flow-col items-start gap-3 overflow-x-auto overscroll-x-contain pb-2"
        >
          {BOARD_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              applications={byStatus.get(status) ?? []}
              today={today}
              actions={actions}
            />
          ))}
        </main>
        <DragOverlay dropAnimation={null}>
          {activeApp ? <ApplicationCard app={activeApp} today={today} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <ArchiveList applications={archived} onRestore={move} />

      {editing && <EditorDialog application={editing === "new" ? null : editing} onClose={closeEditor} />}
      {toast && <UndoToast toast={toast} onUndo={undo} onDismiss={dismissToast} />}
    </div>
  );
}
