import { useEffect, useId, useRef } from "react";
import { useFetcher } from "react-router";
import type { Application } from "~/domain/application";
import { addDays, todayIso } from "~/domain/dates";
import { FOLLOW_UP_DAYS } from "~/domain/rules";
import { STATUSES } from "~/domain/status";

interface EditorDialogProps {
  application: Application | null;
  onClose: () => void;
}

type FieldDef = {
  name: keyof Application;
  label: string;
  type?: string;
  placeholder?: string;
  full?: boolean;
};

const FIELDS: FieldDef[] = [
  { name: "firma", label: "Firma" },
  { name: "stelle", label: "Stelle" },
  { name: "link", label: "Link zur Anzeige", type: "url", placeholder: "https://…", full: true },
  { name: "ort", label: "Ort / Remote" },
  { name: "status", label: "Status" },
  { name: "beworbenAm", label: "Beworben am", type: "date" },
  { name: "faelligAm", label: "Nachfassen am", type: "date" },
  { name: "naechster", label: "Nächster Schritt" },
  { name: "cv", label: "Lebenslauf-Version" },
  { name: "gehalt", label: "Genannte Gehaltsvorstellung", placeholder: "z. B. 75.000 €" },
  { name: "kontakt", label: "Ansprechpartner" },
  { name: "quelle", label: "Quelle", placeholder: "z. B. Indeed" },
  { name: "remoteRegel", label: "Remote-Regel (Zitat)", full: true },
  { name: "einschaetzung", label: "Einschätzung", full: true },
  { name: "notizen", label: "Notizen", full: true },
];

const inputClass = "w-full min-w-0 rounded-lg border border-line bg-bg px-2.5 py-2 font-normal text-ink";

export function EditorDialog({ application, onClose }: EditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const saving = fetcher.state !== "idle";
  const idPrefix = useId();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  /** Wie im alten Tracker: Status "Beworben" füllt Datum und Nachfass-Termin vor. */
  function onStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = formRef.current;
    if (!form || e.target.value !== "Beworben") return;
    const beworben = form.elements.namedItem("beworbenAm") as HTMLInputElement;
    const faellig = form.elements.namedItem("faelligAm") as HTMLInputElement;
    if (!beworben.value) {
      beworben.value = todayIso();
      if (!faellig.value) faellig.value = addDays(beworben.value, FOLLOW_UP_DAYS);
    }
  }

  const title = application ? `${application.firma} bearbeiten` : "Neue Bewerbung";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="editor-title"
      className="m-auto w-[min(720px,calc(100vw-24px))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <fetcher.Form ref={formRef} method="post" action="/?index" className="flex flex-col gap-4 p-5">
        <h2 id="editor-title" className="font-display text-lg font-bold">
          {title}
        </h2>
        <input type="hidden" name="intent" value="save" />
        {application && <input type="hidden" name="id" value={application.id} />}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const value = application?.[f.name];
            const defaultValue =
              value instanceof Date ? "" : (value ?? (f.name === "status" ? "Interessant" : ""));
            const multiline = f.name === "notizen" || f.name === "einschaetzung" || f.name === "remoteRegel";
            const inputId = `${idPrefix}-${f.name}`;
            return (
              <div key={f.name} className={`flex min-w-0 flex-col gap-1 ${f.full ? "sm:col-span-2" : ""}`}>
                <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
                  {f.label}
                </label>
                {f.name === "status" ? (
                  <select
                    id={inputId}
                    name="status"
                    defaultValue={defaultValue}
                    onChange={onStatusChange}
                    className={inputClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : multiline ? (
                  <textarea
                    id={inputId}
                    name={f.name}
                    defaultValue={defaultValue}
                    rows={f.name === "notizen" ? 4 : 2}
                    className={`${inputClass} resize-y`}
                  />
                ) : (
                  <input
                    id={inputId}
                    name={f.name}
                    type={f.type ?? "text"}
                    defaultValue={defaultValue}
                    placeholder={f.placeholder}
                    required={f.name === "firma"}
                    autoComplete="off"
                    className={inputClass}
                  />
                )}
              </div>
            );
          })}
        </div>
        {fetcher.data && !fetcher.data.ok && (
          <p role="alert" className="text-sm text-red">
            {fetcher.data.error ?? "Speichern hat nicht geklappt."}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] text-muted">Ohne Rückmeldung nach 10–14 Tagen kurz nachfassen.</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-1.5">
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg border border-accent bg-accent px-3.5 py-1.5 font-semibold text-accent-ink disabled:opacity-60"
            >
              {saving ? "Speichern …" : "Speichern"}
            </button>
          </div>
        </div>
      </fetcher.Form>
    </dialog>
  );
}
