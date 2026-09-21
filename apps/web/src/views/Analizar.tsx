import type { DocumentVerdict } from "@jev/rhetoric";
import { useEffect, useState } from "preact/hooks";
import { api } from "../api.js";
import { navigate } from "../router.js";
import { Acta } from "./Acta.jsx";

const EJEMPLO = `Creemos en un país donde el esfuerzo se premie y nadie se quede atrás.

Bajaremos el IVA de los alimentos básicos del 10% al 4% en los primeros cien días de gobierno, por decreto.
El gobierno saliente deja las cuentas públicas en su peor momento en veinte años.
Trabajaremos por una sanidad pública de calidad, con menos listas de espera.

Construiremos 20.000 viviendas de alquiler asequible en cuatro años a través de la empresa pública de suelo.
Aprobaremos una ley de transparencia en el primer año.
Defenderemos la seguridad de nuestros barrios con firmeza, caiga quien caiga.`;

export function Analizar({ hash }: { hash?: string }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<DocumentVerdict | null>(null);

  useEffect(() => {
    if (!hash) return;
    setBusy(true);
    api
      .verdict(hash)
      .then(setVerdict)
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }, [hash]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await api.analyze(text, title, source);
      setVerdict(v);
      navigate(`/acta/${v.hash}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!verdict && (
        <section class="hero">
          <h1>
            Cuánto de lo que dice un político <em>se puede medir</em>.
          </h1>
          <p>
            Pega un programa, un discurso o una declaración. Cada frase recibe un nivel de
            concreción de 0 a 4, un tipo y un tema, con una rúbrica pública y el mismo juez para
            todos.
          </p>
          <p class="hint">
            No dice si es verdad. Dice si dentro de cuatro años alguien podrá comprobarlo.
          </p>
        </section>
      )}
      {!verdict && (
        <form
          class="paste"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <textarea
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            placeholder="Pega aquí el texto. Programas electorales, discursos, comunicados, hilos largos."
            aria-label="Texto a analizar"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run();
            }}
          />
          <div class="meta-row">
            <input
              value={title}
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              placeholder="Título (opcional): Programa electoral 2026, Discurso de investidura…"
              aria-label="Título"
            />
            <input
              value={source}
              onInput={(e) => setSource((e.target as HTMLInputElement).value)}
              placeholder="Fuente (URL, opcional). Sin fuente el acta lo dice."
              aria-label="Fuente"
              type="url"
            />
          </div>
          <div class="actions">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" class="btn red" disabled={busy || text.trim().length < 20}>
                {busy ? "Levantando acta…" : "Levantar acta"}
              </button>
              <button type="button" class="btn ghost" onClick={() => setText(EJEMPLO)}>
                Probar con un ejemplo
              </button>
            </div>
            <span class="hint">
              ⌘/Ctrl + Enter · máx. 40.000 caracteres · el texto no se guarda con tu nombre
            </span>
          </div>
          {error && <p class="error">{error}</p>}
        </form>
      )}
      {busy && verdict === null && hash && <div class="skeleton" />}
      {verdict && (
        <>
          <div class="actions" style={{ marginTop: 22 }}>
            <a class="btn ghost" href="/" onClick={() => setVerdict(null)}>
              ← Nueva acta
            </a>
            <span class="hint">Pulsa una frase para ver su nota al margen.</span>
          </div>
          <Acta v={verdict} />
        </>
      )}
    </>
  );
}
