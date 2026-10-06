import { useEffect, useState } from "preact/hooks";
import { api, type FigurasResponse, type HumoResponse, type Method } from "../api.js";
import { isJev, NIVEL_LABEL, pct } from "../format.js";
import { navigate } from "../router.js";

function Delta({ value, goodWhenUp }: { value: number; goodWhenUp: boolean }) {
  if (Math.round(value * 1000) === 0) return null;
  const arrow = value > 0 ? "▲" : "▼";
  const good = goodWhenUp ? value > 0 : value < 0;
  return <span class={`delta ${good ? "down" : "up"}`}>{arrow}</span>;
}

function HumoDelDia({ humo }: { humo: HumoResponse }) {
  if (!humo.fecha || (!humo.humo && !humo.beligerante)) return null;
  const top = humo.humo ?? humo.beligerante;
  if (!top) return null;
  return (
    <div class="humo-card">
      <h3>Humo del día · {humo.fecha}</h3>
      <p class="frase-quote">“{top.segment.text}”</p>
      <p class="hint">
        {top.figuraNombre} · {top.texto.fecha} ·{" "}
        <a href={`/frase/${top.texto.id}/${top.segment.id}`}>ver frase</a>
      </p>
      {humo.medible && (
        <p class="hint">
          Lo más medible: “{humo.medible.segment.text}” — {humo.medible.figuraNombre} ·{" "}
          <a href={`/frase/${humo.medible.texto.id}/${humo.medible.segment.id}`}>ver frase</a>
        </p>
      )}
    </div>
  );
}

export function Leaderboard() {
  const [data, setData] = useState<FigurasResponse | null>(null);
  const [humo, setHumo] = useState<HumoResponse | null>(null);
  const [method, setMethod] = useState<Method | null>(null);

  useEffect(() => {
    api
      .figuras()
      .then(setData)
      .catch(() => setData({ hasta: null, ventanaDias: 30, figuras: [] }));
    api
      .humo()
      .then(setHumo)
      .catch(() => setHumo(null));
    api
      .method()
      .then(setMethod)
      .catch(() => setMethod(null));
  }, []);

  return (
    <>
      <section class="hero">
        <h1>
          El mismo juez <em>para todos.</em>
        </h1>
        <p>
          Treinta días de discurso oficial, frase por frase, con la misma rúbrica. No mide verdad.
          Mide compromiso.
        </p>
        {method && (
          <span class={`engine${isJev(method.engine) ? " jev" : ""}`}>
            <i /> juez {method.engine}
          </span>
        )}
      </section>

      {humo && <HumoDelDia humo={humo} />}

      {data === null && <div class="skeleton" />}
      {data && data.figuras.length === 0 && (
        <p class="hint">Todavía no hay textos ingeridos para ninguna figura.</p>
      )}
      {data && data.figuras.length > 0 && (
        <div class="board-wrap">
          <table class="board">
            <thead>
              <tr>
                <th>#</th>
                <th>Figura</th>
                <th>Humo</th>
                <th>Medibles</th>
                <th>Ataques</th>
                <th>Frases</th>
                <th>Último texto</th>
              </tr>
            </thead>
            <tbody>
              {data.figuras.map((f, i) => {
                const sinDatos = f.metrics.frases === 0;
                return (
                  <tr
                    key={f.id}
                    tabIndex={0}
                    onClick={() => navigate(`/figura/${f.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/figura/${f.id}`);
                    }}
                  >
                    <td>{i + 1}</td>
                    <td>
                      <b>{f.nombre}</b>
                      <br />
                      <span class="hint">{f.cargo}</span>
                    </td>
                    <td>
                      {sinDatos ? (
                        "—"
                      ) : (
                        <>
                          {pct(f.metrics.humo)} <Delta value={f.delta.humo} goodWhenUp={false} />
                        </>
                      )}
                    </td>
                    <td>
                      {sinDatos ? (
                        "—"
                      ) : (
                        <>
                          {f.metrics.medibles} <Delta value={f.delta.medibles} goodWhenUp={true} />
                        </>
                      )}
                    </td>
                    <td>
                      {sinDatos ? (
                        "—"
                      ) : (
                        <>
                          {pct(f.metrics.ataques)}{" "}
                          <Delta value={f.delta.ataques} goodWhenUp={false} />
                        </>
                      )}
                    </td>
                    <td>{sinDatos ? "—" : f.metrics.frases}</td>
                    <td>{f.ultimoTexto ?? "sin textos con fuente"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <details>
        <summary>Cómo se calculan</summary>
        <dl>
          {Object.entries(method?.METRICAS ?? {}).map(([k, t]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{t}</dd>
            </div>
          ))}
        </dl>
        <p class="hint">
          Niveles de concreción: {NIVEL_LABEL.map((l, i) => `${i} ${l}`).join(" · ")}
        </p>
      </details>
    </>
  );
}
