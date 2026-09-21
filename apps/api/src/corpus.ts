import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** A public political text with its provenance. No entry without a source. */
export interface CorpusEntry {
  id: string;
  title: string;
  author: string;
  country: string;
  date: string;
  kind: "programa" | "discurso" | "declaracion" | "sintetico";
  source: string;
  note?: string;
  text: string;
}

export async function loadCorpus(dir: string): Promise<CorpusEntry[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files.map(async (f) => {
      const e = JSON.parse(await readFile(join(dir, f), "utf8")) as CorpusEntry;
      if (!e.source) throw new Error(`corpus/${f} no tiene fuente`);
      return { ...e, id: e.id ?? f.replace(/\.json$/, "") };
    }),
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
