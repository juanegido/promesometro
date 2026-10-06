/**
 * Pure, regex-based HTML text extraction for the ingest CLI. No DOM, no dependencies:
 * this only has to handle a handful of known government and news page shapes well
 * enough to pull out verbatim paragraphs, a title and a publish date.
 */

export interface Extracted {
  titulo: string | null;
  fecha: string | null;
  text: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  iquest: "¿",
  iexcl: "¡",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function countParagraphs(html: string): number {
  return (html.match(/<p[^>]*>/gi) ?? []).length;
}

/**
 * Pick the main content block: among every <article>, the one with the most <p> tags
 * (at least 3, to skip teaser/related-content articles), else <main>, else <body>.
 */
export function extractBody(html: string): string {
  const articles = [...html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)].map(
    (m) => m[1] ?? "",
  );
  const bestArticle = articles
    .map((a) => ({ a, n: countParagraphs(a) }))
    .filter(({ n }) => n >= 3)
    .sort((x, y) => y.n - x.n)[0]?.a;

  const pick = bestArticle
    ? undefined
    : (/<main[^>]*>([\s\S]*?)<\/main>/i.exec(html) ?? /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html));
  let body = bestArticle ?? pick?.[1] ?? html;
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of [
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    "figure",
    "form",
    "noscript",
  ]) {
    body = body.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }
  return body;
}

export function extractTitulo(html: string): string | null {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]) {
    const t = stripTags(h1[1]);
    if (t) return t;
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) {
    const t = stripTags(title[1]);
    if (t) return t;
  }
  return null;
}

const BOILERPLATE_RX = /^(compartir|share|imprimir|print|tags?:|etiquetas?:)/i;

/** Paragraph and list-item text, cleaned and filtered. */
export function extractParagraphs(bodyHtml: string): string[] {
  const out: string[] = [];
  const rx = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard exec loop
  while ((m = rx.exec(bodyHtml))) {
    const text = stripTags(m[2] ?? "");
    if (text.length < 20) continue;
    if (BOILERPLATE_RX.test(text)) continue;
    out.push(text);
  }
  return out;
}

export function extractFecha(html: string, url: string): string | null {
  const jsonLd = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html);
  if (jsonLd?.[1]) return jsonLd[1];

  const moncloaStyle = /(20\d{2})(\d{2})(\d{2})-/.exec(url);
  if (moncloaStyle) {
    const [, y, mo, d] = moncloaStyle;
    return `${y}-${mo}-${d}`;
  }

  // Year/month-only URL patterns leave the day unknown; the caller must supply --fecha.
  return null;
}

export function extract(html: string, url: string): Extracted {
  const body = extractBody(html);
  const paragraphs = extractParagraphs(body);
  return {
    titulo: extractTitulo(html),
    fecha: extractFecha(html, url),
    text: paragraphs.join("\n\n"),
  };
}
