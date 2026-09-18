# jev

Typed, confidence-aware decisions for AIDA, built on [TypeSafe's Jev](https://typesafe.ai) System One model.

Jev answers typed questions (yes/no, choice, score) about a state in one parallel pass, in well under a second, without generating text. This repo uses it for the small, repeated decisions that AIDA currently spends LLM calls on: which data capability answers a question, which market it refers to, whether to escalate.

## Packages

| Package | What it does |
| --- | --- |
| `@jev/decide` | Thin layer over `@typesafe-ai/sdk`: `decide()` flags answers below a confidence threshold, `decideOrEscalate()` falls back to an LLM only when Jev is unsure, `FakeDecider` scripts answers for tests. |
| `@jev/capability-router` | One Jev call routes an AIDA question to an Atida Data Foundation capability, picks the entity within the user's scope, and extracts parameter hints (comparison, breakdown, product filter). Entities outside `_userPolicy.scope` are never offered as options. |

## Quickstart

```sh
pnpm install
pnpm test
cp .env.example .env   # add TYPESAFE_API_KEY
pnpm example:route "¿Qué SKUs de Isdin están sin stock en España?"
```

```ts
import { TypeSafeClient } from "@jev/decide";
import { routeCapability } from "@jev/capability-router";

const route = await routeCapability(new TypeSafeClient(), {
  question: "Ventas de Nuxe en Francia vs el año pasado por tienda",
  scope: ["IB", "FR"],
});
// route.capability === "get_sales_report", route.entity === "FR"
// route.hints.comparison === true, route.hints.breakdown === true
// route.uncertain lists questions under the threshold; non-empty means fall back to an LLM
```

## Roadmap

- `@jev/model-router`: choose the Claude model per turn with a Choice plus a complexity Score.
- `@jev/memory-gate`: gate writes to Atida Central Memory (durable or not, namespace, classification, duplicate check).
- `@jev/agent-review`: post-run checks on AIDA answers (answered the question, invented figures, left the entity scope).
- `@jev/evals`: measure routing accuracy of Jev against the current LLM on real AIDA questions.
- Generate the capability catalog from `describe_capability` and pin its `spec_hash`.

## Development

```sh
pnpm build       # tsc per package
pnpm typecheck
pnpm test        # vitest
pnpm lint        # biome
```
