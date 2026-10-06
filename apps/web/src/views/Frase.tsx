// Deep import: the plain "@jev/rhetoric" barrel re-exports analyze.js, which uses
// node:crypto and cannot be bundled for the browser. "@jev/rhetoric/figuras" is a
// dependency-free subset safe to import as a value from web code.
import { NIVEL_ETIQUETA } from "@jev/rhetoric/figuras";
import { useEffect, useState } from "preact/hooks";
import { api, type TextoDetalle } from "../api.js";
import { f2, pct, TEMA_LABEL, TIPO_LABEL, TONO_LABEL } from "../format.js";

type CopyState = "idle" | "copied" | "failed";

export function Frase({ textoId, n }: { textoId: string; n: number }) {
  const [data, setData] = useState<TextoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .texto(textoId)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [textoId]);

  if (error) return <p class="error">{error}</p>;
  if (!data) return <div class="skeleton" />;

  const { texto, figura, verdict } = data;
  const segment = verdict.segments[n];
  if (!segment) return <p class="error">No existe esa frase.</p>;

  const url = `${location.origin}/frase/${texto.id}/${n}`;
  const shareText = `«${segment.text}» — ${figura.nombre}, ${texto.fecha}. Nivel ${segment.nivel} de 4 en Promesómetro. ${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `«${segment.text}» — ${figura.nombre}, ${texto.fecha}. Nivel ${segment.nivel} de 4 en Promesómetro.`,
  )}&url=${encodeURIComponent(url)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    } finally {
      setTimeout(() => setCopyState("idle"), 2000);
    }
  };

  const esRelleno = segment.tipo === "relleno";
  const etiqueta = esRelleno ? "relleno" : (NIVEL_ETIQUETA[segment.nivel] ?? "medible");

  return (
    <section class="acta" style={{ gridTemplateColumns: "1fr" }}>
      <div>
        <p class="frase-big">“{segment.text}”</p>
        <div class={`stamp${esRelleno ? " neutral" : ""}`} style={{ marginBottom: 14 }}>
          Nivel {segment.nivel} · {etiqueta.toUpperCase()}
        </div>
        <p class="hint">
          {TIPO_LABEL[segment.tipo]} · {TEMA_LABEL[segment.tema]} · tono {f2(segment.tono)}{" "}
          {TONO_LABEL[Math.round(segment.tono)]} · confianza {pct(segment.confianza)}
        </p>
        <p class="hint">
          <a href={`/figura/${figura.id}`}>{figura.nombre}</a> · {texto.fecha} ·{" "}
          <a href={texto.source} target="_blank" rel="noreferrer noopener">
            fuente ↗
          </a>
        </p>
        <div class="share-row actions">
          <a class="btn" href={waUrl} target="_blank" rel="noreferrer noopener">
            WhatsApp
          </a>
          <a class="btn" href={xUrl} target="_blank" rel="noreferrer noopener">
            X
          </a>
          <button type="button" class="btn ghost" onClick={copy}>
            {copyState === "copied" && "Copiado"}
            {copyState === "failed" && "No se pudo copiar"}
            {copyState === "idle" && "Copiar enlace"}
          </button>
        </div>
        <img
          src={`/og/frase/${texto.id}/${n}.png`}
          alt="Tarjeta para compartir"
          loading="lazy"
          style={{ maxWidth: "100%", marginTop: 20, border: "1px solid var(--rule)" }}
        />
      </div>
    </section>
  );
}
