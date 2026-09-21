import type { DocumentVerdict } from "@jev/rhetoric";
import { useEffect, useState } from "preact/hooks";
import { api, type CorpusMeta } from "../api.js";
import { Acta } from "./Acta.jsx";

const KIND: Record<string, string> = {
  programa: "programa",
  discurso: "discurso",
  declaracion: "declaración",
  sintetico: "ejemplo sintético",
};

export function CorpusList() {
  const [items, setItems] = useState<CorpusMeta[] | null>(null);
  useEffect(() => {
    api
      .corpus()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  return (
    <>
      <section class="hero">
        <h1>
          Textos públicos, <em>con fuente</em>.
        </h1>
        <p>
          Todo lo que hay aquí enlaza al documento original. Nada se atribuye a nadie sin enlace.
          Los ejemplos sintéticos están marcados y no son de ninguna persona real.
        </p>
        <p class="hint">
          Para añadir un texto: un archivo JSON en <code>corpus/</code> con título, autor, fecha,
          fuente y texto.
        </p>
      </section>
      {items === null && <div class="skeleton" />}
      {items && items.length === 0 && <p class="hint">El corpus está vacío.</p>}
      {items && items.length > 0 && (
        <ul class="corpus">
          {items.map((e) => (
            <li key={e.id}>
              <a href={`/corpus/${e.id}`}>
                <span class="d">{e.date}</span>
                <span>
                  <span class="t">{e.title}</span>
                  <br />
                  <span class="a">
                    {e.author} · {e.country} · {e.palabras.toLocaleString("es")} palabras
                  </span>
                </span>
                <span class="k">{KIND[e.kind]}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function CorpusEntry({ id }: { id: string }) {
  const [data, setData] = useState<{ verdict: DocumentVerdict; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    api
      .corpusEntry(id)
      .then((r) => setData({ verdict: r.verdict, ...(r.entry.note ? { note: r.entry.note } : {}) }))
      .catch((e: Error) => setError(e.message));
  }, [id]);
  if (error) return <p class="error">{error}</p>;
  if (!data) {
    return (
      <>
        <div class="skeleton" />
        <div class="skeleton" style={{ width: "70%" }} />
        <p class="hint">Levantando acta. Un texto largo tarda unos segundos la primera vez.</p>
      </>
    );
  }
  return (
    <>
      <div class="actions" style={{ marginTop: 22 }}>
        <a class="btn ghost" href="/corpus">
          ← Corpus
        </a>
        {data.note && <span class="hint">{data.note}</span>}
      </div>
      <Acta v={data.verdict} />
    </>
  );
}
