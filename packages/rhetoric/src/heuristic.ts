import type { Decider } from "@jev/decide";
import type {
  ChoiceCriteria,
  EntryType,
  Question,
  Questions,
  ResultFor,
  ScoreCriteria,
  SystemOneResult,
} from "@typesafe-ai/sdk";

/**
 * Lexical fallback so the platform runs without a TypeSafe key. It is deliberately
 * transparent and modest: rules over Spanish political vocabulary, no learning.
 * The UI labels its output as "heurístico" so nobody mistakes it for Jev.
 */
export const HEURISTIC_ENGINE = "heuristico-es-v1";

const RX = {
  numero:
    /\b\d+([.,]\d+)?\s*(%|por ciento|millones?|mil|euros?|pesos|dólares|puntos?)?\b|\b(cien|mil|millón|millones|doble|mitad|tercio)\b/i,
  plazo:
    /\b(en|antes de|durante|dentro de|a partir de|hasta)\s+(el\s+)?(\d{4}|\d+\s+(años?|meses|días|semanas)|(el\s+)?(primer|segundo|tercer|cuarto)\s+(año|trimestre|semestre)|los primeros \d+|cien días|100 días)\b|\bcada año\b|\banualmente\b/i,
  instrumento:
    /\b(ley|decreto|reforma|presupuesto|plan nacional|ministerio|agencia|fondo|programa|impuesto|iva|irpf|tasa|arancel|referéndum|constitución)\b/i,
  accion:
    /\b(crear[eé]?(mos)?|eliminar[eé]?(mos)?|aprobar[eé]?(mos)?|derogar[eé]?(mos)?|subir[eé]?(mos)?|bajar[eé]?(mos)?|reducir[eé]?(mos)?|aumentar[eé]?(mos)?|construir[eé]?(mos)?|contratar[eé]?(mos)?|prohibir[eé]?(mos)?|garantizar[eé]?(mos)?|invertir[eé]?(mos)?|destinar[eé]?(mos)?|duplicar[eé]?(mos)?|cerrar[eé]?(mos)?|abrir[eé]?(mos)?|vamos a|voy a|se (creará|eliminará|aprobará|reducirá|aumentará|construirá|destinará))\b/i,
  intencion:
    /\b(trabajar(emos|é) por|apostar(emos|é) por|defender(emos|é)|impulsar(emos|é)|promover(emos|é)|fortalecer(emos|é)|luchar(emos|é)|apoyar(emos|é)|avanzar(emos|é)|queremos|creemos en|nuestro compromiso|comprometidos con)\b/i,
  ataque:
    /\b(corrupt\w*|mentiros\w*|fracas\w*|desastre|casta|élite|traidor\w*|enemig\w*|ilegítim\w*|fraude|dictadura|tiran\w*|incompetente\w*|vergüenza|saque\w*|robar\w*|robaron|ruina|inútil\w*)\b/i,
  diagnostico:
    /\b(hoy|actualmente|el país|la situación|tenemos|hay|existe|sufre|padece|crisis|datos|según)\b/i,
  relleno:
    /^(gracias|buenas|hola|muchas gracias|bienvenid|un saludo|aplausos|señoras y señores|amigos y amigas)/i,
  valor:
    /\b(libertad|justicia|dignidad|patria|pueblo|esperanza|valores|fe|unidad|orgullo|soberanía|futuro|cambio)\b/i,
  inflamado:
    /\b(urgente|ahora o nunca|no podemos esperar|amenaza|peligro|destruir|salvar|rescatar|invasión|caos)\b|!/i,
  beligerante:
    /\b(guerra|enemigo|aplastar|acabar con ellos|traidores|batalla|combatir(emos)?|mano dura|sin piedad)\b/i,
  firme:
    /\b(no se negocia|no se discute|firme|garantizamos|sin excepción|caiga quien caiga|se acabó)\b/i,
} as const;

const TEMA_RX: Record<string, RegExp> = {
  economia:
    /impuesto|fiscal|irpf|renta|iva\b|empleo|salari|sueldo|deuda|déficit|inflaci|industria|comercio|econom|pib|empresa|autónomo|arancel|gasto|presupuest/i,
  seguridad:
    /crimen|delincuen|polic|militar|ejército|cárcel|prisión|narco|segur|pandilla|homicid|orden público|inseguridad/i,
  salud: /salud|sanidad|hospital|médic|medicamento|enfermer|eps|sanitari/i,
  educacion: /educaci|escuela|colegio|universidad|docente|maestr|becas?|ciencia|investigaci/i,
  vivienda: /vivienda|alquiler|hipoteca|suelo|urbanis|casa propia|inquilin/i,
  ambiente: /clima|energ|agua|agricult|campo|ambient|carbón|petróleo|renovable|bosque|territorio/i,
  instituciones:
    /justicia|corrup|reforma del estado|elecci|constituci|congreso|parlamento|judicial|fiscalía|transparencia|referéndum/i,
  social: /pensi|pobreza|igualdad|familia|migra|derechos|mujer|género|discapacidad|subsidio|bono/i,
  exterior:
    /internacional|alianza|frontera|estados unidos|washington|europa|china|onu|embajada|exterior|otan/i,
};

function dist(n: number, peak: number, sharpness = 0.6): Record<string, number> {
  const raw = Array.from({ length: n }, (_, i) => Math.exp(-Math.abs(i - peak) / sharpness));
  const sum = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(raw.map((v, i) => [String(i), v / sum]));
}

function scoreAnswer(
  criteria: ScoreCriteria,
  level: number,
  confidence: number,
): ResultFor<Question> {
  const probabilities = dist(criteria.length, level);
  const legend = Object.fromEntries(criteria.map((c, i) => [String(i), c]));
  const score = Object.entries(probabilities).reduce((a, [k, p]) => a + Number(k) * p, 0);
  return { type: "score", score, confidence, legend, probabilities };
}

function choiceAnswer(
  criteria: ChoiceCriteria,
  pick: string,
  confidence: number,
): ResultFor<Question> {
  const labels = Object.keys(criteria);
  const chosen = labels.includes(pick) ? pick : (labels[0] as string);
  const rest = labels.length > 1 ? (1 - confidence) / (labels.length - 1) : 0;
  const probabilities = Object.fromEntries(
    labels.map((l) => [l, l === chosen ? confidence : rest]),
  );
  return { type: "choice", choice: chosen, confidence, probabilities };
}

function textOf(state: EntryType, key: string): string {
  if (typeof state === "string") return state;
  if (state && !Array.isArray(state) && typeof state === "object") {
    const v = (state as Record<string, unknown>)[key];
    return typeof v === "string" ? v : "";
  }
  return "";
}

export function concrecionLevel(t: string): number {
  const num = RX.numero.test(t);
  const plazo = RX.plazo.test(t);
  const instr = RX.instrumento.test(t);
  const accion = RX.accion.test(t);
  if (accion && num && plazo && instr) return 4;
  if (accion && (num || plazo)) return 3;
  if (accion) return 2;
  if (RX.intencion.test(t)) return 1;
  if ((num || plazo) && instr) return 2;
  return 0;
}

export function tipoOf(t: string): string {
  if (RX.relleno.test(t)) return "relleno";
  if (RX.ataque.test(t)) return "ataque";
  if (RX.accion.test(t) || RX.intencion.test(t)) return "compromiso";
  if (RX.valor.test(t) && !RX.diagnostico.test(t)) return "valor";
  if (RX.diagnostico.test(t)) return "diagnostico";
  return "valor";
}

export function temaOf(t: string): string {
  let best = "otro";
  let hits = 0;
  for (const [tema, rx] of Object.entries(TEMA_RX)) {
    const n = (t.match(new RegExp(rx.source, "gi")) ?? []).length;
    if (n > hits) {
      hits = n;
      best = tema;
    }
  }
  return best;
}

export function tonoLevel(t: string): number {
  if (RX.beligerante.test(t)) return 3;
  if (RX.inflamado.test(t)) return 2;
  if (RX.firme.test(t)) return 1;
  return 0;
}

function movimientoOf(antes: string, despues: string): { pick: string; consistencia: number } {
  const a = concrecionLevel(antes);
  const d = concrecionLevel(despues);
  const temaA = temaOf(antes);
  const temaD = temaOf(despues);
  if (temaA !== temaD && temaA !== "otro" && temaD !== "otro") {
    return { pick: "cambia_de_tema", consistencia: 2 };
  }
  const down = /\b(baj|reduc|recort|elimin|derog)\w*/i;
  const up = /\b(sub|aument|ampli|cre|incorpor)\w*/i;
  const opposite =
    (down.test(antes) && up.test(despues) && !down.test(despues)) ||
    (up.test(antes) && down.test(despues) && !up.test(despues)) ||
    (/\bno\b/i.test(despues) && !/\bno\b/i.test(antes) && temaA === temaD);
  if (opposite) return { pick: "contradice", consistencia: 0 };
  if (d > a) return { pick: "cumple", consistencia: 4 };
  if (d < a) return { pick: "diluye", consistencia: 2 };
  return { pick: "mantiene", consistencia: 3 };
}

/** Deterministic Decider that answers the rhetoric questions by name. */
export class HeuristicDecider implements Decider {
  readonly confidence: number;
  constructor(confidence = 0.55) {
    this.confidence = confidence;
  }

  async systemOne<const Q extends Questions>(request: {
    state: EntryType;
    questions: Q;
    model?: string;
  }): Promise<SystemOneResult<Q>> {
    const texto = textOf(request.state, "texto");
    const antes = textOf(request.state, "antes");
    const despues = textOf(request.state, "despues");
    const c = this.confidence;
    const answers = {} as { [K in keyof Q]: ResultFor<Q[K]> };

    for (const name of Object.keys(request.questions) as (keyof Q & string)[]) {
      const q = request.questions[name] as Question;
      let a: ResultFor<Question>;
      switch (name) {
        case "concrecion":
          a = scoreAnswer((q as { criteria: ScoreCriteria }).criteria, concrecionLevel(texto), c);
          break;
        case "concrecion_antes":
          a = scoreAnswer((q as { criteria: ScoreCriteria }).criteria, concrecionLevel(antes), c);
          break;
        case "concrecion_despues":
          a = scoreAnswer((q as { criteria: ScoreCriteria }).criteria, concrecionLevel(despues), c);
          break;
        case "tipo":
          a = choiceAnswer((q as { criteria: ChoiceCriteria }).criteria, tipoOf(texto), c);
          break;
        case "tema":
          a = choiceAnswer((q as { criteria: ChoiceCriteria }).criteria, temaOf(texto), c);
          break;
        case "verificable": {
          const lvl = concrecionLevel(texto);
          a = { type: "noul", noul: [0.08, 0.2, 0.45, 0.8, 0.95][lvl] ?? 0.5 };
          break;
        }
        case "tono":
          a = scoreAnswer((q as { criteria: ScoreCriteria }).criteria, tonoLevel(texto), c);
          break;
        case "movimiento": {
          const m = movimientoOf(antes, despues);
          a = choiceAnswer((q as { criteria: ChoiceCriteria }).criteria, m.pick, c);
          break;
        }
        case "consistencia": {
          const m = movimientoOf(antes, despues);
          a = scoreAnswer((q as { criteria: ScoreCriteria }).criteria, m.consistencia, c);
          break;
        }
        default:
          throw new Error(`HeuristicDecider no sabe responder "${name}"`);
      }
      answers[name] = a as ResultFor<Q[typeof name]>;
    }

    const size = JSON.stringify(request.state).length;
    return { model: HEURISTIC_ENGINE, answers, usage: { input_tokens: size, output_tokens: 0 } };
  }
}
