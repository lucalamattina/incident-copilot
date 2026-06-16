# Zero-write trust boundary

IncidentCopilot has no write capability of any kind. It reads playbooks, deploys, and logs, and it produces text: answers, surfaced playbooks, recommendations. It cannot page, post, deploy, restart, or modify anything. Every action that touches the outside world is taken by the human.

This is a deliberate v1 stance, not a missing feature. The copilot is a supporting tool that accelerates an engineer's orientation under stress, not a source of truth or an actor. The structural consequence is that the boundary is enforced by construction: there are simply no write tools, so the agent cannot act even if it wanted to. The only residual risk is the agent *claiming* in text to have acted, which the Tier-two trust-boundary property check guards against. Relaxing this stance later (e.g. a gated "draft a Slack incident summary for human approval" capability) is an explicit redesign, not an incremental tweak.
