export interface SeoMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Inject Open Graph / Twitter meta tags and replace <title> in a built index.html. */
export function renderIndex(indexHtml: string, meta: SeoMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  const tags = [
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="article">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join("\n    ");

  // Use function replacers: a string replacement would treat "$&", "$`", "$'", "$<n>" in
  // user-derived content as special replacement patterns and corrupt the output.
  let html = indexHtml.replace("</head>", () => `    ${tags}\n  </head>`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  return html;
}
