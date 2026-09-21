import { createHash } from "node:crypto";
import { confidenceOf, type Decider } from "@jev/decide";
import type { ScoreResponse } from "@typesafe-ai/sdk";
import {
  compareQuestions,
  segmentQuestions,
  TEMA,
  type Tema,
  TIPO,
  type Tipo,
} from "./questions.js";
import { segmentDocument, wordCount } from "./segment.js";
import type { CompareVerdict, DocumentVerdict, Resumen, Segment, SegmentVerdict } from "./types.js";

export interface AnalyzeOptions {
  title?: string | null;
  source?: string | null;
  /** Parallel Jev calls. Default 8. */
  concurrency?: number;
  maxSegments?: number;
  /** Extra context Jev sees with every segment, e.g. the document title. */
  contexto?: string;
}

function argmax(probabilities: Record<string, number>): number {
  let best = 0;
  let bestP = -1;
  for (const [k, p] of Object.entries(probabilities)) {
    if (p > bestP) {
      bestP = p;
      best = Number(k);
    }
  }
  return best;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
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

export async function judgeSegment(
  decider: Decider,
  segment: Segment,
  contexto?: string,
): Promise<{ verdict: SegmentVerdict; engine: string }> {
  const state = contexto ? { texto: segment.text, contexto } : { texto: segment.text };
  const { answers, model } = await decider.systemOne({ state, questions: segmentQuestions });
  const conf =
    Object.values(answers).reduce((acc, a) => acc + confidenceOf(a), 0) /
    Object.keys(answers).length;
  return {
    engine: model,
    verdict: {
      ...segment,
      concrecion: answers.concrecion.score,
      nivel: argmax(answers.concrecion.probabilities) as SegmentVerdict["nivel"],
      tipo: answers.tipo.choice,
      tema: answers.tema.choice,
      verificable: answers.verificable.noul,
      tono: answers.tono.score,
      confianza: conf,
    },
  };
}

export function summarize(segments: SegmentVerdict[]): Resumen {
  const n = segments.length;
  const mean = (f: (s: SegmentVerdict) => number) =>
    n ? segments.reduce((a, s) => a + f(s), 0) / n : 0;
  const porTipo = Object.fromEntries(Object.keys(TIPO).map((k) => [k, 0])) as Record<Tipo, number>;
  const porTema = Object.fromEntries(
    Object.keys(TEMA).map((k) => [k, { n: 0, concrecion: 0 }]),
  ) as Record<Tema, { n: number; concrecion: number }>;
  const niveles: Resumen["niveles"] = [0, 0, 0, 0, 0];
  for (const s of segments) {
    porTipo[s.tipo]++;
    porTema[s.tema].n++;
    porTema[s.tema].concrecion += s.concrecion;
    niveles[s.nivel]++;
  }
  for (const t of Object.values(porTema)) if (t.n) t.concrecion /= t.n;
  return {
    segmentos: n,
    palabras: segments.reduce((a, s) => a + wordCount(s.text), 0),
    compromisos: n ? porTipo.compromiso / n : 0,
    medibles: niveles[3] + niveles[4],
    concrecionMedia: mean((s) => s.concrecion),
    verificableMedia: mean((s) => s.verificable),
    tonoMedio: mean((s) => s.tono),
    confianzaMedia: mean((s) => s.confianza),
    porTipo,
    porTema,
    niveles,
  };
}

export function hashDocument(text: string, engine: string): string {
  return createHash("sha256").update(`${engine}\n${text}`).digest("hex").slice(0, 16);
}

/** Judge every segment of a document with Jev and aggregate. */
export async function analyzeDocument(
  decider: Decider,
  text: string,
  options: AnalyzeOptions = {},
): Promise<DocumentVerdict> {
  const segments = segmentDocument(text, options.maxSegments);
  if (segments.length === 0) throw new Error("El texto no contiene frases analizables");
  const contexto = options.contexto ?? options.title ?? undefined;
  const judged = await mapLimit(segments, options.concurrency ?? 8, (s) =>
    judgeSegment(decider, s, contexto),
  );
  const verdicts = judged.map((j) => j.verdict);
  const engine = judged[0]?.engine ?? "unknown";
  const compromisosMedibles = verdicts
    .filter((s) => s.tipo === "compromiso" && s.nivel >= 3)
    .sort((a, b) => b.concrecion - a.concrecion);
  return {
    engine,
    hash: hashDocument(text, engine),
    title: options.title ?? null,
    source: options.source ?? null,
    createdAt: new Date().toISOString(),
    resumen: summarize(verdicts),
    segments: verdicts,
    compromisosMedibles,
  };
}

/** Compare a promise with a later statement by the same author. */
export async function compareStatements(
  decider: Decider,
  antes: string,
  despues: string,
): Promise<CompareVerdict> {
  const { answers, model } = await decider.systemOne({
    state: { antes, despues },
    questions: compareQuestions,
  });
  const scores: ScoreResponse[] = [
    answers.consistencia,
    answers.concrecion_antes,
    answers.concrecion_despues,
  ];
  const conf = (answers.movimiento.confidence + scores.reduce((a, s) => a + s.confidence, 0)) / 4;
  return {
    engine: model,
    movimiento: answers.movimiento.choice,
    probabilidades: answers.movimiento.probabilities,
    consistencia: answers.consistencia.score,
    concrecionAntes: answers.concrecion_antes.score,
    concrecionDespues: answers.concrecion_despues.score,
    confianza: conf,
    antes,
    despues,
  };
}
