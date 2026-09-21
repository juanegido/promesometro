import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@jev/decide": new URL("./packages/decide/src/index.ts", import.meta.url).pathname,
      "@jev/rhetoric": new URL("./packages/rhetoric/src/index.ts", import.meta.url).pathname,
      "@jev/capability-router": new URL(
        "./packages/capability-router/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
  },
});
