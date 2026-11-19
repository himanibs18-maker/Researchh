import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()];
  // Local preview runs the same authenticated resource handlers as Vercel.
  // @ts-expect-error The API adapter is a server-only ES module.
  const { localApi } = await import("./server/vite-api.js");
  plugins.push(localApi(loadEnv(mode, process.cwd(), "")));
  try {
    // @ts-expect-error The preview source-tag plugin has no TypeScript declarations.
    const m = await import("./.vite-source-tags.js");
    plugins.push(m.sourceTags());
  } catch {
    /* The source-tag integration is optional outside the preview environment. */
  }

  const env = loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("/node_modules/@supabase/")) return "cloud-client";
            if (
              /\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(
                id,
              )
            )
              return "react-runtime";
          },
        },
      },
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: processEnvDefines,
  };
});
