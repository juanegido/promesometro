import { describe, expect, it } from "vitest";
import { renderIndex } from "./seo.js";

const INDEX = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Promesómetro</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`;

describe("renderIndex", () => {
  it("injects og/twitter meta tags before </head> and replaces <title>", () => {
    const html = renderIndex(INDEX, {
      title: 'Trump & "el humo" <del>del día</del>',
      description: "Una frase de prueba",
      image: "https://example.org/og/frase/x/0.png",
      url: "https://example.org/frase/x/0",
    });
    expect(html).toContain(
      '<meta property="og:image" content="https://example.org/og/frase/x/0.png">',
    );
    expect(html).toContain('<meta property="og:url" content="https://example.org/frase/x/0">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(
      "<title>Trump &amp; &quot;el humo&quot; &lt;del&gt;del día&lt;/del&gt;</title>",
    );
    expect(html.indexOf('<meta property="og:title"')).toBeLessThan(html.indexOf("</head>"));
    expect(html).not.toContain("<title>Promesómetro</title>");
  });

  it("treats special replacement patterns like $& as literal text, not a replace() directive", () => {
    const html = renderIndex(INDEX, {
      title: "el $& de todos",
      description: "coste $` y beneficio $' con $<foo>",
      image: "https://example.org/og/figura/x.png",
      url: "https://example.org/figura/x",
    });
    const titleMatches = html.match(/<title>/g) ?? [];
    const headCloseMatches = html.match(/<\/head>/g) ?? [];
    expect(titleMatches).toHaveLength(1);
    expect(headCloseMatches).toHaveLength(1);
    expect(html).toContain("<title>el $&amp; de todos</title>");
    expect(html).toContain('content="coste $` y beneficio $&apos; con $&lt;foo&gt;"');
  });
});
