import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadFiguras } from "./figuras.js";

const dirs: string[] = [];

async function tmpDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "figuras-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const FIGURA = {
  id: "trump",
  nombre: "Donald Trump",
  cargo: "Presidente",
  pais: "US",
  lang: "en",
};

async function seed(dir: string, figuras: unknown[], texto: Record<string, unknown> | null) {
  await writeFile(join(dir, "figuras.json"), JSON.stringify(figuras));
  if (texto) {
    const figuraDir = join(dir, "textos", String(texto.figura ?? "trump"));
    await mkdir(figuraDir, { recursive: true });
    await writeFile(join(figuraDir, "2026-09-10-discurso.json"), JSON.stringify(texto));
  }
}

describe("loadFiguras", () => {
  it("returns empty arrays when the dir does not exist", async () => {
    const r = await loadFiguras(join(tmpdir(), "does-not-exist-xyz"));
    expect(r).toEqual({ figuras: [], textos: [] });
  });

  it("returns figuras with no textos dir", async () => {
    const dir = await tmpDir();
    await writeFile(join(dir, "figuras.json"), JSON.stringify([FIGURA]));
    const r = await loadFiguras(dir);
    expect(r.figuras).toEqual([FIGURA]);
    expect(r.textos).toEqual([]);
  });

  it("loads and sorts valid textos by fecha desc, deriving id from filename", async () => {
    const dir = await tmpDir();
    await seed(dir, [FIGURA], {
      figura: "trump",
      fecha: "2026-09-10",
      formato: "discurso",
      titulo: "Discurso",
      source: "https://example.org/x",
      lang: "en",
      text: "x".repeat(50),
    });
    const otherDir = join(dir, "textos", "trump");
    await writeFile(
      join(otherDir, "2026-09-20-otro.json"),
      JSON.stringify({
        figura: "trump",
        fecha: "2026-09-20",
        formato: "post",
        titulo: "Post",
        source: "https://example.org/y",
        lang: "en",
        text: "y".repeat(50),
      }),
    );
    const r = await loadFiguras(dir);
    expect(r.textos.map((t) => t.id)).toEqual(["2026-09-20-otro", "2026-09-10-discurso"]);
    expect(r.textos[0]?.fecha).toBe("2026-09-20");
  });

  it("throws with the file path when source is not an http(s) URL", async () => {
    const dir = await tmpDir();
    await seed(dir, [FIGURA], {
      figura: "trump",
      fecha: "2026-09-10",
      formato: "discurso",
      titulo: "T",
      source: "not-a-url",
      lang: "en",
      text: "x".repeat(50),
    });
    await expect(loadFiguras(dir)).rejects.toThrow(/2026-09-10-discurso\.json/);
  });

  it("throws when figura id does not exist", async () => {
    const dir = await tmpDir();
    await seed(dir, [FIGURA], {
      figura: "unknown",
      fecha: "2026-09-10",
      formato: "discurso",
      titulo: "T",
      source: "https://example.org/x",
      lang: "en",
      text: "x".repeat(50),
    });
    await expect(loadFiguras(dir)).rejects.toThrow(/figura "unknown" no existe/);
  });

  it("throws on invalid fecha, formato and out-of-range text", async () => {
    const dir = await tmpDir();
    await seed(dir, [FIGURA], {
      figura: "trump",
      fecha: "10-09-2026",
      formato: "discurso",
      titulo: "T",
      source: "https://example.org/x",
      lang: "en",
      text: "x".repeat(50),
    });
    await expect(loadFiguras(dir)).rejects.toThrow(/fecha inválida/);

    const dir2 = await tmpDir();
    await seed(dir2, [FIGURA], {
      figura: "trump",
      fecha: "2026-09-10",
      formato: "tuit",
      titulo: "T",
      source: "https://example.org/x",
      lang: "en",
      text: "x".repeat(50),
    });
    await expect(loadFiguras(dir2)).rejects.toThrow(/formato inválido/);

    const dir3 = await tmpDir();
    await seed(dir3, [FIGURA], {
      figura: "trump",
      fecha: "2026-09-10",
      formato: "discurso",
      titulo: "T",
      source: "https://example.org/x",
      lang: "en",
      text: "short",
    });
    await expect(loadFiguras(dir3)).rejects.toThrow(/fuera de rango/);
  });
});
