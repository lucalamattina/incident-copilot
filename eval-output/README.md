# Captured eval runs

Real output from the evaluation CLIs, against `claude-sonnet-4-6` (agent) graded by `claude-opus-4-8` (judge). These are the receipts behind the numbers in [../EVALUATION-FINDINGS.md](../EVALUATION-FINDINGS.md).

- `tier1.txt`: exact assertions over the golden set (`npm run eval:tier1`)
- `tier2-verdicts.txt`: per-property verdicts with the judge's rationales (`npm run eval:tier2:verdicts`)
- `tier2-passrates-before.txt`: Tier-2 pass-rates at N=10, before the grounding-prompt fix
- `tier2-passrates-after.txt`: Tier-2 pass-rates at N=10, after the grounding-prompt fix
- `calibration.txt`: judge-vs-human agreement on the labelled samples (`npm run eval:tier2:calibrate`)
- `tier3.txt`: authored-scenario conclusion + sufficiency at N=10 (`npm run eval:tier3`)

Pass-rates are sampled over a non-deterministic agent, so exact numbers vary run to run; these captures are representative. The judge rationales quoted in the `.txt` files are verbatim model output.
