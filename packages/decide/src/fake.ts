import type {
  ChoiceCriteria,
  EntryType,
  Question,
  Questions,
  ResultFor,
  ScoreCriteria,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import type { Decider } from "./types.js";

/** A scripted answer: a label for choice, a number for score, a probability for noul. */
export type Scripted = string | number | boolean;

export interface FakeCall {
  state: EntryType;
  questions: Questions;
}

/**
 * Deterministic Decider for tests. Answers come from a script keyed by question name;
 * unscripted questions get the first option, score 0, or noul 0.5.
 */
export class FakeDecider implements Decider {
  readonly calls: FakeCall[] = [];
  #script: Record<string, Scripted>;
  #confidence: number;

  constructor(script: Record<string, Scripted> = {}, confidence = 0.95) {
    this.#script = script;
    this.#confidence = confidence;
  }

  script(next: Record<string, Scripted>): this {
    this.#script = { ...this.#script, ...next };
    return this;
  }

  async systemOne<const Q extends Questions>(request: {
    state: EntryType;
    questions: Q;
    model?: string;
  }): Promise<SystemOneResult<Q>> {
    this.calls.push({ state: request.state, questions: request.questions });
    const answers = {} as { [K in keyof Q]: ResultFor<Q[K]> };
    for (const name of Object.keys(request.questions) as (keyof Q & string)[]) {
      const q = request.questions[name];
      if (q === undefined) continue;
      answers[name] = this.#answer(q, this.#script[name]) as ResultFor<Q[typeof name]>;
    }
    return {
      model: request.model ?? "fake-jev",
      answers,
      usage: { input_tokens: JSON.stringify(request.state).length, output_tokens: 0 },
    };
  }

  #answer(question: Question, scripted: Scripted | undefined): ResultFor<Question> {
    const conf = this.#confidence;
    switch (question.type) {
      case "noul": {
        const p =
          typeof scripted === "boolean" ? (scripted ? conf : 1 - conf) : Number(scripted ?? 0.5);
        return { type: "noul", noul: p };
      }
      case "choice": {
        const labels = Object.keys(question.criteria as ChoiceCriteria);
        const pick =
          typeof scripted === "string" && labels.includes(scripted) ? scripted : labels[0];
        if (pick === undefined) throw new Error("choice needs at least one label");
        const rest = labels.length > 1 ? (1 - conf) / (labels.length - 1) : 0;
        const probabilities = Object.fromEntries(labels.map((l) => [l, l === pick ? conf : rest]));
        return { type: "choice", choice: pick, confidence: conf, probabilities };
      }
      case "score": {
        const criteria = question.criteria as ScoreCriteria;
        const n = criteria.length;
        const pick = Math.min(n - 1, Math.max(0, Number(scripted ?? 0)));
        const rest = n > 1 ? (1 - conf) / (n - 1) : 0;
        const probabilities = Object.fromEntries(
          criteria.map((_, i) => [String(i), i === pick ? conf : rest]),
        );
        const legend = Object.fromEntries(criteria.map((c, i) => [String(i), c]));
        return { type: "score", score: pick, confidence: conf, legend, probabilities };
      }
    }
  }
}
