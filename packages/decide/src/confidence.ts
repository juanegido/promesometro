import type { Question, ResultFor } from "@typesafe-ai/sdk";

/**
 * Normalise an answer into a single 0..1 confidence figure.
 * Noul reports a probability, so confidence is how far it sits from the coin flip at 0.5.
 */
export function confidenceOf(answer: ResultFor<Question>): number {
  switch (answer.type) {
    case "noul":
      return Math.abs(answer.noul - 0.5) * 2;
    case "choice":
    case "score":
      return answer.confidence;
  }
}

/** Noul probability to boolean, using 0.5 as the cut. */
export function asBoolean(answer: { noul: number }): boolean {
  return answer.noul >= 0.5;
}
