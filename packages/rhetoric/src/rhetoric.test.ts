import { FakeDecider } from "@jev/decide";
import { describe, expect, it } from "vitest";
import {
  analyzeDocument,
  compareStatements,
  concrecionLevel,
  HeuristicDecider,
  segmentDocument,
  summarize,
  tipoOf,
} from "./index.js";

const PROGRAMA = `Creemos en un país de oportunidades para todos.

Vamos a bajar el IVA de los alimentos básicos del 10% al 4% en los primeros 100 días mediante un decreto.
El gobierno anterior fue un desastre y dejó el país en la ruina. Trabajaremos por una sanidad pública de calidad.

- Construiremos 20.000 viviendas de alquiler asequible en cuatro años.
- Aprobaremos una ley de transparencia.`;

describe("segmentDocument", () => {
  it("splits into sentences, keeps paragraphs, merges fragments", () => {
    const segs = segmentDocument(PROGRAMA);
    expect(segs.length).toBeGreaterThanOrEqual(5);
    expect(segs[0]?.paragraph).toBe(0);
    expect(segs.every((s) => s.text.split(" ").length >= 3)).toBe(true);
    expect(segs.map((s) => s.id)).toEqual(segs.map((_, i) => i));
  });

  it("throws on empty input via analyzeDocument", async () => {
    await expect(analyzeDocument(new HeuristicDecider(), "   ")).rejects.toThrow();
  });
});

describe("heuristic rubric", () => {
  it("ranks concreción by presence of action, figure, deadline and instrument", () => {
    expect(concrecionLevel("La libertad y la patria son nuestros valores.")).toBe(0);
    expect(concrecionLevel("Trabajaremos por una sanidad de calidad.")).toBe(1);
    expect(concrecionLevel("Aprobaremos una ley de transparencia.")).toBe(2);
    expect(concrecionLevel("Construiremos 20.000 viviendas en cuatro años.")).toBe(3);
    expect(
      concrecionLevel(
        "Vamos a bajar el IVA del 10% al 4% en los primeros 100 días mediante un decreto.",
      ),
    ).toBe(4);
  });

  it("types statements", () => {
    expect(tipoOf("El gobierno anterior fue un desastre y dejó el país en la ruina.")).toBe(
      "ataque",
    );
    expect(tipoOf("Muchas gracias a todos por venir.")).toBe("relleno");
    expect(tipoOf("Aprobaremos una ley de transparencia.")).toBe("compromiso");
    expect(tipoOf("Los que gobernaron antes son unos incompetentes que saquearon las arcas.")).toBe(
      "ataque",
    );
  });
});

describe("temaOf", () => {
  it("maps fiscal and safety vocabulary", async () => {
    const { temaOf } = await import("./index.js");
    expect(temaOf("Reduciremos el IRPF a las rentas medias.")).toBe("economia");
    expect(temaOf("Trabajaremos por barrios más seguros.")).toBe("seguridad");
  });
});

describe("analyzeDocument", () => {
  it("aggregates per level, tipo and tema, and extracts measurable commitments", async () => {
    const v = await analyzeDocument(new HeuristicDecider(), PROGRAMA, { title: "Programa" });
    expect(v.engine).toBe("heuristico-es-v1");
    expect(v.resumen.segmentos).toBe(v.segments.length);
    expect(v.resumen.niveles.reduce((a, b) => a + b, 0)).toBe(v.segments.length);
    expect(v.compromisosMedibles.length).toBeGreaterThanOrEqual(2);
    expect(v.compromisosMedibles[0]?.nivel).toBe(4);
    expect(v.resumen.porTema.economia.n).toBeGreaterThan(0);
    expect(v.hash).toHaveLength(16);
  });

  it("works with any Decider, including scripted fakes", async () => {
    const fake = new FakeDecider({
      concrecion: 3,
      tipo: "compromiso",
      tema: "salud",
      verificable: true,
      tono: 1,
    });
    const v = await analyzeDocument(
      fake,
      "Contrataremos mil médicos este año. Y después otros mil más.",
    );
    expect(v.segments.every((s) => s.tema === "salud")).toBe(true);
    expect(v.resumen.compromisos).toBe(1);
    expect(fake.calls.length).toBe(v.segments.length);
  });

  it("summarize on empty list is all zeros", () => {
    expect(summarize([]).concrecionMedia).toBe(0);
  });
});

describe("compareStatements", () => {
  it("detects a reversal", async () => {
    const v = await compareStatements(
      new HeuristicDecider(),
      "Vamos a bajar los impuestos a la clase media.",
      "Vamos a subir los impuestos para cuadrar las cuentas.",
    );
    expect(v.movimiento).toBe("contradice");
    expect(v.consistencia).toBeLessThan(1.5);
  });

  it("reads conjugated reversals within the same topic", async () => {
    const v = await compareStatements(
      new HeuristicDecider(),
      "Bajaremos los impuestos a la clase media en el primer año.",
      "Haremos los ajustes fiscales que la situación exija, subiendo lo que haga falta.",
    );
    expect(v.movimiento).toBe("contradice");
  });

  it("detects concretion as cumple", async () => {
    const v = await compareStatements(
      new HeuristicDecider(),
      "Trabajaremos por más vivienda pública.",
      "Construiremos 20.000 viviendas públicas en 2027 con el fondo estatal de vivienda.",
    );
    expect(v.movimiento).toBe("cumple");
  });
});
