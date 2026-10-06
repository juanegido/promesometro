import { useEffect, useState } from "preact/hooks";
import { api } from "./api.js";
import { isJev } from "./format.js";
import { path } from "./router.js";
import { Analizar } from "./views/Analizar.jsx";
import { AntesDespues } from "./views/AntesDespues.jsx";
import { CorpusEntry, CorpusList } from "./views/Corpus.jsx";
import { Figura } from "./views/Figura.jsx";
import { Frase } from "./views/Frase.jsx";
import { Leaderboard } from "./views/Leaderboard.jsx";
import { Metodo } from "./views/Metodo.jsx";
import { Texto } from "./views/Texto.jsx";

const NAV = [
  ["/", "Ranking"],
  ["/analizar", "Analizar"],
  ["/antes-despues", "Antes y después"],
  ["/corpus", "Corpus"],
  ["/metodo", "Método"],
] as const;

function View() {
  const p = path.value;
  if (p === "/") return <Leaderboard />;
  if (p === "/analizar") return <Analizar />;
  if (p.startsWith("/acta/")) return <Analizar hash={p.slice(6)} key={p} />;
  if (p.startsWith("/figura/")) return <Figura id={p.slice(8)} key={p} />;
  if (p.startsWith("/texto/")) return <Texto id={p.slice(7)} key={p} />;
  if (p.startsWith("/frase/")) {
    const [textoId, n] = p.slice(7).split("/");
    if (textoId && n !== undefined) return <Frase textoId={textoId} n={Number(n)} key={p} />;
  }
  if (p === "/antes-despues") return <AntesDespues />;
  if (p === "/corpus") return <CorpusList />;
  if (p.startsWith("/corpus/")) return <CorpusEntry id={p.slice(8)} />;
  if (p === "/metodo") return <Metodo />;
  return (
    <section class="hero">
      <h1>No hay nada aquí.</h1>
      <p>
        <a href="/analizar">Volver a levantar un acta.</a>
      </p>
    </section>
  );
}

export function App() {
  const [engine, setEngine] = useState<string | null>(null);
  useEffect(() => {
    api
      .health()
      .then((h) => setEngine(h.engine))
      .catch(() => setEngine(null));
  }, []);
  const current = path.value;
  const active = (href: string) =>
    href === "/analizar"
      ? current === "/analizar" || current.startsWith("/acta/")
      : current === href;
  return (
    <div class="wrap">
      <header class="mast">
        <a class="wordmark" href="/">
          PROMES<em>Ó</em>METRO
        </a>
        <nav aria-label="Secciones">
          {NAV.map(([href, label]) => (
            <a key={href} href={href} aria-current={active(href) ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <span class="motto">
          {engine ? (
            <span class={`engine${isJev(engine) ? " jev" : ""}`}>
              <i /> juez {engine}
            </span>
          ) : (
            "No mide verdad. Mide compromiso."
          )}
        </span>
      </header>
      <main>
        <View />
      </main>
      <footer>
        <span>
          Herramienta de retórica. No verifica hechos. Las actas se calculan sobre el texto y nada
          más.
        </span>
        <span>
          <a href="/metodo">Método</a> · código abierto
        </span>
      </footer>
    </div>
  );
}
