import { describe, expect, it } from "vitest";
import { asBoolean, choice, decide, decideOrEscalate, FakeDecider, noul, score } from "./index.js";

const questions = {
  urgent: noul("Is this urgent?"),
  team: choice("Which team?", { billing: null, tech: null, other: null }),
  severity: score("How severe?", ["none", "low", "high"]),
};

describe("decide", () => {
  it("returns typed answers and flags nothing when confident", async () => {
    const fake = new FakeDecider({ urgent: true, team: "tech", severity: 2 });
    const d = await decide(fake, "server is down", questions);
    expect(asBoolean(d.answers.urgent)).toBe(true);
    expect(d.answers.team.choice).toBe("tech");
    expect(d.answers.severity.score).toBe(2);
    expect(d.certain).toBe(true);
    expect(d.uncertain).toEqual([]);
  });

  it("flags low-confidence answers per question", async () => {
    const fake = new FakeDecider({ urgent: 0.95, team: "billing" }, 0.6);
    const d = await decide(fake, "hmm", questions, { minConfidence: { urgent: 0.5, team: 0.9 } });
    expect(d.uncertain).toEqual(["team", "severity"]);
    expect(d.certain).toBe(false);
  });

  it("escalates only when uncertain", async () => {
    const sure = new FakeDecider({ team: "billing" });
    const a = await decideOrEscalate(
      sure,
      "charged twice",
      { team: questions.team },
      async () => "llm",
      (d) => d.answers.team.choice,
    );
    expect(a).toMatchObject({ result: "billing", escalated: false });

    const unsure = new FakeDecider({ team: "billing" }, 0.4);
    const b = await decideOrEscalate(
      unsure,
      "charged twice",
      { team: questions.team },
      async () => "llm",
      (d) => d.answers.team.choice,
    );
    expect(b).toMatchObject({ result: "llm", escalated: true });
  });
});
