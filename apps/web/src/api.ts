import type {
  CompareVerdict,
  DocumentVerdict,
  Figura,
  FiguraDelta,
  FiguraMetrics,
  FraseDestacada,
  Resumen,
  TextoMeta,
} from "@jev/rhetoric";

export interface CorpusMeta {
  id: string;
  title: string;
  author: string;
  country: string;
  date: string;
  kind: "programa" | "discurso" | "declaracion" | "sintetico";
  source: string;
  note?: string;
  palabras: number;
  hash: string;
}

export interface Method {
  engine: string;
  CONCRECION: readonly string[];
  TIPO: Record<string, string>;
  TEMA: Record<string, string>;
  TONO: readonly string[];
  MOVIMIENTO: Record<string, string>;
  CONSISTENCIA: readonly string[];
  METRICAS: Record<string, string>;
}

export type FiguraConMetrics = Figura & {
  metrics: FiguraMetrics;
  delta: FiguraDelta;
  ultimoTexto: string | null;
};

export interface FigurasResponse {
  hasta: string | null;
  ventanaDias: number;
  figuras: FiguraConMetrics[];
}

export interface FiguraDetalle {
  figura: Figura;
  metrics: FiguraMetrics;
  delta: FiguraDelta;
  textos: (TextoMeta & { palabras: number; resumen: Resumen })[];
}

export interface TextoDetalle {
  texto: TextoMeta & { text: string };
  figura: Figura;
  verdict: DocumentVerdict;
}

export type FraseDestacadaOut = FraseDestacada & { figuraNombre: string };

export interface HumoResponse {
  fecha: string | null;
  humo: FraseDestacadaOut | null;
  beligerante: FraseDestacadaOut | null;
  medible: FraseDestacadaOut | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(body.error ?? `Error ${r.status}`);
  return body;
}

export const api = {
  health: () => call<{ ok: boolean; engine: string }>("/api/health"),
  method: () => call<Method>("/api/method"),
  analyze: (text: string, title?: string, source?: string) =>
    call<DocumentVerdict>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ text, title, source }),
    }),
  verdict: (hash: string) => call<DocumentVerdict>(`/api/verdict/${hash}`),
  compare: (antes: string, despues: string) =>
    call<CompareVerdict>("/api/compare", {
      method: "POST",
      body: JSON.stringify({ antes, despues }),
    }),
  corpus: () => call<CorpusMeta[]>("/api/corpus"),
  corpusEntry: (id: string) =>
    call<{ entry: CorpusMeta & { text: string }; verdict: DocumentVerdict }>(`/api/corpus/${id}`),
  figuras: () => call<FigurasResponse>("/api/figuras"),
  figura: (id: string) => call<FiguraDetalle>(`/api/figuras/${id}`),
  texto: (id: string) => call<TextoDetalle>(`/api/textos/${id}`),
  humo: () => call<HumoResponse>("/api/humo"),
};
