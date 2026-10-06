import type { SegmentVerdict } from "@jev/rhetoric";
import { useEffect, useState } from "preact/hooks";
import { api, type TextoDetalle } from "../api.js";
import { f2 } from "../format.js";
import { Acta } from "./Acta.jsx";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function topSegments(segments: SegmentVerdict[]): {
  humo: SegmentVerdict[];
  medibles: SegmentVerdict[];
} {
  const noRelleno = segments.filter((s) => s.tipo !== "relleno");
  const humo = [...noRelleno].sort((a, b) => a.nivel - b.nivel).slice(0, 3);
  const medibles = segments
    .filter((s) => s.tipo === "compromiso" && s.nivel >= 3)
    .sort((a, b) => b.concrecion - a.concrecion)
    .slice(0, 3);
  return { humo, medibles };
}

export function Texto({ id }: { id: string }) {
  const [data, setData] = useState<TextoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .texto(id)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p class="error">{error}</p>;
  if (!data) return <div class="skeleton" />;

  const { texto, figura, verdict } = data;
  const { humo, medibles } = topSegments(verdict.segments);

  return (
    <>
      <div class="actions" style={{ marginTop: 22 }}>
        <a class="btn ghost" href={`/figura/${figura.id}`}>
          ← {figura.nombre}
        </a>
        <span class="hint">
          {figura.nombre} · {texto.fecha} · {texto.formato} ·{" "}
          <a href={texto.source} target="_blank" rel="noreferrer noopener">
            fuente ↗
          </a>
        </span>
      </div>
      <Acta v={verdict} />

      {(humo.length > 0 || medibles.length > 0) && (
        <section class="method" style={{ marginTop: 40 }}>
          <h2>Frases para compartir</h2>
          {humo.length > 0 && (
            <>
              <h3>Lo más vago</h3>
              <ul class="corpus">
                {humo.map((s) => (
                  <li key={s.id}>
                    <a class="corpus-row" href={`/frase/${texto.id}/${s.id}`}>
                      <span class="d">nivel {s.nivel}</span>
                      <span class="t">{s.text}</span>
                      <span class="k">compartir ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {medibles.length > 0 && (
            <>
              <h3>Lo más medible</h3>
              <ul class="corpus">
                {medibles.map((s) => (
                  <li key={s.id}>
                    <a class="corpus-row" href={`/frase/${texto.id}/${s.id}`}>
                      <span class="d">{f2(s.concrecion)}</span>
                      <span class="t">{s.text}</span>
                      <span class="k">compartir ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <p class="hint">
        Fuente:{" "}
        <a href={texto.source} target="_blank" rel="noreferrer noopener">
          {hostname(texto.source)}
        </a>
      </p>
    </>
  );
}
