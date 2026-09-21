import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { TypeSafeClient } from "@jev/decide";
import { HEURISTIC_ENGINE, HeuristicDecider } from "@jev/rhetoric";
import { createApp } from "./app.js";
import { loadCorpus } from "./corpus.js";

const root = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.PORT ?? 8787);
const webDist = process.env.WEB_DIST ?? join(root, "apps/web/dist");
const cacheDir = process.env.CACHE_DIR ?? join(root, "data/cache");

const hasKey = Boolean(process.env.TYPESAFE_API_KEY?.trim());
const decider = hasKey ? new TypeSafeClient({ timeout: 15_000 }) : new HeuristicDecider();
const engine = hasKey ? (process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest") : HEURISTIC_ENGINE;

const corpus = await loadCorpus(join(root, "corpus"));
const app = createApp({ decider, engine, corpus, cacheDir });

if (existsSync(webDist)) {
  const rel = webDist.startsWith(process.cwd()) ? webDist.slice(process.cwd().length + 1) : webDist;
  app.use("/*", serveStatic({ root: rel }));
  app.get("*", serveStatic({ root: rel, path: "index.html" }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`promesómetro api · motor ${engine} · http://localhost:${port}`);
  if (!hasKey) console.log("sin TYPESAFE_API_KEY: usando el motor heurístico");
});
