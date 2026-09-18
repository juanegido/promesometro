import type { EntryType, Questions, RequestOptions, SystemOneResult } from "@typesafe-ai/sdk";

/** Anything that can answer a System One request. The real client and the fake both satisfy it. */
export interface Decider {
  systemOne<const Q extends Questions>(
    request: { state: EntryType; questions: Q; model?: string },
    options?: RequestOptions,
  ): Promise<SystemOneResult<Q>>;
}

/** Per-question or global confidence thresholds, from 0 to 1. */
export type Thresholds<Q extends Questions> = number | { [K in keyof Q]?: number };

export interface DecideOptions<Q extends Questions> {
  /** Minimum confidence (choice/score) or distance from 0.5 (noul) to count as certain. Default 0.7. */
  minConfidence?: Thresholds<Q>;
  /** Forwarded to the client. */
  request?: RequestOptions;
}

export interface Decision<Q extends Questions> extends SystemOneResult<Q> {
  /** Names of the questions whose answer did not meet the threshold. */
  readonly uncertain: readonly (keyof Q & string)[];
  /** True when every question met its threshold. */
  readonly certain: boolean;
}
