import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Figura, Formato, TextoMeta } from "@jev/rhetoric";

export type TextoEntry = TextoMeta & { text: string };

const FORMATOS: readonly Formato[] = [
  "discurso",
  "rueda",
  "declaracion",
  "post",
  "decreto",
  "entrevista",
  "sesion",
];

const FECHA_RX = /^\d{4}-\d{2}-\d{2}$/;

function isHttpUrl(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(entry: TextoEntry, figuraIds: Set<string>, path: string): void {
  if (!isHttpUrl(entry.source)) throw new Error(`${path}: source debe ser una URL http(s)`);
  if (!figuraIds.has(entry.figura)) throw new Error(`${path}: figura "${entry.figura}" no existe`);
  if (!FECHA_RX.test(entry.fecha)) throw new Error(`${path}: fecha inválida "${entry.fecha}"`);
  if (!FORMATOS.includes(entry.formato))
    throw new Error(`${path}: formato inválido "${entry.formato}"`);
  if (entry.text.length < 40 || entry.text.length > 40_000) {
    throw new Error(`${path}: texto fuera de rango (${entry.text.length} caracteres)`);
  }
}

/** Load figures and their ingested texts from `dir`. Returns empty arrays when `dir` is missing. */
export async function loadFiguras(
  dir: string,
): Promise<{ figuras: Figura[]; textos: TextoEntry[] }> {
  let figuras: Figura[];
  try {
    figuras = JSON.parse(await readFile(join(dir, "figuras.json"), "utf8")) as Figura[];
  } catch {
    return { figuras: [], textos: [] };
  }
  const figuraIds = new Set(figuras.map((f) => f.id));

  const textosDir = join(dir, "textos");
  let figuraDirs: string[];
  try {
    figuraDirs = await readdir(textosDir);
  } catch {
    return { figuras, textos: [] };
  }

  const textos: TextoEntry[] = [];
  for (const figuraDir of figuraDirs) {
    const full = join(textosDir, figuraDir);
    let files: string[];
    try {
      files = (await readdir(full)).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const file of files) {
      const path = join(full, file);
      const raw = await readFile(path, "utf8");
      const entry = JSON.parse(raw) as TextoEntry;
      const id = entry.id ?? file.replace(/\.json$/, "");
      const withId = { ...entry, id };
      validate(withId, figuraIds, path);
      textos.push(withId);
    }
  }

  textos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { figuras, textos };
}
