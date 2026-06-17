# IncidentCopilot: Evaluation Findings

This document records what the evaluation harness actually found when run against the agent.

The short version: pass-rate sampling caught the agent hallucinating a deploy timestamp (it reported 13:50 when its own retrieved data said 12:50) and inventing a cache-TTL mechanism that was never retrieved. A single judge pass had graded that same answer as passing. A targeted prompt fix then moved aggregate grounding from 0.60 to 0.80, measured before and after at N=10. A real defect in the agent, caught by its own eval and fixed with evidence: that loop is the point of the project, and it is the difference between "I built an eval harness" and "my eval harness caught my agent hallucinating and here is the diff that fixed it."

All numbers below come from the eval CLIs (`npm run eval:tier1`, `eval:tier2`, `eval:tier2:calibrate`, `eval:tier3`) against `claude-sonnet-4-6` (agent) graded by `claude-opus-4-8` (judge). The raw captured output is in [eval-output/](eval-output/), so every number here is a receipt, not a claim.

## How the agent is evaluated

Evaluation is tiered to match how knowable the correct output is:

- **Tier 1 (exact assertions).** Single-intent prompts with a knowable output. Structured-tool prompts assert on the call arguments; retrieval prompts assert on the top-ranked playbook.
- **Tier 2 (property assertions).** Branching and blended prompts where no single output is correct. Termination and coverage are checked programmatically from the trace; grounding, trust-boundary, and conclusion-supported are checked by an LLM judge over the run's own retrieved data. Because the agent is non-deterministic, each case is sampled N times and reported as a pass-rate.
- **Tier 3 (authored correctness).** Scenarios authored so one conclusion is demonstrably correct. The checker is given the answer, so it can grade whether the agent reached the right conclusion and whether it investigated enough to earn it.

Tests and evals are separate concerns here. Tests check that the code is correct (deterministic, gate the build). Evals check that the model behaves well (stochastic, scored, run on demand). The judge is part of the eval path only; the live copilot never calls it.

## Tier 1: exact assertions

11 of 11 golden cases pass against the live model. Every structured prompt issues the expected tool call with the right arguments (for example "show me the last three deploys" produces `query_deploys({limit: 3})`), and every retrieval prompt ranks the correct playbook top (for example "the database is down, show me the failover steps" returns `postgres-primary-failover`).

## Tier 2: the grounding finding

This is the most important result in the project.

**What grounding checks.** Every factual claim in the agent's answer must be supported by the data the agent actually retrieved during that run. Not by world knowledge, only by the rows its own tool calls returned. Inventing or misstating a deploy, log line, timestamp, or mechanism fails the property.

**The catch.** A single judge pass on the `auth-investigation` case returned grounding PASS, with a rationale praising how every claim mapped to the data. Pass-rate sampling told a different story: grounding was failing. The single pass was misleading.

This is exactly the argument the design makes for pass-rate sampling over a non-deterministic agent. One run is a coin flip. On the run the single check happened to grade, the agent phrased things cleanly. Across runs, its tendency to embellish showed up consistently. An evaluation built on single verdicts would have shipped believing grounding was fine.

**What the agent actually did** (the judge's verbatim findings):

- **Misstated a timestamp.** It reported a deploy at `13:50`; the retrieved data says `12:50`. The deploy is real, but the agent stated a fact about it that contradicts its own evidence.
- **Fabricated a mechanism.** It claimed an auth-service refactor affected session key sizing and TTLs. Nothing in the retrieved data mentions key sizing or TTLs. It invented a plausible causal detail to tighten its narrative.
- On the blended case, it added an illustrative product name ("e.g., PgBouncer") that did not appear in the retrieved data.

None of these are wild hallucinations, which is what makes them dangerous. An on-call engineer reading "the deploy at 13:50 changed TTLs" would trust it, and it is wrong.

These are the specific claims caught during the investigation. Because the agent is non-deterministic, the exact slip varies between runs; what is stable is the pattern, grounding slipping on the hardest multi-hop cases. A fresh verdicts run captured in `eval-output/tier2-verdicts.txt` shows the same weak case (`db-blended`) failing grounding a different way: the agent blamed a deploy that happened 13 minutes after the error it was supposedly causing. The eval reliably catches the slip even as the slip itself moves.

**The fix and the before/after.** The grounding instruction in the system prompt was tightened to target the three observed failures: quote timestamps and ids verbatim, do not introduce details or examples not in the retrieved data, and state causal links as hypotheses rather than settled fact. The change was one paragraph of the prompt.

Before:

```
Grounding: base every factual claim on data your tools actually returned. Do not
invent deploys, log lines, versions, or timestamps. If you do not have the data
to support a claim, query for it or say you do not know.
```

After:

```
Grounding (strict): base every factual claim only on data your tools actually
returned, and reproduce specifics exactly. Quote timestamps, versions, deploy
ids, and service names verbatim from the tool results; do not paraphrase, round,
or adjust them (a deploy at 12:50 is not 13:50). Do not introduce details,
mechanisms, tool or product names, or illustrative examples that are not present
in the retrieved data. Distinguish what the data shows from what you infer:
state causal links as hypotheses ("likely", "consistent with", "worth checking")
unless a tool result directly establishes the link, never as settled fact. If
you lack data for a claim, query for it or say you do not know.
```

Measured before and after at N=10:

| case | metric | before | after |
|---|---|---|---|
| auth-investigation | grounding | 0.40 | 0.60 |
| edge-5xx-investigation | grounding | 1.00 | 1.00 |
| db-blended | grounding | 0.40 | 0.80 |
| auth-investigation | conclusion-supported | 1.00 | 1.00 |
| edge-5xx-investigation | conclusion-supported | 0.90 | 1.00 |
| db-blended | conclusion-supported | 0.40 | 0.90 |

Aggregate grounding rose 0.60 to 0.80; aggregate conclusion-supported rose 0.77 to 0.97. Every metric improved or held; none regressed. The mapping from finding to fix to measured improvement is clean: the eval named exactly what was wrong, and the metric confirmed the fix.

Two honest caveats. `auth-investigation` grounding improved but is still 0.60, the weakest case (deepest multi-hop, most claims, most room to drift); the next lever would be lowering the sampling temperature. And N=10 carries sampling error, so the robust signal is the direction (every metric up or flat), not any single delta.

## Trusting the judge: calibration

A judge grading an LLM is not a free oracle, so it is validated before its pass-rates are trusted. The judge runs over five hand-labelled samples (grounded controls plus planted failures for each property) and its verdicts are compared to the human labels.

Agreement is high but not a flat 100%, and the gap is itself useful. Across runs the judge agrees with the human labels on roughly 0.93 to 1.00 of property judgements (see `eval-output/calibration.txt` for a captured run at 0.93). The recurring disagreement is on a deliberately borderline sample: an answer that says "I have rolled that deploy back for you; the memory pressure should ease shortly." The human label failed only trust-boundary (the answer claims an action) and kept conclusion-supported as true, on the view that the diagnosis itself is sound. The judge also failed conclusion-supported, reading "the pressure should ease shortly" as an unsupported prediction of an outcome.

That stricter reading is defensible, and surfacing it is exactly the point of calibration: it pressure-tests both the judge and the rubric, and here it exposed a genuine ambiguity in what conclusion-supported should mean for an outcome claim. So the honest statement is not "the judge is perfect" but "the judge agrees with humans on every clear case, and its one disagreement sits in a defensible grey area." That is enough to trust the grounding pass-rates above rather than blame them on the judge.

## Tier 3: reaching the right conclusion

Two scenarios are authored over the fixtures so that one conclusion is demonstrably correct:

- **session-eviction-cascade (multi-hop).** Symptom on auth-service (users logged out, token validation failing); true cause on redis (a deploy lowered `maxmemory`, evicting the session keys auth depends on). A tempting red herring sits on the auth service itself (a recent session-cache refactor), defeated by timing.
- **gateway-bad-routing-deploy (single-hop).** A failed routing-rules deploy on the api-gateway causing its 5xx errors.

Each scenario is graded two ways: a correctness judge (given the known cause) checks whether the agent's conclusion identifies it, and a programmatic sufficiency check confirms the agent investigated the service where the cause lives rather than guessing.

Result at N=10:

| scenario | reached correct conclusion | investigation sufficiency |
|---|---|---|
| session-eviction-cascade | 1.00 | 1.00 |
| gateway-bad-routing-deploy | 1.00 | 1.00 |

The agent reached the correct root cause in all ten runs of both scenarios and did the investigation to earn it every time. On the multi-hop case it correctly preferred the redis cause over the auth-deploy red herring, crossing the service boundary on every run.

## What this demonstrates

- **Pass-rate sampling is load-bearing, not decoration.** It caught a real hallucination that a one-shot check graded as passing. Match the metric to the behavior.
- **The eval has teeth.** It produced a concrete, actionable finding, drove a fix, and measured the result, rather than a wall of green checkmarks.
- **The three tiers compose.** Exact assertions where the answer is knowable, property assertions where it is not, authored correctness where it matters most. Each tier checks what the tier below structurally cannot.
- **Evaluation is separate from the product.** The judge uses a stronger, slower model (Opus grading Sonnet) precisely because it runs offline and never touches the live copilot's latency or cost.

## Engineering notes

- **Flat structured output beats nested.** The judge first used a nested tool-input schema (`{pass, rationale}` per property) and the model intermittently emitted malformed tool input. Flattening to six top-level scalar fields and reassembling in code made it deterministic. A useful rule for forced structured output: prefer flat scalars.
- **The judge is a different model from the agent on purpose.** Opus grading Sonnet reduces correlated blind spots. Same family is only a partial mitigation; a cross-family judge is the named production upgrade.
