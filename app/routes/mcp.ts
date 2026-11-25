import { getDb } from "~/db/client.server";
import { parseAllowlist } from "~/lib/allowlist";
import { handleMcpRequest } from "~/mcp/http.server";
import type { Route } from "./+types/mcp";

function handle(request: Request) {
  return handleMcpRequest(request, getDb(), parseAllowlist(process.env.ALLOWED_GITHUB_LOGINS));
}

export function loader({ request }: Route.LoaderArgs) {
  return handle(request);
}

export function action({ request }: Route.ActionArgs) {
  return handle(request);
}
