import { HeuristicDecider } from "@jev/rhetoric";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

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
