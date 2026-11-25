import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/board.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  route("theme", "routes/theme.ts"),
  route("einstellungen", "routes/settings.tsx"),
  route("api/auth/*", "routes/api.auth.ts"),
  route("mcp", "routes/mcp.ts"),
] satisfies RouteConfig;
