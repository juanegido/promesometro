import { FakeDecider } from "@jev/decide";
import { describe, expect, it } from "vitest";
import { routeCapability } from "./index.js";

describe("routeCapability", () => {
  it("routes with entity choice when scope has several entities", async () => {
    const fake = new FakeDecider({
      capability: "get_price_report",
      entity: "FR",
      comparison: false,
      breakdown: false,
      productFilter: true,
    });
    const r = await routeCapability(fake, {
      question: "Precio de Nuxe vs competencia en Francia esta semana",
      scope: ["IB", "FR"],
    });
    expect(r.capability).toBe("get_price_report");
    expect(r.entity).toBe("FR");
    expect(r.hints.productFilter).toBe(true);
    expect(r.uncertain).toEqual([]);
    const asked = fake.calls[0]?.questions ?? {};
    expect(Object.keys(asked)).toContain("entity");
    expect(Object.keys((asked.entity as { criteria: object }).criteria)).toEqual(["IB", "FR"]);
  });

  it("skips the entity question and fixes entity when scope has one", async () => {
    const fake = new FakeDecider({ capability: "get_sales_report", comparison: true });
    const r = await routeCapability(fake, { question: "ventas vs año pasado", scope: ["IT"] });
    expect(r.entity).toBe("IT");
    expect(r.hints.comparison).toBe(true);
    expect(Object.keys(fake.calls[0]?.questions ?? {})).not.toContain("entity");
  });

  it("surfaces uncertainty instead of guessing", async () => {
    const fake = new FakeDecider({ capability: "run_druid_query" }, 0.4);
    const r = await routeCapability(fake, { question: "cosas", scope: ["IB"] });
    expect(r.uncertain).toContain("capability");
  });
});
