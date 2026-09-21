import type { CompareVerdict, DocumentVerdict } from "@jev/rhetoric";

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
};
