import type { Decider } from "@jev/decide";
import {
  analyzeDocument,
  CONCRECION,
  CONSISTENCIA,
  type CompareVerdict,
  compareStatements,
  type DocumentVerdict,
  deltaFor,
  type Figura,
  hashDocument,
  humoDelDia,
  inWindow,
  latestDate,
  METRICAS,
  MOVIMIENTO,
  metricsFor,
  segmentDocument,
  shiftDate,
  TEMA,
  TIPO,
  TONO,
  wordCount,
} from "@jev/rhetoric";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { VerdictCache } from "./cache.js";
import type { CorpusEntry } from "./corpus.js";
import type { TextoEntry } from "./figuras.js";
import { ogFigura, ogFrase, ogTexto, PngCache } from "./og.js";
import { RateLimiter } from "./ratelimit.js";
import { renderIndex, type SeoMeta } from "./seo.js";

export interface AppDeps {
  decider: Decider;
  engine: string;
  corpus: CorpusEntry[];
  cacheDir: string | null;
  figuras?: Figura[];
  textos?: TextoEntry[];
  publicOrigin?: string;
  /** Built apps/web/dist/index.html contents, when the web build is present. */
  indexHtml?: string;
  /** Segments per IP per minute. */
  rate?: { capacity: number; perSecond: number };
}

const MAX_CHARS = 40_000;
const MAX_SEGMENTS = 160;
const PNG_HEADERS = {
  "content-type": "image/png",
  "cache-control": "public, max-age=3600",
} as const;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const docs = new VerdictCache<DocumentVerdict>(deps.cacheDir);
  const limiter = new RateLimiter(deps.rate?.capacity ?? 600, deps.rate?.perSecond ?? 5);
  const figuras = deps.figuras ?? [];
  const textos = deps.textos ?? [];
  const publicOrigin = deps.publicOrigin ?? "http://localhost:8787";
  const pngCache = new PngCache(500);

  /**
   * The lookup key derives from the configured engine label (e.g. "jev-latest"),
   * while the verdict's hash derives from the model that actually answered
   * (e.g. "jev-1.13.0"). Store under both so `/api/verdict/:hash` resolves either.
   */
  const alias = async (key: string, verdict: DocumentVerdict) => {
    if (verdict.hash === key) return;
    // Entries cached before aliasing existed live only under the lookup key; backfill on hit.
    if (!(await docs.get(verdict.hash))) await docs.set(verdict.hash, verdict);
  };
  const remember = async (key: string, verdict: DocumentVerdict) => {
    await docs.set(key, verdict);
    await alias(key, verdict);
  };

  // Dedup concurrent judging of the same text: several requests (or the current/previous
  // window overlap within one request) can ask for the same uncached texto at once.
  const inFlight = new Map<string, Promise<DocumentVerdict>>();

  const verdictFor = async (texto: TextoEntry): Promise<DocumentVerdict> => {
    const key = hashDocument(texto.text, deps.engine);
    const cached = await docs.get(key);
    if (cached) {
      await alias(key, cached);
      return cached;
    }
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = (async () => {
      const v = await analyzeDocument(deps.decider, texto.text, {
        title: texto.titulo,
        source: texto.source,
        maxSegments: MAX_SEGMENTS,
      });
      await remember(key, v);
      return v;
    })();
    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  };

  // OG images are CPU-heavy to render and unauthenticated; charge the limiter on every
  // cache miss so a burst of distinct routes can't be used to hammer the renderer for free.
  const chargeOgRender = (c: Context): boolean => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    return limiter.take(ip, 2);
  };

  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ ok: true, engine: deps.engine }));

  app.get("/api/method", (c) =>
    c.json({
      engine: deps.engine,
      CONCRECION,
      TIPO,
      TEMA,
      TONO,
      MOVIMIENTO,
      CONSISTENCIA,
      METRICAS,
    }),
  );

  app.post("/api/analyze", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      text?: string;
      title?: string;
      source?: string;
    } | null;
    const text = str(body?.text);
    if (text.length < 20) return c.json({ error: "Pega al menos una frase completa." }, 400);
    if (text.length > MAX_CHARS) {
      return c.json({ error: `Máximo ${MAX_CHARS.toLocaleString("es")} caracteres.` }, 413);
    }
    const key = hashDocument(text, deps.engine);
    const cached = await docs.get(key);
    if (cached) {
      await alias(key, cached);
      return c.json(cached);
    }

    const cost = segmentDocument(text, MAX_SEGMENTS).length;
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!limiter.take(ip, cost)) {
      return c.json({ error: "Demasiado texto en poco tiempo. Espera un minuto." }, 429);
    }

    const verdict = await analyzeDocument(deps.decider, text, {
      title: str(body?.title) || null,
      source: str(body?.source) || null,
      maxSegments: MAX_SEGMENTS,
    });
    await remember(key, verdict);
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
    const antes = str(body?.antes);
    const despues = str(body?.despues);
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
    if (verdict) await alias(key, verdict);
    else {
      verdict = await analyzeDocument(deps.decider, entry.text, {
        title: entry.title,
        source: entry.source,
        maxSegments: MAX_SEGMENTS,
      });
      await remember(key, verdict);
    }
    return c.json({ entry, verdict });
  });

  // --- Figuras: ranking of tracked public figures --------------------------------------

  app.get("/api/figuras", async (c) => {
    const hasta = latestDate(textos);
    const currentTextos = hasta ? inWindow(textos, hasta) : [];
    const previousTextos = hasta ? inWindow(textos, shiftDate(hasta, -1)) : [];

    const result = await Promise.all(
      figuras.map(async (figura) => {
        const curVerdicts = await mapLimit(
          currentTextos.filter((t) => t.figura === figura.id),
          2,
          verdictFor,
        );
        const prevVerdicts = await mapLimit(
          previousTextos.filter((t) => t.figura === figura.id),
          2,
          verdictFor,
        );
        const metrics = metricsFor(curVerdicts);
        const delta = deltaFor(metrics, metricsFor(prevVerdicts));
        const ultimoTexto = latestDate(textos.filter((t) => t.figura === figura.id));
        return { ...figura, metrics, delta, ultimoTexto };
      }),
    );
    // Figures with no frases in the window carry no signal: keep them last, after every
    // figure that has data (sorted by humo desc among those).
    result.sort((a, b) => {
      const aEmpty = a.metrics.frases === 0;
      const bEmpty = b.metrics.frases === 0;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return b.metrics.humo - a.metrics.humo || a.nombre.localeCompare(b.nombre);
    });
    return c.json({ hasta, ventanaDias: 30, figuras: result });
  });

  app.get("/api/figuras/:id", async (c) => {
    const figura = figuras.find((f) => f.id === c.req.param("id"));
    if (!figura) return c.json({ error: "No existe." }, 404);

    const figuraTextos = textos.filter((t) => t.figura === figura.id);
    const hasta = latestDate(textos);
    const currentTextos = hasta ? inWindow(figuraTextos, hasta) : [];
    const previousTextos = hasta ? inWindow(figuraTextos, shiftDate(hasta, -1)) : [];
    const metrics = metricsFor(await mapLimit(currentTextos, 2, verdictFor));
    const delta = deltaFor(metrics, metricsFor(await mapLimit(previousTextos, 2, verdictFor)));

    const textosOut = await mapLimit(figuraTextos, 2, async (t) => {
      const v = await verdictFor(t);
      return { ...t, palabras: wordCount(t.text), resumen: v.resumen };
    });
    return c.json({ figura, metrics, delta, textos: textosOut });
  });

  app.get("/api/textos/:id", async (c) => {
    const texto = textos.find((t) => t.id === c.req.param("id"));
    const figura = texto && figuras.find((f) => f.id === texto.figura);
    if (!texto || !figura) return c.json({ error: "No existe." }, 404);
    const verdict = await verdictFor(texto);
    return c.json({ texto, figura, verdict });
  });

  app.get("/api/humo", async (c) => {
    const hasta = latestDate(textos);
    if (!hasta) return c.json({ fecha: null, humo: null, beligerante: null, medible: null });
    const today = textos.filter((t) => t.fecha === hasta);
    const items = await Promise.all(
      today.map(async (texto) => ({ texto, verdict: await verdictFor(texto) })),
    );
    const r = humoDelDia(items, hasta);
    const withNombre = <T extends { figura: string } | null>(f: T) =>
      f ? { ...f, figuraNombre: figuras.find((x) => x.id === f.figura)?.nombre ?? f.figura } : null;
    return c.json({
      fecha: hasta,
      humo: withNombre(r.humo),
      beligerante: withNombre(r.beligerante),
      medible: withNombre(r.medible),
    });
  });

  // --- OG images -------------------------------------------------------------------------

  app.get("/og/frase/:textoId/:nPng", async (c) => {
    const match = /^(\d+)\.png$/.exec(c.req.param("nPng"));
    if (!match?.[1]) return c.notFound();
    const n = Number(match[1]);
    const textoId = c.req.param("textoId");
    const cacheKey = `frase:${textoId}:${n}`;
    const cached = pngCache.get(cacheKey);
    if (cached) return c.body(Uint8Array.from(cached), 200, PNG_HEADERS);
    if (!chargeOgRender(c)) return c.json({ error: "Espera un minuto." }, 429);

    const texto = textos.find((t) => t.id === textoId);
    const figura = texto && figuras.find((f) => f.id === texto.figura);
    if (!texto || !figura) return c.notFound();
    const verdict = await verdictFor(texto);
    const segment = verdict.segments[n];
    if (!segment) return c.notFound();

    const png = ogFrase(texto, segment, figura, n);
    pngCache.set(cacheKey, png);
    return c.body(Uint8Array.from(png), 200, PNG_HEADERS);
  });

  app.get("/og/figura/:idPng", async (c) => {
    const match = /^(.+)\.png$/.exec(c.req.param("idPng"));
    if (!match?.[1]) return c.notFound();
    const id = match[1];
    const cacheKey = `figura:${id}`;
    const cached = pngCache.get(cacheKey);
    if (cached) return c.body(Uint8Array.from(cached), 200, PNG_HEADERS);
    if (!chargeOgRender(c)) return c.json({ error: "Espera un minuto." }, 429);

    const figura = figuras.find((f) => f.id === id);
    if (!figura) return c.notFound();
    const verdicts = await mapLimit(
      textos.filter((t) => t.figura === id),
      2,
      verdictFor,
    );
    const png = ogFigura(figura, metricsFor(verdicts));
    pngCache.set(cacheKey, png);
    return c.body(Uint8Array.from(png), 200, PNG_HEADERS);
  });

  app.get("/og/texto/:idPng", async (c) => {
    const match = /^(.+)\.png$/.exec(c.req.param("idPng"));
    if (!match?.[1]) return c.notFound();
    const id = match[1];
    const cacheKey = `texto:${id}`;
    const cached = pngCache.get(cacheKey);
    if (cached) return c.body(Uint8Array.from(cached), 200, PNG_HEADERS);
    if (!chargeOgRender(c)) return c.json({ error: "Espera un minuto." }, 429);

    const texto = textos.find((t) => t.id === id);
    const figura = texto && figuras.find((f) => f.id === texto.figura);
    if (!texto || !figura) return c.notFound();
    const verdict = await verdictFor(texto);
    const png = ogTexto(texto, figura, verdict);
    pngCache.set(cacheKey, png);
    return c.body(Uint8Array.from(png), 200, PNG_HEADERS);
  });

  // --- SEO: server-render OG/Twitter meta for the SPA shell, before the static fallback --

  if (deps.indexHtml) {
    const indexHtml = deps.indexHtml;
    const defaultImage = figuras[0]
      ? `${publicOrigin}/og/figura/${figuras[0].id}.png`
      : `${publicOrigin}/favicon.ico`;
    const meta = (title: string, description: string, image: string, url: string): SeoMeta => ({
      title,
      description,
      image,
      url,
    });
    const siteMeta = (): SeoMeta =>
      meta(
        "Promesómetro",
        "No mide verdad. Mide compromiso. El mismo juez para todos, frase por frase.",
        defaultImage,
        `${publicOrigin}/`,
      );

    app.get("/", (c) => c.html(renderIndex(indexHtml, siteMeta())));

    app.get("/figura/:id", async (c) => {
      const figura = figuras.find((f) => f.id === c.req.param("id"));
      if (!figura) return c.html(renderIndex(indexHtml, siteMeta()));
      const m = metricsFor(
        await mapLimit(
          textos.filter((t) => t.figura === figura.id),
          2,
          verdictFor,
        ),
      );
      return c.html(
        renderIndex(
          indexHtml,
          meta(
            `${figura.nombre} · Promesómetro`,
            `${figura.cargo}. Humo ${Math.round(m.humo * 100)}% · ${m.medibles} medibles · ${Math.round(m.ataques * 100)}% ataques.`,
            `${publicOrigin}/og/figura/${figura.id}.png`,
            `${publicOrigin}/figura/${figura.id}`,
          ),
        ),
      );
    });

    app.get("/texto/:id", async (c) => {
      const texto = textos.find((t) => t.id === c.req.param("id"));
      const figura = texto && figuras.find((f) => f.id === texto.figura);
      if (!texto || !figura) return c.html(renderIndex(indexHtml, siteMeta()));
      return c.html(
        renderIndex(
          indexHtml,
          meta(
            `${texto.titulo} · Promesómetro`,
            `${figura.nombre}, ${texto.fecha}.`,
            `${publicOrigin}/og/texto/${texto.id}.png`,
            `${publicOrigin}/texto/${texto.id}`,
          ),
        ),
      );
    });

    app.get("/frase/:textoId/:n", async (c) => {
      const texto = textos.find((t) => t.id === c.req.param("textoId"));
      const figura = texto && figuras.find((f) => f.id === texto.figura);
      const n = Number(c.req.param("n"));
      if (!texto || !figura || Number.isNaN(n)) return c.html(renderIndex(indexHtml, siteMeta()));
      const verdict = await verdictFor(texto);
      const segment = verdict.segments[n];
      if (!segment) return c.html(renderIndex(indexHtml, siteMeta()));
      return c.html(
        renderIndex(
          indexHtml,
          meta(
            `«${segment.text.slice(0, 80)}» · Promesómetro`,
            `${figura.nombre}, ${texto.fecha}. Nivel ${segment.nivel} de 4.`,
            `${publicOrigin}/og/frase/${texto.id}/${n}.png`,
            `${publicOrigin}/frase/${texto.id}/${n}`,
          ),
        ),
      );
    });

    app.get("/acta/:hash", async (c) => {
      const v = await docs.get(c.req.param("hash"));
      if (!v) return c.html(renderIndex(indexHtml, siteMeta()));
      return c.html(
        renderIndex(
          indexHtml,
          meta(
            `${v.title ?? "Acta"} · Promesómetro`,
            `Concreción media ${v.resumen.concrecionMedia.toFixed(2)}/4 · ${v.resumen.medibles} compromisos medibles.`,
            defaultImage,
            `${publicOrigin}/acta/${v.hash}`,
          ),
        ),
      );
    });
  }

  return app;
}

/** Judge every ingested texto so the ranking and OG images are warm before first traffic. */
export async function warmFiguras(deps: AppDeps): Promise<void> {
  const docs = new VerdictCache<DocumentVerdict>(deps.cacheDir);
  for (const texto of deps.textos ?? []) {
    try {
      const key = hashDocument(texto.text, deps.engine);
      let v = await docs.get(key);
      if (!v) {
        v = await analyzeDocument(deps.decider, texto.text, {
          title: texto.titulo,
          source: texto.source,
          maxSegments: MAX_SEGMENTS,
        });
        await docs.set(key, v);
      }
      console.log(`${texto.figura}/${texto.id} · ${v.segments.length} frases`);
    } catch (err) {
      // One bad texto (e.g. a transient judge failure) must never abort warming the rest.
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${texto.figura}/${texto.id} · error: ${message}`);
    }
  }
}
