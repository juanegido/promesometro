import type { EntryType, Questions } from "@typesafe-ai/sdk";
import { confidenceOf } from "./confidence.js";
import type { DecideOptions, Decider, Decision, Thresholds } from "./types.js";

const DEFAULT_MIN_CONFIDENCE = 0.7;

function thresholdFor<Q extends Questions>(
  thresholds: Thresholds<Q> | undefined,
  name: keyof Q,
): number {
  if (thresholds === undefined) return DEFAULT_MIN_CONFIDENCE;
  if (typeof thresholds === "number") return thresholds;
  return thresholds[name] ?? DEFAULT_MIN_CONFIDENCE;
}

/**
 * Ask Jev a set of typed questions and flag the answers that are not confident enough.
 * Answer types are inferred from the questions exactly as in the SDK.
 */
export async function decide<const Q extends Questions>(
  decider: Decider,
  state: EntryType,
  questions: Q,
  options: DecideOptions<Q> = {},
): Promise<Decision<Q>> {
  const result = await decider.systemOne({ state, questions }, options.request);
  const uncertain: (keyof Q & string)[] = [];
  for (const name of Object.keys(questions) as (keyof Q & string)[]) {
    const answer = result.answers[name];
    if (confidenceOf(answer) < thresholdFor(options.minConfidence, name)) {
      uncertain.push(name);
    }
  }
  return { ...result, uncertain, certain: uncertain.length === 0 };
}

/**
 * Jev first; when any answer is uncertain, hand the whole decision to a slower fallback
 * (typically an LLM call). The fallback receives Jev's answers so it can reuse the certain ones.
 */
export async function decideOrEscalate<const Q extends Questions, T>(
  decider: Decider,
  state: EntryType,
  questions: Q,
  fallback: (decision: Decision<Q>) => Promise<T>,
  accept: (decision: Decision<Q>) => T,
  options: DecideOptions<Q> = {},
): Promise<{ result: T; escalated: boolean; decision: Decision<Q> }> {
  const decision = await decide(decider, state, questions, options);
  if (decision.certain) return { result: accept(decision), escalated: false, decision };
  return { result: await fallback(decision), escalated: true, decision };
}
