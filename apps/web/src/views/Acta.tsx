import type { DocumentVerdict, SegmentVerdict } from "@jev/rhetoric";
import { useEffect, useRef, useState } from "preact/hooks";
import { drawCard } from "../card.js";
import { f2, isJev, NIVEL_LABEL, pct, TEMA_LABEL, TIPO_LABEL, TONO_LABEL } from "../format.js";

function Note({ s }: { s: SegmentVerdict }) {
  return (
    <div class="note" role="note">
      <b>concreción</b>
      <span>
        {f2(s.concrecion)} · nivel {s.nivel} {NIVEL_LABEL[s.nivel]}
      </span>
      <b>tipo</b>
      <span>{TIPO_LABEL[s.tipo]}</span>
      <b>tema</b>
      <span>{TEMA_LABEL[s.tema]}</span>
      <b>verificable</b>
      <span>{pct(s.verificable)}</span>
      <b>tono</b>
      <span>
        {f2(s.tono)} {TONO_LABEL[Math.round(s.tono)]}
      </span>
      <b>confianza</b>
      <span>{pct(s.confianza)}</span>
    </div>
  );
}

function Doc({ v }: { v: DocumentVerdict }) {
  const [open, setOpen] = useState<number | null>(null);
  const paragraphs = new Map<number, SegmentVerdict[]>();
  for (const s of v.segments) {
    const list = paragraphs.get(s.paragraph) ?? [];
    list.push(s);
    paragraphs.set(s.paragraph, list);
  }
  return (
    <div class="doc">
      {[...paragraphs.entries()].map(([p, segs]) => (
        <p key={p}>
          {segs.map((s) => (
            <span key={s.id}>
              <button
                type="button"
                class={`seg${open === s.id ? " open" : ""}`}
                data-nivel={s.nivel}
                data-tipo={s.tipo}
                aria-expanded={open === s.id}
                onClick={() => setOpen(open === s.id ? null : s.id)}
              >
                {s.text}
              </button>{" "}
              {open === s.id && <Note s={s} />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function Card({ v }: { v: DocumentVerdict }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const dark =
      document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme !== "light" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    const draw = () => ref.current && drawCard(ref.current, v, dark);
    draw();
    document.fonts?.ready.then(draw);
  }, [v]);
  const download = () => {
    const c = ref.current;
    if (!c) return;
    const a = document.createElement("a");
    a.download = `promesometro-${v.hash}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  };
  const copy = async () => {
    const r = v.resumen;
    const top = v.compromisosMedibles[0];
    const lines = [
      `PROMESÓMETRO · ${v.title ?? "texto"}`,
      `concreción media ${f2(r.concrecionMedia)}/4`,
      `compromisos medibles ${r.medibles} de ${r.segmentos} frases`,
      `compromiso ${pct(r.compromisos)} · verificable ${pct(r.verificableMedia)}`,
      top ? `lo más concreto: “${top.text}”` : "ninguna frase alcanza el nivel medible",
      `motor ${v.engine} · ${location.origin}/acta/${v.hash}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
  };
  return (
    <div class="card-wrap">
      <canvas class="card" ref={ref} aria-label="Tarjeta del acta para compartir" />
      <div class="actions">
        <button type="button" class="btn" onClick={download}>
          Descargar PNG
        </button>
        <button type="button" class="btn ghost" onClick={copy}>
          Copiar resumen
        </button>
      </div>
    </div>
  );
}

export function Acta({ v }: { v: DocumentVerdict }) {
  const r = v.resumen;
  const total = Math.max(1, r.segmentos);
  const temas = Object.entries(r.porTema)
    .filter(([, t]) => t.n > 0)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6);
  return (
    <section class="acta">
      <div>
        <header class="acta-head">
          <h2>{v.title ?? "Texto sin título"}</h2>
          <div class="src">
            {v.source ? (
              <a href={v.source} target="_blank" rel="noreferrer noopener">
                {v.source}
              </a>
            ) : (
              "texto pegado por el usuario · sin fuente"
            )}
          </div>
          <div class="strip">
            <div>
              <div class="k">Concreción media</div>
              <div class="v">
                {f2(r.concrecionMedia)}
                <small> / 4</small>
              </div>
            </div>
            <div>
              <div class="k">Compromisos medibles</div>
              <div class="v">
                {r.medibles}
                <small> de {r.segmentos}</small>
              </div>
            </div>
            <div>
              <div class="k">Frases que prometen</div>
              <div class="v">{pct(r.compromisos)}</div>
            </div>
            <div>
              <div class="k">Verificable en 4 años</div>
              <div class="v">{pct(r.verificableMedia)}</div>
            </div>
          </div>
        </header>
        <Doc v={v} />
        <details class="raw">
          <summary>JSON crudo del acta ({v.segments.length} frases)</summary>
          <pre>{JSON.stringify(v, null, 2)}</pre>
        </details>
      </div>
      <aside class="side">
        <div class="stamp">
          Acta {v.hash}
          <strong>{f2(r.concrecionMedia)} / 4</strong>
          <span class={`engine${isJev(v.engine) ? " jev" : ""}`}>
            <i /> motor {v.engine} · confianza {pct(r.confianzaMedia)}
          </span>
        </div>
        <div>
          <h3>Niveles de concreción</h3>
          <div class="legend">
            {r.niveles.map((n, i) => (
              <div key={i}>
                <i data-l={i} />
                <span>
                  {i} {NIVEL_LABEL[i]}
                </span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Qué tipo de frases hay</h3>
          <div class="bars">
            {Object.entries(r.porTipo).map(([k, n]) => (
              <div key={k}>
                <span style={{ background: "transparent", height: "auto" }}>{TIPO_LABEL[k]}</span>
                <span
                  class={k === "compromiso" ? "red" : ""}
                  style={{ width: `${(n / total) * 100}%` }}
                />
                <em>{n}</em>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Concreción por tema</h3>
          <div class="bars">
            {temas.map(([k, t]) => (
              <div key={k}>
                <span style={{ background: "transparent", height: "auto" }}>{TEMA_LABEL[k]}</span>
                <span style={{ width: `${(t.concrecion / 4) * 100}%` }} />
                <em>{f2(t.concrecion)}</em>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Lo más concreto que dice</h3>
          {v.compromisosMedibles.length === 0 && (
            <p class="hint">Ninguna frase alcanza el nivel medible.</p>
          )}
          {v.compromisosMedibles.slice(0, 5).map((s) => (
            <div class="commit" key={s.id}>
              <b>{f2(s.concrecion)}</b>
              <div>
                {s.text}
                <small>
                  {TEMA_LABEL[s.tema]} · verificable {pct(s.verificable)}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3>Compartir</h3>
          <Card v={v} />
        </div>
      </aside>
    </section>
  );
}
