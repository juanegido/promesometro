import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  extract,
  extractBody,
  extractFecha,
  extractParagraphs,
  extractTitulo,
} from "./extract.js";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("Ni&ntilde;o &amp; ma&ntilde;ana")).toBe("Niño & mañana");
    expect(decodeEntities("&#243;rgano")).toBe("órgano");
    expect(decodeEntities("&#x1F600; hola")).toBe("😀 hola");
  });
});

describe("extractBody", () => {
  it("prefers <article>, strips scripts, nav and comments", () => {
    const html = `<html><body><nav>menu</nav><article><!-- c --><script>x()</script><p>Hola mundo, esto es un párrafo.</p></article><footer>pie</footer></body></html>`;
    const body = extractBody(html);
    expect(body).toContain("párrafo");
    expect(body).not.toContain("menu");
    expect(body).not.toContain("script");
    expect(body).not.toContain("pie");
  });

  it("falls back to <main> then <body>", () => {
    const main = `<html><body><main><p>Contenido del main, con suficiente longitud.</p></main></body></html>`;
    expect(extractBody(main)).toContain("Contenido del main");
    const bodyOnly = `<html><body><p>Solo hay body aquí, sin main ni article.</p></body></html>`;
    expect(extractBody(bodyOnly)).toContain("Solo hay body");
  });

  it("picks the article with the most paragraphs, skipping a teaser/related block", () => {
    const html = `<html><body>
      <article><p>Teaser corto de otra noticia relacionada.</p></article>
      <article>
        <p>Primer párrafo del discurso real, con contenido suficiente.</p>
        <p>Segundo párrafo del discurso real, también con contenido.</p>
        <p>Tercer párrafo del discurso real, cerrando la idea.</p>
      </article>
    </body></html>`;
    const body = extractBody(html);
    expect(body).toContain("discurso real");
    expect(body).not.toContain("Teaser corto");
  });
});

describe("extractTitulo", () => {
  it("prefers h1 over title", () => {
    const html = `<html><head><title>Título de pestaña</title></head><body><h1>Título real</h1></body></html>`;
    expect(extractTitulo(html)).toBe("Título real");
  });
  it("falls back to <title>", () => {
    const html = `<html><head><title>Solo título</title></head><body><p>x</p></body></html>`;
    expect(extractTitulo(html)).toBe("Solo título");
  });
  it("returns null with neither", () => {
    expect(extractTitulo("<html><body><p>x</p></body></html>")).toBeNull();
  });
});

describe("extractFecha", () => {
  it("reads JSON-LD datePublished", () => {
    const html = `<script type="application/ld+json">{"datePublished":"2026-09-16T10:00:00Z"}</script>`;
    expect(extractFecha(html, "https://example.org/x")).toBe("2026-09-16");
  });
  it("reads Moncloa-style YYYYMMDD- from the URL", () => {
    const url =
      "https://www.lamoncloa.gob.es/presidente/intervenciones/Paginas/2026/20260916-transcripcion.aspx";
    expect(extractFecha("<html></html>", url)).toBe("2026-09-16");
  });
  it("returns null when the day is unknown", () => {
    const url = "https://www.whitehouse.gov/presidential-actions/2026/09/something/";
    expect(extractFecha("<html></html>", url)).toBeNull();
  });
});

describe("extractParagraphs", () => {
  it("extracts p and li text, drops short and boilerplate lines", () => {
    const html = `
      <p>Esta es una frase suficientemente larga para contar.</p>
      <p>Corto</p>
      <li>Este elemento de lista también tiene contenido real y largo.</li>
      <p>Compartir en redes sociales ahora mismo</p>
    `;
    const paras = extractParagraphs(html);
    expect(paras).toEqual([
      "Esta es una frase suficientemente larga para contar.",
      "Este elemento de lista también tiene contenido real y largo.",
    ]);
  });

  it("strips inner tags and decodes entities inside paragraphs", () => {
    const html = `<p>El <b>gobierno</b> anunci&oacute; una reforma con m&aacute;s de veinte medidas.</p>`;
    expect(extractParagraphs(html)).toEqual([
      "El gobierno anunció una reforma con más de veinte medidas.",
    ]);
  });
});

describe("extract", () => {
  it("combines title, date and paragraphs end to end", () => {
    const html = `<html><head><title>x</title></head><body><article><h1>Discurso de investidura</h1><script type="application/ld+json">{"datePublished":"2026-09-16"}</script><p>Primer párrafo del discurso con contenido suficiente.</p><p>Segundo párrafo también con contenido suficiente.</p></article></body></html>`;
    const r = extract(html, "https://example.org/discurso");
    expect(r.titulo).toBe("Discurso de investidura");
    expect(r.fecha).toBe("2026-09-16");
    expect(r.text).toBe(
      "Primer párrafo del discurso con contenido suficiente.\n\nSegundo párrafo también con contenido suficiente.",
    );
  });
});
