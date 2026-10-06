#!/usr/bin/env node
/**
 * Ingest CLI: fetch one page verbatim (or read a local file for a manual load), extract
 * title/date/paragraphs, and write corpus/figuras/textos/<figura>/<fecha>-<slug>.json.
 *
 * Usage:
 *   pnpm ingest -- --figura sanchez --url <url> [--formato discurso] [--fecha YYYY-MM-DD]
 *                  [--titulo "..."] [--lang es|en] [--file path.txt] [--pregunta "..."] [--force]
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Figura, Formato, TextoMeta } from "@jev/rhetoric";
import { segmentDocument, wordCount } from "@jev/rhetoric";
import { extract } from "./extract.js";

const FORMATOS: readonly Formato[] = [
  "discurso",
  "rueda",
  "declaracion",
  "post",
  "decreto",
  "entrevista",
  "sesion",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;

interface Args {
  figura?: string;
  url?: string;
  formato?: string;
  fecha?: string;
  titulo?: string;
  lang?: string;
  file?: string;
  pregunta?: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--") continue; // pnpm's `run <script> -- <args>` separator, forwarded literally
    if (key === "--force") {
      args.force = true;
      continue;
    }
    if (!key?.startsWith("--")) continue;
    const name = key.slice(2) as keyof Omit<Args, "force">;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Falta valor para ${key}`);
    }
    i++;
    args[name] = value;
  }
  return args;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(import.meta.dirname, "../../..");
  const figurasDir = join(root, "corpus/figuras");

  if (!args.figura) throw new Error("Falta --figura");
  const figuras = JSON.parse(await readFile(join(figurasDir, "figuras.json"), "utf8")) as Figura[];
  const figura = figuras.find((f) => f.id === args.figura);
  if (!figura) throw new Error(`Figura desconocida: "${args.figura}"`);

  let titulo: string | null;
  let fecha: string | null;
  let text: string;
  let source: string;

  if (args.file) {
    if (!args.fecha) throw new Error("--file requiere --fecha");
    if (!args.titulo) throw new Error("--file requiere --titulo");
    if (!args.url) throw new Error("--file requiere --url (se usa como source)");
    text = (await readFile(args.file, "utf8")).trim();
    titulo = args.titulo;
    fecha = args.fecha;
    source = args.url;
  } else {
    if (!args.url) throw new Error("Falta --url (o usa --file para una carga manual)");
    source = args.url;
    const html = await fetchHtml(args.url);
    const extracted = extract(html, args.url);
    titulo = extracted.titulo ?? args.titulo ?? null;
    if (!titulo) throw new Error("No se pudo extraer el título: pasa --titulo");
    fecha = extracted.fecha ?? args.fecha ?? null;
    if (!fecha) throw new Error("No se pudo extraer la fecha: pasa --fecha");
    text = extracted.text;
    if (!text || text.length < 40) {
      throw new Error("No se extrajo texto usable de la página (menos de 40 caracteres).");
    }
  }

  const formato = (args.formato ?? "discurso") as Formato;
  if (!FORMATOS.includes(formato)) throw new Error(`Formato inválido: "${formato}"`);
  const lang = (args.lang ?? figura.lang) as "es" | "en";
  if (lang !== "es" && lang !== "en") throw new Error(`Lang inválido: "${lang}"`);

  const slug = slugify(titulo);
  const id = `${fecha}-${slug}`;
  const outDir = join(figurasDir, "textos", figura.id);
  const outPath = join(outDir, `${id}.json`);

  if (existsSync(outPath) && !args.force) {
    throw new Error(`${outPath} ya existe. Usa --force para sobrescribir.`);
  }

  const meta: TextoMeta & { text: string } = {
    id,
    figura: figura.id,
    fecha,
    formato,
    titulo,
    source,
    lang,
    ...(args.pregunta ? { pregunta: args.pregunta } : {}),
    text,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, `${JSON.stringify(meta, null, 2)}\n`);

  const words = wordCount(text);
  const segments = segmentDocument(text).length;
  console.log(`${words} palabras · ${segments} frases · ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(`ingest: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
