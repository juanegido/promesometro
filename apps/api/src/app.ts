import type { Decider } from "@jev/decide";
import {
  analyzeDocument,
  CONCRECION,
  CONSISTENCIA,
  type CompareVerdict,
  compareStatements,
  type DocumentVerdict,
  hashDocument,
  MOVIMIENTO,
  segmentDocument,
  TEMA,
  TIPO,
  TONO,
} from "@jev/rhetoric";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { VerdictCache } from "./cache.js";
import type { CorpusEntry } from "./corpus.js";
import { RateLimiter } from "./ratelimit.js";

export interface AppDeps {
  decider: Decider;
  engine: string;
  corpus: CorpusEntry[];
  cacheDir: string | null;
  /** Segments per IP per minute. */
  rate?: { capacity: number; perSecond: number };
}

const MAX_CHARS = 40_000;
const MAX_SEGMENTS = 160;

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const docs = new VerdictCache<DocumentVerdict>(deps.cacheDir);
  const limiter = new RateLimiter(deps.rate?.capacity ?? 600, deps.rate?.perSecond ?? 5);

  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ ok: true, engine: deps.engine }));

  app.get("/api/method", (c) =>
    c.json({ engine: deps.engine, CONCRECION, TIPO, TEMA, TONO, MOVIMIENTO, CONSISTENCIA }),
  );

  app.post("/api/analyze", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      text?: string;
      title?: string;
      source?: string;
    } | null;
    const text = body?.text?.trim() ?? "";
    if (text.length < 20) return c.json({ error: "Pega al menos una frase completa." }, 400);
    if (text.length > MAX_CHARS) {
      return c.json({ error: `Máximo ${MAX_CHARS.toLocaleString("es")} caracteres.` }, 413);
    }
    const key = hashDocument(text, deps.engine);
    const cached = await docs.get(key);
    if (cached) return c.json(cached);

    const cost = segmentDocument(text, MAX_SEGMENTS).length;
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!limiter.take(ip, cost)) {
      return c.json({ error: "Demasiado texto en poco tiempo. Espera un minuto." }, 429);
    }

    const verdict = await analyzeDocument(deps.decider, text, {
      title: body?.title?.trim() || null,
      source: body?.source?.trim() || null,
      maxSegments: MAX_SEGMENTS,
    });
    await docs.set(key, verdict);
    return c.json(verdict);
  });

  app.get("/api/verdict/:hash", async (c) => {
    const v = await docs.get(c.req.param("hash"));
    return v ? c.json(v) : c.json({ error: "No existe ese acta." }, 404);
  });

  app.post("/api/compare", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      antes?: string;
      despues?: string;
    } | null;
    const antes = body?.antes?.trim() ?? "";
    const despues = body?.despues?.trim() ?? "";
    if (antes.length < 10 || despues.length < 10) {
      return c.json({ error: "Faltan la promesa o la frase reciente." }, 400);
    }
    if (antes.length + despues.length > 4000) return c.json({ error: "Demasiado largo." }, 413);
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!limiter.take(ip, 4)) return c.json({ error: "Espera un minuto." }, 429);
    const v: CompareVerdict = await compareStatements(deps.decider, antes, despues);
    return c.json(v);
  });

  app.get("/api/corpus", (c) =>
    c.json(
      deps.corpus.map(({ text, ...meta }) => ({
        ...meta,
        palabras: text.split(/\s+/).length,
        hash: hashDocument(text, deps.engine),
      })),
    ),
  );

  app.get("/api/corpus/:id", async (c) => {
    const entry = deps.corpus.find((e) => e.id === c.req.param("id"));
    if (!entry) return c.json({ error: "No existe." }, 404);
    const key = hashDocument(entry.text, deps.engine);
    let verdict = await docs.get(key);
    if (!verdict) {
      verdict = await analyzeDocument(deps.decider, entry.text, {
        title: entry.title,
        source: entry.source,
        maxSegments: MAX_SEGMENTS,
      });
      await docs.set(key, verdict);
    }
    return c.json({ entry, verdict });
  });

  return app;
}
