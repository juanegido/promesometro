import { describe, expect, it } from "vitest";
import {
  deltaFor,
  humoDelDia,
  inWindow,
  latestDate,
  metricsFor,
  shiftDate,
  type TextoMeta,
} from "./figuras.js";
import type { DocumentVerdict, SegmentVerdict } from "./types.js";

function seg(overrides: Partial<SegmentVerdict>): SegmentVerdict {
  return {
    id: 0,
    paragraph: 0,
    text: "texto de ejemplo",
    concrecion: 0,
    nivel: 0,
    tipo: "valor",
    tema: "otro",
    verificable: 0,
    tono: 0,
    confianza: 0.5,
    ...overrides,
  };
}

function mkVerdict(segments: Partial<SegmentVerdict>[]): DocumentVerdict {
  const built = segments.map((s, i) => seg({ id: i, ...s }));
  return {
    engine: "test",
    hash: `h${built.length}-${Math.random()}`,
    title: null,
    source: null,
    createdAt: new Date().toISOString(),
    resumen: {
      segmentos: built.length,
      palabras: 0,
      compromisos: 0,
      medibles: 0,
      concrecionMedia: 0,
      verificableMedia: 0,
      tonoMedio: 0,
      confianzaMedia: 0,
      porTipo: { compromiso: 0, diagnostico: 0, valor: 0, ataque: 0, relleno: 0 },
      porTema: {
        economia: { n: 0, concrecion: 0 },
        seguridad: { n: 0, concrecion: 0 },
        salud: { n: 0, concrecion: 0 },
        educacion: { n: 0, concrecion: 0 },
        vivienda: { n: 0, concrecion: 0 },
        ambiente: { n: 0, concrecion: 0 },
        instituciones: { n: 0, concrecion: 0 },
        social: { n: 0, concrecion: 0 },
        exterior: { n: 0, concrecion: 0 },
        otro: { n: 0, concrecion: 0 },
      },
      niveles: [0, 0, 0, 0, 0],
    },
    segments: built,
    compromisosMedibles: built.filter((s) => s.tipo === "compromiso" && s.nivel >= 3),
  };
}

const texto = (over: Partial<TextoMeta>): TextoMeta => ({
  id: "t",
  figura: "trump",
  fecha: "2026-09-10",
  formato: "discurso",
  titulo: "Título",
  source: "https://example.org/x",
  lang: "es",
  ...over,
});

describe("metricsFor", () => {
  it("computes humo, medibles, ataques and concrecionMedia over all segments", () => {
    const v = mkVerdict([
      { tipo: "relleno", nivel: 0, concrecion: 0 },
      { tipo: "valor", nivel: 0, concrecion: 0 },
      { tipo: "compromiso", nivel: 1, concrecion: 1 },
      { tipo: "compromiso", nivel: 4, concrecion: 4 },
      { tipo: "ataque", nivel: 2, concrecion: 2 },
    ]);
    const m = metricsFor([v]);
    expect(m.textos).toBe(1);
    expect(m.frases).toBe(5);
    // non-relleno = 4, of which 2 are nivel<=1 (valor 0, compromiso 1)
    expect(m.humo).toBeCloseTo(2 / 4);
    expect(m.medibles).toBe(1);
    expect(m.ataques).toBeCloseTo(1 / 5);
    expect(m.concrecionMedia).toBeCloseTo((0 + 0 + 1 + 4 + 2) / 5);
  });

  it("is all zero on no verdicts", () => {
    const m = metricsFor([]);
    expect(m).toEqual({
      textos: 0,
      frases: 0,
      humo: 0,
      medibles: 0,
      ataques: 0,
      concrecionMedia: 0,
    });
  });
});

describe("deltaFor", () => {
  it("subtracts current minus previous", () => {
    // nivel 4 keeps this out of "humo" (which only counts nivel<=1) while still counting as an ataque.
    const a = metricsFor([mkVerdict([{ tipo: "ataque", nivel: 4, concrecion: 4 }])]);
    const b = metricsFor([]);
    const d = deltaFor(a, b);
    expect(d.ataques).toBeCloseTo(1);
    expect(d.humo).toBeCloseTo(0);
    expect(d.medibles).toBe(0);
  });
});

describe("shiftDate", () => {
  it("shifts across month and year boundaries", () => {
    expect(shiftDate("2026-09-21", -30)).toBe("2026-08-22");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2026-09-21", 10)).toBe("2026-10-01");
  });
});

describe("inWindow", () => {
  const textos = [
    texto({ id: "a", fecha: "2026-09-21" }),
    texto({ id: "b", fecha: "2026-08-23" }),
    texto({ id: "boundary", fecha: "2026-08-22" }),
    texto({ id: "c", fecha: "2026-08-21" }),
    texto({ id: "d", fecha: "2026-07-01" }),
  ];
  it("keeps texts strictly after until-30 (exclusive) and up to until (inclusive)", () => {
    const w = inWindow(textos, "2026-09-21");
    expect(w.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("latestDate", () => {
  it("returns the max fecha, or null when empty", () => {
    expect(latestDate([texto({ fecha: "2026-09-01" }), texto({ fecha: "2026-09-21" })])).toBe(
      "2026-09-21",
    );
    expect(latestDate([])).toBeNull();
  });
});

describe("humoDelDia", () => {
  it("picks the vaguest valor/compromiso, the most hostile segment and the most concrete medible", () => {
    const fecha = "2026-09-21";
    const t1 = texto({ id: "t1", figura: "trump", fecha });
    const t2 = texto({ id: "t2", figura: "sanchez", fecha });
    const other = texto({ id: "t3", figura: "petro", fecha: "2026-09-01" });

    const v1 = mkVerdict([
      { tipo: "valor", nivel: 0, concrecion: 0.1, tono: 1, confianza: 0.6 },
      { tipo: "compromiso", nivel: 4, concrecion: 4, tono: 0, confianza: 0.5 },
    ]);
    const v2 = mkVerdict([
      { tipo: "ataque", nivel: 0, concrecion: 0, tono: 3, confianza: 0.9 },
      { tipo: "compromiso", nivel: 3, concrecion: 3.5, tono: 0, confianza: 0.5 },
    ]);
    const vOther = mkVerdict([
      { tipo: "ataque", nivel: 0, concrecion: 0, tono: 3.9, confianza: 1 },
    ]);

    const r = humoDelDia(
      [
        { texto: t1, verdict: v1 },
        { texto: t2, verdict: v2 },
        { texto: other, verdict: vOther },
      ],
      fecha,
    );
    expect(r.humo?.figura).toBe("trump");
    expect(r.beligerante?.figura).toBe("sanchez");
    expect(r.medible?.figura).toBe("trump");
  });

  it("returns nulls when nothing matches that day", () => {
    const r = humoDelDia([], "2026-09-21");
    expect(r).toEqual({ humo: null, beligerante: null, medible: null });
  });
});
