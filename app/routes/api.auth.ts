import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/api.auth";

/** Alle better-auth-Endpunkte (OAuth-Redirects, Callback, Session, Logout). */
export function loader({ request }: Route.LoaderArgs) {
  return getAuth().handler(request);
}

export function action({ request }: Route.ActionArgs) {
  return getAuth().handler(request);
}
