import type { CompareVerdict } from "@jev/rhetoric";
import { useState } from "preact/hooks";
import { api } from "../api.js";
import { f2, isJev, MOV_LABEL, pct } from "../format.js";

export function AntesDespues() {
  const [antes, setAntes] = useState("");
  const [despues, setDespues] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState<CompareVerdict | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setV(await api.compare(antes, despues));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!v) return;
    await navigator.clipboard.writeText(
      [
        "PROMESÓMETRO · antes y después",
        `movimiento: ${MOV_LABEL[v.movimiento]}`,
        `consistencia ${f2(v.consistencia)}/4 · concreción ${f2(v.concrecionAntes)} → ${f2(v.concrecionDespues)}`,
        `antes: “${v.antes}”`,
        `después: “${v.despues}”`,
        `motor ${v.engine} · confianza ${pct(v.confianza)}`,
      ].join("\n"),
    );
  };

  return (
    <>
      <section class="hero">
        <h1>
          Lo que prometió. <em>Lo que dice ahora.</em>
        </h1>
        <p>
          Dos frases de la misma persona, con fuente. El juez dice si la segunda cumple, mantiene,
          diluye, contradice o cambia de tema, y cuánta concreción se ganó o se perdió por el
          camino.
        </p>
      </section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div class="duel">
          <label>
            Antes · la promesa
            <textarea
              value={antes}
              onInput={(e) => setAntes((e.target as HTMLTextAreaElement).value)}
              placeholder="“Bajaremos los impuestos a la clase media en el primer año.”"
            />
          </label>
          <label>
            Después · la frase reciente
            <textarea
              value={despues}
              onInput={(e) => setDespues((e.target as HTMLTextAreaElement).value)}
              placeholder="“Haremos los ajustes fiscales que la situación exija.”"
            />
          </label>
        </div>
        <div class="actions">
          <button
            type="submit"
            class="btn red"
            disabled={busy || antes.length < 10 || despues.length < 10}
          >
            {busy ? "Juzgando…" : "Emitir veredicto"}
          </button>
          <span class="hint">
            Pega citas literales con fecha y enlace. Lo que no esté en el texto, el juez no lo ve.
          </span>
        </div>
        {error && <p class="error">{error}</p>}
      </form>
      {v && (
        <section class="verdict-big">
          <div class="stamp">
            movimiento
            <strong>{MOV_LABEL[v.movimiento]}</strong>
            <span class={`engine${isJev(v.engine) ? " jev" : ""}`}>
              <i /> {v.engine} · confianza {pct(v.confianza)}
            </span>
          </div>
          <div>
            <div class="strip" style={{ marginTop: 0 }}>
              <div>
                <div class="k">Consistencia</div>
                <div class="v">
                  {f2(v.consistencia)}
                  <small> / 4</small>
                </div>
              </div>
              <div>
                <div class="k">Concreción antes</div>
                <div class="v">{f2(v.concrecionAntes)}</div>
              </div>
              <div>
                <div class="k">Concreción después</div>
                <div class="v">{f2(v.concrecionDespues)}</div>
              </div>
              <div>
                <div class="k">Diferencia</div>
                <div
                  class="v"
                  style={{
                    color: v.concrecionDespues < v.concrecionAntes ? "var(--red)" : undefined,
                  }}
                >
                  {v.concrecionDespues - v.concrecionAntes >= 0 ? "+" : ""}
                  {f2(v.concrecionDespues - v.concrecionAntes)}
                </div>
              </div>
            </div>
            <div class="probs">
              {Object.entries(v.probabilidades)
                .sort((a, b) => b[1] - a[1])
                .map(([k, p]) => (
                  <div key={k} class={k === v.movimiento ? "win" : ""}>
                    <span style={{ background: "transparent", height: "auto" }}>
                      {MOV_LABEL[k]}
                    </span>
                    <span style={{ width: `${p * 100}%` }} />
                    <em>{pct(p)}</em>
                  </div>
                ))}
            </div>
            <div class="actions" style={{ marginTop: 16 }}>
              <button type="button" class="btn ghost" onClick={copy}>
                Copiar veredicto
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
