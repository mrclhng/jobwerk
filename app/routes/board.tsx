import { data } from "react-router";
import { z } from "zod";
import { Board } from "~/components/board/Board";
import { getDb } from "~/db/client.server";
import { applicationFieldsSchema, moveSnapshotSchema, statusSchema } from "~/domain/application";
import { todayIso } from "~/domain/dates";
import { requireUser } from "~/lib/auth.server";
import {
  createApplication,
  getApplication,
  listApplications,
  moveApplication,
  NotFoundError,
  revertMove,
  updateApplication,
} from "~/services/applications.server";
import type { Route } from "./+types/board";

export const meta: Route.MetaFunction = () => [{ title: "Bewerbungen · Jobwerk" }];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const applications = await listApplications(getDb());
  return { user: { name: user.name, image: user.image ?? null }, applications, today: todayIso() };
}

const intentSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("move"),
    id: z.string().min(1),
    status: statusSchema,
    grund: z.string().optional(),
  }),
  z.object({ intent: z.literal("revert"), id: z.string().min(1), previous: z.string() }),
  z.object({ intent: z.literal("save"), id: z.string().optional() }).passthrough(),
]);

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const db = getDb();
  const form = Object.fromEntries(await request.formData());
  const parsed = intentSchema.safeParse(form);
  if (!parsed.success) return data({ ok: false as const, error: "Ungültige Anfrage" }, { status: 400 });

  try {
    switch (parsed.data.intent) {
      case "move": {
        const { id, status, grund } = parsed.data;
        const result = await moveApplication(db, id, status, { grund });
        return { ok: true as const, application: result.application };
      }
      case "revert": {
        const previous = moveSnapshotSchema.parse(JSON.parse(parsed.data.previous));
        await revertMove(db, parsed.data.id, previous);
        return { ok: true as const };
      }
      case "save": {
        const { intent: _intent, id, ...raw } = parsed.data;
        const fields = applicationFieldsSchema.safeParse(raw);
        if (!fields.success) {
          return data(
            { ok: false as const, error: fields.error.issues.map((i) => i.message).join(", ") },
            { status: 400 },
          );
        }
        if (!id) {
          const application = await createApplication(db, fields.data);
          return { ok: true as const, application };
        }
        // Nur Felder übernehmen, die das Formular tatsächlich mitschickt (z. B. bleibt `grund` erhalten)
        const { status, ...all } = fields.data;
        const patch = Object.fromEntries(Object.entries(all).filter(([key]) => key in raw));
        await updateApplication(db, id, patch);
        // Statuswechsel aus dem Editor laufen über dieselben Regeln wie Drag & Drop
        const current = await getApplication(db, id);
        if (current && current.status !== status) await moveApplication(db, id, status);
        return { ok: true as const, application: await getApplication(db, id) };
      }
    }
  } catch (error) {
    if (error instanceof NotFoundError)
      return data({ ok: false as const, error: error.message }, { status: 404 });
    if (error instanceof z.ZodError)
      return data({ ok: false as const, error: "Ungültige Daten" }, { status: 400 });
    throw error;
  }
}

export default function BoardRoute({ loaderData }: Route.ComponentProps) {
  return <Board {...loaderData} />;
}
