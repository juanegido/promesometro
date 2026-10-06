import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Figura } from "@jev/rhetoric";
import { HeuristicDecider, hashDocument } from "@jev/rhetoric";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { TextoEntry } from "./figuras.js";

const app = createApp({
  decider: new HeuristicDecider(),
  engine: "heuristico-es-v1",
  cacheDir: null,
  corpus: [
    {
      id: "demo",
      title: "Demo",
      author: "Nadie",
      country: "XX",
      date: "2026-01-01",
      kind: "sintetico",
      source: "https://example.org",
      text: "Construiremos 100 escuelas en dos años. Creemos en la educación pública para todos.",
    },
  ],
});

describe("api", () => {
  it("analyzes and caches by hash", async () => {
    const body = JSON.stringify({
      text: "Bajaremos el IVA al 4% en 2027 por decreto. Gracias a todos.",
    });
    const r1 = await app.request("/api/analyze", { method: "POST", body });
    expect(r1.status).toBe(200);
    const v1 = (await r1.json()) as { hash: string; createdAt: string };
    const r2 = await app.request(`/api/verdict/${v1.hash}`);
    expect(((await r2.json()) as { createdAt: string }).createdAt).toBe(v1.createdAt);
  });

  it("resolves the verdict hash when the model name differs from the engine label", async () => {
    // Production configures "jev-latest" but Jev answers with a concrete version.
    const aliased = createApp({
      decider: new HeuristicDecider(),
      engine: "jev-latest",
      cacheDir: null,
      corpus: [],
    });
    const body = JSON.stringify({
      text: "Bajaremos el IVA al 4% en 2027 por decreto. Gracias a todos.",
    });
    const r1 = await aliased.request("/api/analyze", { method: "POST", body });
    const v1 = (await r1.json()) as { hash: string; engine: string; createdAt: string };
    expect(v1.engine).not.toBe("jev-latest");
    const r2 = await aliased.request(`/api/verdict/${v1.hash}`);
    expect(r2.status).toBe(200);
    expect(((await r2.json()) as { createdAt: string }).createdAt).toBe(v1.createdAt);
    const r3 = await aliased.request("/api/analyze", { method: "POST", body });
    expect(((await r3.json()) as { createdAt: string }).createdAt).toBe(v1.createdAt);
  });

  it("backfills the verdict-hash alias for entries cached before aliasing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "promesometro-cache-"));
    const text = "Bajaremos el IVA al 4% en 2027 por decreto. Gracias a todos.";
    const key = hashDocument(text, "jev-latest");
    // Simulate a pre-fix cache: stored only under the engine-label key.
    const seeded = createApp({
      decider: new HeuristicDecider(),
      engine: "irrelevant",
      cacheDir: null,
      corpus: [],
    });
    const verdict = await (
      await seeded.request("/api/analyze", { method: "POST", body: JSON.stringify({ text }) })
    ).json();
    await writeFile(join(dir, `${key}.json`), JSON.stringify(verdict));

    const aliased = createApp({
      decider: new HeuristicDecider(),
      engine: "jev-latest",
      cacheDir: dir,
      corpus: [],
    });
    const hit = (await (
      await aliased.request("/api/analyze", { method: "POST", body: JSON.stringify({ text }) })
    ).json()) as { hash: string };
    expect(hit.hash).not.toBe(key);
    expect((await aliased.request(`/api/verdict/${hit.hash}`)).status).toBe(200);
    expect((await readdir(dir)).sort()).toEqual([`${key}.json`, `${hit.hash}.json`].sort());
  });

  it("rejects non-string compare fields with 400", async () => {
    const r = await app.request("/api/compare", {
      method: "POST",
      body: JSON.stringify({ antes: { text: "x" }, despues: 42 }),
    });
    expect(r.status).toBe(400);
  });

  it("rejects tiny and huge inputs", async () => {
    const small = await app.request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ text: "hola" }),
    });
    expect(small.status).toBe(400);
    const huge = await app.request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ text: "a ".repeat(30_000) }),
    });
    expect(huge.status).toBe(413);
  });

  it("compares", async () => {
    const r = await app.request("/api/compare", {
      method: "POST",
      body: JSON.stringify({
        antes: "Bajaremos los impuestos.",
        despues: "Subiremos los impuestos.",
      }),
    });
    expect(((await r.json()) as { movimiento: string }).movimiento).toBe("contradice");
  });

  it("serves the corpus with verdicts", async () => {
    const list = (await (await app.request("/api/corpus")).json()) as {
      id: string;
      text?: string;
    }[];
    expect(list[0]?.id).toBe("demo");
    expect(list[0]?.text).toBeUndefined();
    const one = (await (await app.request("/api/corpus/demo")).json()) as {
      verdict: { segments: unknown[] };
    };
    expect(one.verdict.segments.length).toBe(2);
  });

  it("rate limits by segments", async () => {
    const tight = createApp({
      decider: new HeuristicDecider(),
      engine: "h",
      cacheDir: null,
      corpus: [],
      rate: { capacity: 1, perSecond: 0 },
    });
    const r = await tight.request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        text: "Primera frase con contenido suficiente. Segunda frase con más contenido todavía.",
      }),
    });
    expect(r.status).toBe(429);
  });
});

const FIGURAS: Figura[] = [
  {
    id: "fig1",
    nombre: "Fig Uno",
    cargo: "Presidenta de Prueba",
    pais: "XX",
    lang: "es",
  },
  {
    id: "fig2",
    nombre: "Fig Dos",
    cargo: "Ministro de Prueba",
    pais: "XX",
    lang: "es",
  },
];

const TEXTOS: TextoEntry[] = [
  {
    id: "2026-09-10-a",
    figura: "fig1",
    fecha: "2026-09-10",
    formato: "discurso",
    titulo: "Discurso A",
    source: "https://example.org/a",
    lang: "es",
    text: "Trabajaremos por la sanidad pública. Vamos a bajar el IVA al 4% en 2027 por decreto.",
  },
  {
    id: "2026-09-11-b",
    figura: "fig1",
    fecha: "2026-09-11",
    formato: "post",
    titulo: "Post B",
    source: "https://example.org/b",
    lang: "es",
    text: "El gobierno anterior fue un desastre y dejó el país en la ruina.",
  },
];

const figApp = createApp({
  decider: new HeuristicDecider(),
  engine: "heuristico-es-v1",
  cacheDir: null,
  corpus: [],
  figuras: FIGURAS,
  textos: TEXTOS,
  publicOrigin: "http://localhost:8787",
});

describe("figuras", () => {
  it("GET /api/figuras returns metrics for every figure, sorted by humo desc", async () => {
    const r = await figApp.request("/api/figuras");
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      hasta: string;
      ventanaDias: number;
      figuras: { id: string; metrics: { frases: number }; ultimoTexto: string | null }[];
    };
    expect(body.hasta).toBe("2026-09-11");
    expect(body.ventanaDias).toBe(30);
    expect(body.figuras).toHaveLength(2);
    const fig1 = body.figuras.find((f) => f.id === "fig1");
    const fig2 = body.figuras.find((f) => f.id === "fig2");
    expect(fig1?.metrics.frases).toBeGreaterThan(0);
    expect(fig1?.ultimoTexto).toBe("2026-09-11");
    expect(fig2?.metrics.frases).toBe(0);
    expect(fig2?.ultimoTexto).toBeNull();
    // Figures with zero frases in the window sort last, regardless of humo.
    expect(body.figuras.map((f) => f.id)).toEqual(["fig1", "fig2"]);
  });

  it("keeps a figure with data (even at humo 0) ahead of an empty one, despite name order", async () => {
    // "Adelita" sorts alphabetically before "Zeta", which is the wrong order here: the
    // figure with real frases (Zeta, humo 0) must still rank above the empty one (Adelita).
    const app2 = createApp({
      decider: new HeuristicDecider(),
      engine: "heuristico-es-v1",
      cacheDir: null,
      corpus: [],
      figuras: [
        { id: "adelita", nombre: "Adelita Vacía", cargo: "Nadie", pais: "XX", lang: "es" },
        { id: "zeta", nombre: "Zeta Con Datos", cargo: "Alguien", pais: "XX", lang: "es" },
      ],
      textos: [
        {
          id: "2026-09-10-z",
          figura: "zeta",
          fecha: "2026-09-10",
          formato: "discurso",
          titulo: "Discurso Z",
          source: "https://example.org/z",
          lang: "es",
          // "Aprobaremos" + "una ley de transparencia" is nivel 2 (accion, no cifra/plazo):
          // it does not count toward humo (nivel<=1), so this figure's humo is exactly 0.
          text: "Aprobaremos una ley de transparencia.",
        },
      ],
    });
    const r = await app2.request("/api/figuras");
    const body = (await r.json()) as { figuras: { id: string; metrics: { frases: number } }[] };
    expect(body.figuras.map((f) => f.id)).toEqual(["zeta", "adelita"]);
    expect(body.figuras.find((f) => f.id === "zeta")?.metrics.frases).toBeGreaterThan(0);
  });

  it("GET /api/figuras/:id returns figura, metrics, delta and textos with resumen", async () => {
    const r = await figApp.request("/api/figuras/fig1");
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      figura: { id: string };
      textos: { id: string; palabras: number; resumen: { segmentos: number } }[];
    };
    expect(body.figura.id).toBe("fig1");
    expect(body.textos).toHaveLength(2);
    expect(body.textos[0]?.resumen.segmentos).toBeGreaterThan(0);
  });

  it("GET /api/figuras/:id 404s on an unknown id", async () => {
    expect((await figApp.request("/api/figuras/unknown")).status).toBe(404);
  });

  it("GET /api/textos/:id returns texto, figura and verdict; 404s otherwise", async () => {
    const r = await figApp.request("/api/textos/2026-09-10-a");
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      texto: { id: string };
      figura: { id: string };
      verdict: { segments: unknown[] };
    };
    expect(body.texto.id).toBe("2026-09-10-a");
    expect(body.figura.id).toBe("fig1");
    expect(body.verdict.segments.length).toBeGreaterThan(0);
    expect((await figApp.request("/api/textos/unknown")).status).toBe(404);
  });

  it("GET /api/humo returns the latest day's headline segments with figuraNombre", async () => {
    const r = await figApp.request("/api/humo");
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      fecha: string;
      beligerante: { figuraNombre: string } | null;
    };
    expect(body.fecha).toBe("2026-09-11");
    expect(body.beligerante?.figuraNombre).toBe("Fig Uno");
  });

  it("GET /og/frase/:textoId/:n.png returns a PNG", async () => {
    const r = await figApp.request("/og/frase/2026-09-10-a/0.png");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("rate limits OG rendering on cache miss, but cache hits stay free", async () => {
    const tight = createApp({
      decider: new HeuristicDecider(),
      engine: "heuristico-es-v1",
      cacheDir: null,
      corpus: [],
      figuras: FIGURAS,
      textos: TEXTOS,
      rate: { capacity: 2, perSecond: 0 },
    });
    const first = await tight.request("/og/frase/2026-09-10-a/0.png");
    expect(first.status).toBe(200); // costs 2, bucket now empty
    const second = await tight.request("/og/frase/2026-09-11-b/0.png");
    expect(second.status).toBe(429); // different route, still a cache miss: exhausted
    const cachedAgain = await tight.request("/og/frase/2026-09-10-a/0.png");
    expect(cachedAgain.status).toBe(200); // already cached: free, no charge
  });
});

describe("seo", () => {
  const INDEX_HTML = `<!doctype html><html><head><title>Promesómetro</title></head><body><div id="app"></div></body></html>`;
  const seoApp = createApp({
    decider: new HeuristicDecider(),
    engine: "heuristico-es-v1",
    cacheDir: null,
    corpus: [],
    figuras: FIGURAS,
    textos: TEXTOS,
    publicOrigin: "http://localhost:8787",
    indexHtml: INDEX_HTML,
  });

  it("injects og:image and an escaped title for a known figura", async () => {
    const r = await seoApp.request("/figura/fig1");
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain(
      '<meta property="og:image" content="http://localhost:8787/og/figura/fig1.png">',
    );
    expect(html).toContain("<title>Fig Uno · Promesómetro</title>");
  });

  it("falls back to default meta (still 200) for an unknown id", async () => {
    const r = await seoApp.request("/figura/unknown");
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("<title>Promesómetro</title>");
  });
});
