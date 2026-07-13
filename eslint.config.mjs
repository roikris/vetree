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
  ]),
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
