import { useEffect, useState } from "preact/hooks";
import { api, type Method } from "../api.js";
import { isJev, MOV_LABEL, TEMA_LABEL, TIPO_LABEL } from "../format.js";

export function Metodo() {
  const [m, setM] = useState<Method | null>(null);
  useEffect(() => {
    api
      .method()
      .then(setM)
      .catch(() => setM(null));
  }, []);
  return (
    <section class="method">
      <section class="hero">
        <h1>
          Un juez, una rúbrica, <em>todos los textos</em>.
        </h1>
        <p>
          Promesómetro no verifica hechos. Mide una cosa más modesta y más útil: si una frase se
          compromete a algo que después se pueda comprobar. La rúbrica es esta, entera. Se puede
          aplicar a mano.
        </p>
      </section>

      <h2>Cómo funciona</h2>
      <ol>
        <li>El texto se divide en frases. Las muy cortas se unen a la anterior.</li>
        <li>
          Cada frase se envía, sola y con el título como contexto, al juez. El juez responde cinco
          preguntas tipadas: nivel de concreción, tipo de enunciado, tema, verificabilidad y tono.
          Devuelve una distribución de probabilidad y una confianza por pregunta.
        </li>
        <li>
          El acta agrega: media de concreción, número de frases medibles (nivel 3 o 4), reparto por
          tipo y por tema, y la lista de compromisos medibles ordenada.
        </li>
        <li>
          El juez no sabe quién habla. No recibe nombre, partido ni país. Sólo la frase y el título.
        </li>
      </ol>

      <h2>El juez</h2>
      <p>
        {m && isJev(m.engine) ? (
          <>
            Esta instancia usa <strong>{m.engine}</strong>, un modelo System One de TypeSafe AI. No
            genera texto: responde preguntas cerradas con probabilidades, en una pasada, en menos de
            un segundo. Un mismo texto obtiene el mismo veredicto cada vez.
          </>
        ) : (
          <>
            Esta instancia corre <strong>sin clave de TypeSafe</strong> y usa el motor heurístico
            {m ? ` ${m.engine}` : ""}: reglas léxicas en español, públicas en el repositorio. Sirve
            para probar la interfaz y la rúbrica. Con clave, el juez es el modelo Jev y las actas se
            marcan con un punto verde.
          </>
        )}
      </p>

      <h2>Concreción, de 0 a 4</h2>
      <ol start={0}>
        {(m?.CONCRECION ?? []).map((t, i) => (
          <li key={t} value={i}>
            <span class="lvl">{i}</span>
            {t}
          </li>
        ))}
      </ol>

      <h2>Tipo de enunciado</h2>
      <dl>
        {Object.entries(m?.TIPO ?? {}).map(([k, t]) => (
          <div key={k}>
            <dt>{TIPO_LABEL[k]}</dt>
            <dd>{t}</dd>
          </div>
        ))}
      </dl>

      <h2>Tema</h2>
      <dl>
        {Object.entries(m?.TEMA ?? {}).map(([k, t]) => (
          <div key={k}>
            <dt>{TEMA_LABEL[k]}</dt>
            <dd>{t}</dd>
          </div>
        ))}
      </dl>

      <h2>Tono, de 0 a 3</h2>
      <ol start={0}>
        {(m?.TONO ?? []).map((t, i) => (
          <li key={t} value={i}>
            <span class="lvl">{i}</span>
            {t}
          </li>
        ))}
      </ol>

      <h2>Antes y después: movimiento</h2>
      <dl>
        {Object.entries(m?.MOVIMIENTO ?? {}).map(([k, t]) => (
          <div key={k}>
            <dt>{MOV_LABEL[k]}</dt>
            <dd>{t}</dd>
          </div>
        ))}
      </dl>

      <h2>Lo que no hace</h2>
      <ol>
        <li>
          No comprueba si algo es verdad, ni si se cumplió. Eso es trabajo de periodistas y de
          datos.
        </li>
        <li>No puntúa personas. Puntúa textos. Un mismo autor puede tener actas muy distintas.</li>
        <li>No guarda quién pegó qué. Las actas se identifican por el hash del texto.</li>
        <li>No usa citas inventadas. En el corpus, sin enlace a la fuente no entra nada.</li>
      </ol>
    </section>
  );
}
