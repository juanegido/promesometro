import type { DocumentVerdict, Figura, SegmentVerdict, TextoMeta } from "@jev/rhetoric";
import { describe, expect, it } from "vitest";
import { buildFraseSvg, ogFigura, ogFrase, ogTexto, PngCache } from "./og.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const figura: Figura = {
  id: "trump",
  nombre: "Donald Trump",
  cargo: "Presidente de los Estados Unidos",
  pais: "US",
  lang: "en",
};

const texto: TextoMeta = {
  id: "2026-09-16-x",
  figura: "trump",
  fecha: "2026-09-16",
  formato: "discurso",
  titulo: "Un discurso cualquiera",
  source: "https://www.whitehouse.gov/x",
  lang: "en",
};

const segment: SegmentVerdict = {
  id: 0,
  paragraph: 0,
  text: "Vamos a bajar los impuestos a la clase media en el primer año de gobierno.",
  concrecion: 3.2,
  nivel: 3,
  tipo: "compromiso",
  tema: "economia",
  verificable: 0.8,
  tono: 1,
  confianza: 0.7,
};

const verdict: DocumentVerdict = {
  engine: "test",
  hash: "abc123",
  title: texto.titulo,
  source: texto.source,
  createdAt: new Date().toISOString(),
  resumen: {
    segmentos: 2,
    palabras: 20,
    compromisos: 0.5,
    medibles: 1,
    concrecionMedia: 2.1,
    verificableMedia: 0.5,
    tonoMedio: 1,
    confianzaMedia: 0.6,
    porTipo: { compromiso: 1, diagnostico: 0, valor: 1, ataque: 0, relleno: 0 },
    porTema: {
      economia: { n: 1, concrecion: 3.2 },
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
    niveles: [0, 0, 0, 1, 0],
  },
  segments: [segment],
  compromisosMedibles: [segment],
};

describe("og image rendering", () => {
  it("ogFrase renders a PNG with a long quote wrapped", () => {
    const buf = ogFrase(texto, { ...segment, text: segment.text.repeat(3) }, figura, 0);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });

  it("ogFigura renders a PNG", () => {
    const buf = ogFigura(figura, {
      textos: 2,
      frases: 10,
      humo: 0.4,
      medibles: 3,
      ataques: 0.1,
      concrecionMedia: 2.1,
    });
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });

  it("ogTexto renders a PNG", () => {
    const buf = ogTexto(texto, figura, verdict);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });

  it("badges a relleno segment as RELLENO regardless of nivel", () => {
    const svg = buildFraseSvg(texto, { ...segment, tipo: "relleno", nivel: 0 }, figura, 0);
    expect(svg).toContain("RELLENO");
    expect(svg).not.toContain("HUMO");
  });
});

describe("XML escaping in SVG builders", () => {
  const xssFigura: Figura = { ...figura, nombre: 'Trump <script>alert(1)</script> & "Co"' };
  const xssSegment: SegmentVerdict = { ...segment, text: 'Dice "<b>esto</b>" & más cosas' };

  it("buildFraseSvg escapes hostile figura/segment text instead of emitting raw tags", () => {
    const svg = buildFraseSvg(texto, xssSegment, xssFigura, 0);
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;Co&quot;");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>esto</b>");
  });

  it("still renders a valid PNG when the content is hostile", () => {
    const buf = ogFrase(texto, xssSegment, xssFigura, 0);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });
});

describe("PngCache", () => {
  it("stores and evicts oldest entries beyond max", () => {
    const cache = new PngCache(2);
    cache.set("a", Buffer.from("a"));
    cache.set("b", Buffer.from("b"));
    cache.set("c", Buffer.from("c"));
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")?.toString()).toBe("b");
    expect(cache.get("c")?.toString()).toBe("c");
  });
});
