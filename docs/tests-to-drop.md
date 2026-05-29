# Tests to Drop

## Rules for dropping

- **Trivial formatting**: test is just "multiply and format"; a UI glance catches regressions faster than the test suite
- **No real logic**: the code path has no branching, filtering, or domain math — it can't silently break in a non-obvious way
- **Strict subset**: another test already exercises the same branches and more — keeping both adds maintenance cost with no extra coverage
- **Strict subset across layers**: if a higher-level test (component, integration, or engine) already verifies a behavior AND the wiring that produces it, a lower-level test checking only the behavior is redundant — drop the lower-level test. Applies across files: e.g. an engine test covering multi-effect dispatch makes a data test re-asserting the same pattern redundant
- **TypeScript-enforced shape**: tests that assert structural properties (field presence, enum membership, uniqueness) already guaranteed by `satisfies` or explicit type annotations — the compiler is the right layer, drop the test
- **Value duplication across layers**: when a higher-layer test (hook, component, integration) re-asserts concrete values that a lower-layer unit test already pins, trim it to verify only the _wiring_ — that the value flowed through — and delegate the value table to the unit test. Don't maintain the same expected values in two places. This is a trim, not a delete: the wiring assertion still earns its keep (e.g. a `useTeam` test asserting `loadouts[0]` equals `loadoutFromTemplate(...)` rather than re-listing each resolved id that `template.test.ts` already checks)
