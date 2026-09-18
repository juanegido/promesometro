import { asBoolean, choice, type Decider, decide, noul } from "@jev/decide";
import type { JsonValue } from "@typesafe-ai/sdk";
import { CAPABILITIES, type Capability, ENTITIES, type Entity } from "./catalog.js";

export interface RouteInput<S extends readonly Entity[]> {
  /** The user's question, verbatim. */
  question: string;
  /** Entities the user may access; comes from AIDA's `_userPolicy.scope`. */
  scope: S;
  /** Optional prior turns, most recent last, to disambiguate follow-ups. */
  history?: readonly string[];
}

export interface Route<S extends readonly Entity[]> {
  capability: Capability;
  /** Chosen entity, restricted to the user's scope. `null` when the scope has one entity or none fits. */
  entity: S[number] | null;
  hints: {
    /** Compare against previous period or last year. */
    comparison: boolean;
    /** Wants a breakdown by dimension rather than a total. */
    breakdown: boolean;
    /** Narrows to one SKU, brand or product. */
    productFilter: boolean;
  };
  confidence: { capability: number; entity: number | null };
  /** Questions Jev was not confident about; a non-empty list is the cue to fall back to an LLM. */
  uncertain: readonly string[];
  probabilities: Record<Capability, number>;
}

function entityCriteria<S extends readonly Entity[]>(scope: S) {
  const c: Partial<Record<Entity, string>> = {};
  for (const e of scope) {
    if (e === "IB") c.IB = "Iberia: Spain and Portugal; Atida ES, Atida PT, Dosfarma, Mifarma";
    if (e === "IT") c.IT = "Italy: eFarma";
    if (e === "FR") c.FR = "France: Atida.fr, Santédiscount";
  }
  return c as { [K in S[number]]: string };
}

/**
 * One Jev call decides capability, entity and parameter hints for an AIDA question.
 * Entities outside the scope are never offered as options, so they cannot be chosen.
 */
export async function routeCapability<const S extends readonly Entity[]>(
  decider: Decider,
  input: RouteInput<S>,
  minConfidence = 0.7,
): Promise<Route<S>> {
  const scope = input.scope.filter((e): e is Entity => (ENTITIES as readonly string[]).includes(e));
  const multiEntity = scope.length > 1;

  const base = {
    capability: choice("Which Atida data capability answers this question?", CAPABILITIES),
    comparison: noul("Does the question ask to compare with a previous period or last year?"),
    breakdown: noul(
      "Does the question ask for a breakdown by dimension (brand, category, store, channel, day)?",
    ),
    productFilter: noul("Does the question narrow to a specific SKU, product or brand?"),
  };
  const questions = multiEntity
    ? {
        ...base,
        entity: choice("Which market/entity does the question refer to?", entityCriteria(scope)),
      }
    : base;

  const state: { [key: string]: JsonValue } = {
    question: input.question,
    history: [...(input.history ?? [])],
    user_scope: [...scope],
  };

  const d = await decide(decider, state, questions, { minConfidence });
  const a = d.answers as typeof d.answers & { entity?: { choice: string; confidence: number } };

  return {
    capability: a.capability.choice,
    entity: multiEntity
      ? (a.entity?.choice as S[number])
      : ((scope[0] as S[number] | undefined) ?? null),
    hints: {
      comparison: asBoolean(a.comparison),
      breakdown: asBoolean(a.breakdown),
      productFilter: asBoolean(a.productFilter),
    },
    confidence: { capability: a.capability.confidence, entity: a.entity?.confidence ?? null },
    uncertain: d.uncertain,
    probabilities: a.capability.probabilities,
  };
}
