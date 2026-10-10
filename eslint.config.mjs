import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static design prototype (HTML + JSX mockups) — never built or imported by the app
    "docs/design_handoff_vetree_redesign/**",
  ]),
  // CommonJS Node scripts: require() is the correct import form there; every other rule still applies
  {
    files: [".github/workflows/scripts/**/*.js", "scripts/**/*.cjs", "scripts/generate-icons.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // A plain ' or " in JSX text renders fine; still catch > and } (usually a typo for markup)
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],  // same files as eslint-config-next's react plugin
    rules: { "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }] },
  },
  // Forbid the browser Supabase singleton in server code.
  // Server files must use @supabase/supabase-js (service role) or @/lib/supabase/server (cookie auth).
  // Importing the browser singleton (@/lib/supabase/client) in server code silently uses the anon key,
  // which RLS blocks — producing empty 200 responses that look like real data.
  {
    files: ["app/api/**/*.ts", "app/actions/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@/lib/supabase/client",
          message: "Do not import the browser Supabase singleton in server code. Use @supabase/supabase-js with the service role key, or @/lib/supabase/server for cookie-based auth."
        }]
      }]
    }
  }
]);

export default eslintConfig;
