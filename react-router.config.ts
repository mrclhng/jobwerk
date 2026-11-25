import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  ssr: true,
  // Auf Vercel als Functions deployen; lokal ohne Wirkung.
  presets: process.env.VERCEL ? [vercelPreset()] : [],
  // v8-Verhalten schon jetzt aktivieren, damit das Upgrade klein bleibt.
  // (v8_passThroughRequests bewusst noch nicht: requireUser wertet request.url aus.)
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
