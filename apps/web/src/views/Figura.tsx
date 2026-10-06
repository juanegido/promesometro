import { useEffect, useState } from "preact/hooks";
import { api, type FiguraDetalle } from "../api.js";
import { f2, pct } from "../format.js";

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function Figura({ id }: { id: string }) {
  const [data, setData] = useState<FiguraDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .figura(id)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <p class="error">{error}</p>;
  if (!data) return <div class="skeleton" />;

  const { figura, metrics, textos } = data;

  return (
    <>
      <section class="hero">
        <h1>{figura.nombre}</h1>
        <p>
          {figura.cargo} · {figura.pais}
        </p>
      </section>
      <div class="strip">
        <div>
          <div class="k">Humo</div>
          <div class="v">{pct(metrics.humo)}</div>
        </div>
        <div>
          <div class="k">Medibles</div>
          <div class="v">{metrics.medibles}</div>
        </div>
        <div>
          <div class="k">Ataques</div>
          <div class="v">{pct(metrics.ataques)}</div>
        </div>
        <div>
          <div class="k">Frases</div>
          <div class="v">{metrics.frases}</div>
        </div>
      </div>

      {textos.length === 0 && (
        <p class="hint">Todavía no hay textos con fuente ingeridos para esta figura.</p>
      )}
      {textos.length > 0 && (
        <ul class="textos">
          {textos.map((t) => (
            <li key={t.id} class="texto-row">
              <span class="texto-fecha">
                {t.fecha} · {t.formato}
              </span>
              <span class="texto-main">
                <a class="texto-titulo" href={`/texto/${t.id}`}>
                  {t.titulo}
                </a>
                <span class="texto-meta">
                  concreción media {f2(t.resumen.concrecionMedia)} · {t.resumen.medibles} medibles
                </span>
              </span>
              <a class="texto-fuente" href={t.source} target="_blank" rel="noreferrer noopener">
                {hostname(t.source)} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
