import type { DocumentVerdict, SegmentVerdict } from "./types.js";

/** A tracked public figure. */
export interface Figura {
  id: string;
  nombre: string;
  cargo: string;
  pais: string;
  lang: "es" | "en";
}

export type Formato =
  | "discurso"
  | "rueda"
  | "declaracion"
  | "post"
  | "decreto"
  | "entrevista"
  | "sesion";

/** Provenance for one ingested text, without the text body itself. */
export interface TextoMeta {
  id: string;
  figura: string;
  /** YYYY-MM-DD */
  fecha: string;
  formato: Formato;
  titulo: string;
  source: string;
  lang: "es" | "en";
  pregunta?: string;
}

export interface FiguraMetrics {
  textos: number;
  frases: number;
  humo: number;
  medibles: number;
  ataques: number;
  concrecionMedia: number;
}

export interface FiguraDelta {
  humo: number;
  medibles: number;
  ataques: number;
}

/**
 * Human label for a concreción `nivel`, indexed by nivel (0-4). Shared by the OG cards and
 * the Frase view so "humo" always means the same thing everywhere. `relleno` segments are
 * excluded from the humo metric by definition and get their own neutral badge in callers.
 */
export const NIVEL_ETIQUETA = ["humo", "humo", "medida", "medible", "medible"] as const;

export const METRICAS = {
  humo: "Porcentaje de frases con contenido político (sin relleno) que se quedan en nivel 0 o 1: valores, diagnóstico, intención sin medida.",
  medibles:
    "Número de frases de tipo compromiso en nivel 3 o 4: llevan cifra, plazo o instrumento y se pueden comprobar.",
  ataques: "Porcentaje de frases de tipo ataque: critican o descalifican a un adversario.",
  ventana:
    "Ventana de 30 días que termina en la fecha del texto más reciente del ranking. La variación compara con la misma ventana cerrada el día anterior.",
} as const;

function allSegments(verdicts: DocumentVerdict[]): SegmentVerdict[] {
  return verdicts.flatMap((v) => v.segments);
}

/** Aggregate metrics over every judged text of a figure. */
export function metricsFor(verdicts: DocumentVerdict[]): FiguraMetrics {
  const segments = allSegments(verdicts);
  const frases = segments.length;
  const noRelleno = segments.filter((s) => s.tipo !== "relleno");
  const humoN = noRelleno.filter((s) => s.nivel <= 1).length;
  const medibles = segments.filter((s) => s.tipo === "compromiso" && s.nivel >= 3).length;
  const ataquesN = segments.filter((s) => s.tipo === "ataque").length;
  return {
    textos: verdicts.length,
    frases,
    humo: noRelleno.length ? humoN / noRelleno.length : 0,
    medibles,
    ataques: frases ? ataquesN / frases : 0,
    concrecionMedia: frases ? segments.reduce((a, s) => a + s.concrecion, 0) / frases : 0,
  };
}

/** Simple current-minus-previous difference. */
export function deltaFor(current: FiguraMetrics, previous: FiguraMetrics): FiguraDelta {
  return {
    humo: current.humo - previous.humo,
    medibles: current.medibles - previous.medibles,
    ataques: current.ataques - previous.ataques,
  };
}

function toUtcDays(date: string): number {
  return Date.UTC(...(date.split("-").map(Number) as [number, number, number])) / 86_400_000;
}

/** Shift a YYYY-MM-DD date by `days` (may be negative). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Texts published after (until - days) and up to and including `until`. */
export function inWindow<T extends TextoMeta>(textos: T[], until: string, days = 30): T[] {
  const from = toUtcDays(shiftDate(until, -days));
  const to = toUtcDays(until);
  return textos.filter((t) => {
    const d = toUtcDays(t.fecha);
    return d > from && d <= to;
  });
}

/** Most recent `fecha` across the given texts, or null when empty. */
export function latestDate(textos: TextoMeta[]): string | null {
  if (textos.length === 0) return null;
  return textos.reduce(
    (latest, t) => (t.fecha > latest ? t.fecha : latest),
    textos[0]?.fecha as string,
  );
}

export interface FraseDestacada {
  figura: string;
  texto: TextoMeta;
  segment: SegmentVerdict;
}

/**
 * The day's three headline segments across every figure's texts published that day:
 * the vaguest declared promise or value ("humo"), the most hostile statement
 * ("beligerante"), and the most concrete measurable commitment ("medible").
 */
export function humoDelDia(
  items: { texto: TextoMeta; verdict: DocumentVerdict }[],
  fecha: string,
): {
  humo: FraseDestacada | null;
  beligerante: FraseDestacada | null;
  medible: FraseDestacada | null;
} {
  const today = items.filter((i) => i.texto.fecha === fecha);

  let humo: FraseDestacada | null = null;
  let beligerante: FraseDestacada | null = null;
  let medible: FraseDestacada | null = null;

  for (const { texto, verdict } of today) {
    for (const segment of verdict.segments) {
      if ((segment.tipo === "compromiso" || segment.tipo === "valor") && segment.nivel <= 1) {
        if (
          !humo ||
          segment.concrecion < humo.segment.concrecion ||
          (segment.concrecion === humo.segment.concrecion &&
            segment.confianza > humo.segment.confianza)
        ) {
          humo = { figura: texto.figura, texto, segment };
        }
      }

      if (segment.tipo !== "relleno") {
        if (
          !beligerante ||
          segment.tono > beligerante.segment.tono ||
          (segment.tono === beligerante.segment.tono &&
            segment.confianza > beligerante.segment.confianza)
        ) {
          beligerante = { figura: texto.figura, texto, segment };
        }
      }

      if (segment.tipo === "compromiso" && segment.nivel >= 3) {
        if (!medible || segment.concrecion > medible.segment.concrecion) {
          medible = { figura: texto.figura, texto, segment };
        }
      }
    }
  }

  return { humo, beligerante, medible };
}
