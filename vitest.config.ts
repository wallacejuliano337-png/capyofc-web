import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "npm:@supabase/supabase-js@2.116.0": "@supabase/supabase-js",
      "npm:livekit-server-sdk@2.19.0": "livekit-server-sdk",
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 15000 },
});
