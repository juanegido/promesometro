import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { TypeSafeClient } from "@jev/decide";
import { HEURISTIC_ENGINE, HeuristicDecider } from "@jev/rhetoric";
import { createApp, warmFiguras } from "./app.js";
import { loadCorpus } from "./corpus.js";
import { loadFiguras } from "./figuras.js";

const root = resolve(import.meta.dirname, "../../..");
const port = Number(process.env.PORT ?? 8787);
const webDist = process.env.WEB_DIST ?? join(root, "apps/web/dist");
const cacheDir = process.env.CACHE_DIR ?? join(root, "data/cache");
const publicOrigin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`;

const hasKey = Boolean(process.env.TYPESAFE_API_KEY?.trim());
const decider = hasKey ? new TypeSafeClient({ timeout: 15_000 }) : new HeuristicDecider();
const engine = hasKey ? (process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest") : HEURISTIC_ENGINE;

const corpus = await loadCorpus(join(root, "corpus"));
const { figuras, textos } = await loadFiguras(join(root, "corpus/figuras"));

const indexHtmlPath = join(webDist, "index.html");
const indexHtml = existsSync(indexHtmlPath) ? await readFile(indexHtmlPath, "utf8") : undefined;

const app = createApp({
  decider,
  engine,
  corpus,
  cacheDir,
  figuras,
  textos,
  publicOrigin,
  ...(indexHtml ? { indexHtml } : {}),
});

if (existsSync(webDist)) {
  const rel = webDist.startsWith(process.cwd()) ? webDist.slice(process.cwd().length + 1) : webDist;
  app.use("/*", serveStatic({ root: rel }));
  app.get("*", serveStatic({ root: rel, path: "index.html" }));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`promesómetro api · motor ${engine} · http://localhost:${port}`);
  if (!hasKey) console.log("sin TYPESAFE_API_KEY: usando el motor heurístico");
  warmFiguras({ decider, engine, corpus, cacheDir, figuras, textos }).catch(console.error);
});
