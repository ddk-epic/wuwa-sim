# Structured trigger predicate over closed event taxonomy

Buff triggers are a structured predicate `{ event, ...filters }` over a small closed set of events (`skillCast`, `hitLanded`, `swapIn`, `swapOut`, `simStart`, `resourceCrossed`, etc., grown deliberately). Filters are typed per event. We rejected (a) hardcoding one trigger kind per WuWa interaction (the enum balloons fast) and (b) tag-based event subscription (overkill, and tag taxonomy becomes load-bearing in invisible ways). The structured-filter approach keeps the event taxonomy small while pushing per-buff specificity into typed, pure-data filters.

## Consequences

- `skillCast`-like events fire **before** the action's hits are resolved (the buff covers the action it triggered on — matches in-game intro-skill behavior).
- `hitLanded`-like events fire **after** the hit's damage is computed (the buff applies to the _next_ hit onward).
- New event kinds require code changes in both the engine emitter and the filter type. This is the same cost as adding a hardcoded trigger but the per-buff specificity comes free thereafter.
