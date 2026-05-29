# hitLanded triggers use `stageId`, symmetric with skillCast

> **Partially superseded by ADR-0024.** The core decision stands: `hitLanded` keys
> on the namespaced `stageId`, not a bare stage name. Superseded by the
> SkillCategory-lineage rework:
>
> - **stageId format** — examples below use the pre-ADR-0023 form (`"Inferno Rider::Tap"`,
>   `makeStageId`); the current form is `echo.<name>.<stage>::echo-skill.<n>` produced by
>   `makeEchoStageId` (e.g. `echo.inferno-rider._::echo-skill.3`).
> - **"symmetric matcher" claim** — no longer holds. `hitLanded`/`healLanded` now match by
>   lineage **prefix** (`stageIdMatches` in `instance-store.ts`), while `skillCast` stays
>   **exact-equality**. The asymmetry is intentional: hit events carry a `.<n>` hit-index
>   suffix that cast events don't.
> - **`hitIndex` field** — removed. The hit index is now encoded in the stageId string
>   itself (`...::echo-skill.3`); a trigger pins a specific hit by including the `.<n>` suffix.

`Trigger.hitLanded` filters on the namespaced `stageId` (e.g. `"Inferno Rider::Tap"`), not the bare stage name. This matches `Trigger.skillCast`, which has used `stageId` since its introduction. The `stage` field — a free-form stage name without a skill namespace — is removed.

```ts
// before
trigger: {
  event: "hitLanded",
  stage: "Tap",        // unnamespaced — collides across skills
  hitIndex: 3,
}

// after
trigger: {
  event: "hitLanded",
  actor: "self",
  source: "self",
  stageId: "Inferno Rider::Tap",
  hitIndex: 3,
}
```

The motivating bug: Inferno Rider's "after 3rd Tap hit, +12% Fusion & Basic" buff was authored with `stage: "Tap"`. Impermanence Heron also has a stage named "Tap"; nothing prevents a future skill or echo from adding a third "Tap" with three or more damage entries. The unnamespaced filter would then false-trigger Inferno Rider's buff on hits the author never intended.

Stage names are not unique across skills, but `stageId` (encoded as `"<Skill name>::<Stage newName>"` by `makeStageId`) is. `EngineEvent.hitLanded` already had this information available at the call site (`simulation-log.ts` builds it for the parallel `skillCast` event); it simply wasn't forwarded.

## Considered Options

- **Keep `stage` (status quo), tighten Inferno Rider with `actor: "self"` + `skillType: "Echo Skill"`.** Rejected: doesn't address the underlying collision risk — a wielder equipping two echoes whose skills both have a stage named "Tap" with ≥3 hits would still false-trigger. The fix is fragile by inspection.
- **Keep `stage`, add `stageId` alongside.** Rejected: two fields answering the same question with overlapping semantics is the kind of footgun that produces "why is the filter not matching" tickets. Only one consumer of `stage` exists today (Inferno Rider, plus matching test fixtures); renaming is cheap.
- **Synthetic-hit `stageId`.** Synthetic hits from `emitHit` carry no source stage (they originate from a buff effect, not a Stage). `stageId` stays `undefined` on synthetic events; a trigger with `stageId: "X"` correctly never matches synthetics. No additional gating field needed.

## Consequences

- `Trigger.hitLanded.stage: string` → `stageId: string | string[]`. Array form supports filtering on a set of stages in one trigger, matching `Trigger.skillCast.stageId`.
- `EngineEvent.hitLanded.stage?: string` → `stageId?: string`.
- `simulation-log.ts` passes `stageId: resolved.stageId` (already computed for the sibling skillCast event) instead of `stage: resolved.stageName`.
- `instance-store.ts` `matchesTrigger`: the `stage`-equality branch in the hitLanded arm is replaced by the same `stageId` array-or-string check already used in the skillCast arm.
- `src/data/echoes/inferno-rider.ts`: trigger updated to the form above (adds `actor: "self"`, `source: "self"`; replaces `stage` with `stageId`).
- `src/lib/engine/instance-store.test.ts` — the `stage + hitIndex` test block (#94) renames `stage` → `stageId` and uses namespaced fixtures.
- `BUFFS.md` — the trigger reference is updated to document `stageId` and `hitIndex` on hitLanded (currently undocumented).
- Synthetic hits emitted via `emitHit` continue to carry no `stageId`. A trigger that filters on `stageId` is therefore implicitly restricted to authored (real) hits, regardless of `source`. Authors who want synthetic-only stage filtering would need an explicit `source: "synthetic"` and a future `sourceBuffId` filter (already supported).
