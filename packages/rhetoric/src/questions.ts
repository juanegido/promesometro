import { choice, noul, score } from "@jev/decide";

/**
 * The rubric is the product. Every level is written so a reader can apply it by hand,
 * and the Método page renders these same strings. Change them here only.
 */
export const CONCRECION = [
  "Valores, diagnóstico o retórica sin ninguna acción propuesta",
  "Intención declarada sin medida concreta: 'trabajaremos por', 'apostamos por', 'defenderemos'",
  "Medida identificable (crear, eliminar, aprobar, subir, bajar algo concreto) sin cifra ni plazo",
  "Medida con una cifra, un porcentaje o un plazo verificable",
  "Medida con cifra y plazo, y además el instrumento o responsable (ley, presupuesto, organismo)",
] as const;

export const TIPO = {
  compromiso: "Promete o anuncia una acción propia de gobierno o de partido",
  diagnostico: "Describe una situación o un problema sin proponer acción",
  valor: "Afirma principios, identidad o visión sin acción",
  ataque: "Critica o descalifica a un adversario, gobierno anterior o grupo",
  relleno: "Saludo, transición, agradecimiento o frase sin contenido político",
} as const;

export const TEMA = {
  economia: "Impuestos, empleo, salarios, deuda, inflación, industria, comercio",
  seguridad: "Crimen, policía, fuerzas armadas, cárceles, narcotráfico, orden público",
  salud: "Sistema sanitario, hospitales, medicamentos, salud pública",
  educacion: "Escuelas, universidades, formación, ciencia",
  vivienda: "Vivienda, alquiler, suelo, urbanismo",
  ambiente: "Clima, energía, agua, agricultura, territorio",
  instituciones: "Justicia, corrupción, reforma del Estado, elecciones, constitución",
  social: "Pensiones, pobreza, igualdad, familia, migración, derechos",
  exterior: "Relaciones internacionales, alianzas, aranceles, fronteras",
  otro: "No encaja en ninguna categoría anterior",
} as const;

export const TONO = [
  "Frío: expositivo, sin carga emocional",
  "Firme: asertivo, con convicción pero sin hostilidad",
  "Inflamado: apela a emociones fuertes, urgencia o amenaza",
  "Beligerante: enemigo explícito, lenguaje de confrontación o guerra",
] as const;

export const MOVIMIENTO = {
  cumple: "La frase reciente reafirma la promesa y la concreta o la ejecuta",
  mantiene: "Misma posición, mismo nivel de concreción",
  diluye: "Misma dirección pero más vaga, con condiciones o sin plazo",
  contradice: "La frase reciente va en dirección opuesta a la promesa",
  cambia_de_tema: "La frase reciente no aborda lo que la promesa prometía",
} as const;

export const CONSISTENCIA = [
  "Contradicción frontal",
  "Contradicción parcial o giro claro",
  "Ambigua: compatible sólo con interpretación generosa",
  "Coherente con matices",
  "Plenamente coherente",
] as const;

/** Questions asked of every segment. State is `{ texto, contexto? }`. */
export const segmentQuestions = {
  concrecion: score("¿Cómo de concreta es esta frase como compromiso político?", CONCRECION),
  tipo: choice("¿Qué tipo de enunciado político es esta frase?", TIPO),
  tema: choice("¿De qué tema trata principalmente la frase?", TEMA),
  verificable: noul(
    "¿Podría un periodista comprobar dentro de cuatro años si esto se cumplió o no?",
  ),
  tono: score("¿Cuál es el tono de la frase?", TONO),
} as const;

/** Questions asked when comparing a promise with a later statement. State is `{ antes, despues }`. */
export const compareQuestions = {
  movimiento: choice(
    "Comparando 'antes' (promesa) con 'despues' (frase reciente), ¿qué movimiento hay?",
    MOVIMIENTO,
  ),
  consistencia: score("¿Cómo de consistente es 'despues' con 'antes'?", CONSISTENCIA),
  concrecion_antes: score("¿Cómo de concreta es la frase 'antes'?", CONCRECION),
  concrecion_despues: score("¿Cómo de concreta es la frase 'despues'?", CONCRECION),
} as const;

export type Tipo = keyof typeof TIPO;
export type Tema = keyof typeof TEMA;
export type Movimiento = keyof typeof MOVIMIENTO;
