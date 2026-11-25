import { redirect } from "react-router";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/logout";

export async function action({ request }: Route.ActionArgs) {
  const { headers } = await getAuth().api.signOut({ headers: request.headers, returnHeaders: true });
  return redirect("/login", { headers });
}

export function loader() {
  return redirect("/");
}
