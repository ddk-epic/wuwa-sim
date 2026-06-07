# Hierarchical stage ID encodes skill lineage

Stage IDs are reworked from `"<SkillName>::<StageName>"` to `"char.<name>.<skill-type>.<skill-name>.<stage-name>.<hit-index>"` (e.g. `char.shorekeeper.resonance-skill.chaos-theory.healing.1`). The new format encodes the full lineage of every hit: which character, which skill category, which skill, which stage, which hit. This replaces both `stageId` and `hitIndex` as separate fields on events and triggers — the ID itself is the single source of truth.

The motivating case is Stellar Symphony's passive "when casting Resonance Skill that heals": the weapon buff must distinguish heals originating from a Resonance Skill vs. heals from other skill types. Under the old scheme, `skillType` on hit/heal events was sourced from the per-damage-entry `type` field (a damage-calc concern), not the parent skill's category. These are different things — a Resonance Skill can contain hits typed as "Basic Attack" for `skillTypeBonus` purposes. The hierarchical ID lets the engine parse the true skill category from the ID without a separate `parentSkillType` field.

## Considered Options

- **Add a `parentSkillType` field to hit/heal events.** Rejected: introduces a second "skill type" concept on every event, with the existing `skillType` (from `hit.type`) still present for damage calc. Two fields answering "what kind of skill is this?" with different answers is a footgun.
- **Keep `hitIndex` as a separate field.** Rejected: `hitIndex` is already encoded positionally in the hierarchical ID. Removing the field eliminates a redundant axis and simplifies trigger definitions — one `stageId` match replaces `stageId` + `hitIndex`.
- **Use `::` or mixed separators.** Rejected: dots are consistent with buff ID conventions (`char.verina.outro.blossom-amp`). No edge case requires a different separator since all segments are kebab-cased.

## Consequences

- `stageId` format changes from `"<SkillName>::<StageName>"` to `"char.<name>.<skill-type>.<skill-name>.<stage-name>.<hit-index>"`. All 4 existing characters and their echo/weapon buff triggers must be updated.
- `hitIndex` field is removed from `EngineEvent`, `Trigger.hitLanded`, and `Trigger.healLanded`. Triggers that previously matched on `hitIndex` now match on the full stageId or a suffix pattern.
- `skillType` on hit/heal events is parsed from the stageId's skill-type segment, reflecting the parent skill's category. The per-damage-entry `type` field remains solely for damage calculation (`skillTypeBonus`).
- `makeStageId` in the catalog is updated to produce the new format. Saved timelines undergo the same best-effort migration path described in ADR-0009.
- Supersedes the `stageId` format defined in ADR-0009 and the `hitLanded` stageId symmetry from ADR-0014. The structural decisions in those ADRs (single canonical ID, no bare stage names) still hold — only the encoding changes.
