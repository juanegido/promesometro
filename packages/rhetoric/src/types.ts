import type { Movimiento, Tema, Tipo } from "./questions.js";

export interface Segment {
  id: number;
  paragraph: number;
  text: string;
}

export interface SegmentVerdict extends Segment {
  /** Expected concreción, 0..4, may be fractional. */
  concrecion: number;
  /** Most probable rubric level, 0..4. */
  nivel: 0 | 1 | 2 | 3 | 4;
  tipo: Tipo;
  tema: Tema;
  /** Probability the statement can be checked in four years. */
  verificable: number;
  /** Expected tone 0..3. */
  tono: number;
  /** Mean confidence across the segment's questions. */
  confianza: number;
}

export interface Resumen {
  segmentos: number;
  palabras: number;
  /** Share of segments typed as compromiso. */
  compromisos: number;
  /** Segments at level 3 or 4. */
  medibles: number;
  concrecionMedia: number;
  verificableMedia: number;
  tonoMedio: number;
  confianzaMedia: number;
  porTipo: Record<Tipo, number>;
  porTema: Record<Tema, { n: number; concrecion: number }>;
  niveles: [number, number, number, number, number];
}

export interface DocumentVerdict {
  engine: string;
  hash: string;
  title: string | null;
  source: string | null;
  createdAt: string;
  resumen: Resumen;
  segments: SegmentVerdict[];
  /** Segments at level 3+ typed as compromiso, ordered by concreción. */
  compromisosMedibles: SegmentVerdict[];
}

export interface CompareVerdict {
  engine: string;
  movimiento: Movimiento;
  probabilidades: Record<Movimiento, number>;
  consistencia: number;
  concrecionAntes: number;
  concrecionDespues: number;
  confianza: number;
  antes: string;
  despues: string;
}
