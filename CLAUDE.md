# jev

pnpm monorepo, TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), ESM only, Vitest, Biome.

- Packages live in `packages/*`; each builds with `tsc` to `dist`. Tests sit next to sources as `*.test.ts` and are excluded from the build.
- `@jev/decide` is the base. Anything that calls Jev takes a `Decider` so tests use `FakeDecider` instead of the network.
- Jev SDK: `@typesafe-ai/sdk`. Questions are `noul` (yes/no probability), `choice` (labels with per-option probabilities and confidence) and `score` (ordered rubric). Answer types are inferred from the questions; keep `const` generics so labels stay literal.
- Network egress to typesafe.ai docs is blocked in remote sessions; the SDK's `.d.ts` in `node_modules` is the API reference.
- Run `pnpm lint:fix && pnpm typecheck && pnpm test` before committing.
