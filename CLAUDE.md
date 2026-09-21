# jev · Promesómetro

pnpm monorepo, TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), ESM only, Vitest, Biome.

- `packages/*` son librerías que compilan con `tsc` a `dist`. `apps/api` es Hono en Node; `apps/web` es Vite + Preact. Tests junto a las fuentes como `*.test.ts`, excluidos del build. Vitest resuelve `@jev/*` a las fuentes via alias en `vitest.config.ts`.
- `@jev/decide` es la base. Todo lo que llama a Jev recibe un `Decider`, así los tests usan `FakeDecider` o `HeuristicDecider` y nunca la red.
- La rúbrica vive sólo en `packages/rhetoric/src/questions.ts`. La página Método la lee de `/api/method`. No dupliques los textos de la rúbrica en el frontend.
- Jev SDK: `@typesafe-ai/sdk`. Preguntas `noul`, `choice` y `score`; los tipos de respuesta se infieren de las preguntas, mantén genéricos `const`.
- Corpus: ningún texto sin `source`. Un texto `sintetico` no lleva autor real. Nunca redactes citas atribuidas a personas reales.
- La red de las sesiones remotas bloquea typesafe.ai; la referencia de la API es el `.d.ts` del SDK en `node_modules`.
- Antes de commit: `pnpm lint:fix && pnpm typecheck && pnpm test`. Para ver la app: `pnpm build && pnpm start`.
