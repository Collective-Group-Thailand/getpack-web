# ADR-0011 — Composable style recipes

**Status:** Accepted (2026-10-02) · U3.1

## Context

`@getpack/dieline` had 30 hand-written styles (F4 Part B). They already shared constructions — a
four-panel tube with pluggable closures, a cross tray with wall extras — but every style was a
TypeScript file that wired them together, computed its own compensation and coded its own rules.
The style library programme (`docs/design-tool/style-library-program.md`) needs 105 base
structures and ≈ 960 structural variants, each validated, folded, priced and makeable. At one
file per style that is a code release per variant, rules no solver can read, and nothing
getpack-api's catalogue (U3.B1) can import.

Options:

- **Keep one TypeScript file per style**, add the rest the same way — no new machinery, but 960
  variants as code, and the rules stay opaque to the solver (U3.2) and the API.
- **Recipes as TypeScript objects** — typed, but still code: not reviewable as data, not
  importable by the API without executing the package.
- **Recipes as JSON over code modules** — the construction geometry stays code, everything a
  prepress engineer reviews (which modules, sizes, compensation, rules, names, presets) becomes
  data.

## Decision

- **A style is a recipe** (`StyleRecipe`, `packages/dieline/src/recipes/data/<id>.json`,
  `schemaVersion: 1`): one **body** (or a **piece set**), a **closure** per end, **features**,
  parameters (keys into `params.json`, with overrides), defaults and presets (or named shared
  sets in `sets.json`), names, rules and the closed size. `styleFromRecipe` turns it into the
  `BoxStyleDef` the registry has always exposed, so `STYLES`, `getStyle`, aliases and the 26 app
  files that import the package do not change; `buildFromRecipe` returns the dieline, the hinge
  map and the parameter limits.
- **A module** (`src/modules/`) is a construction a factory recognises. It declares the
  parameters it reads, its **constraints**, the face kinds and line roles it **contributes**,
  its part of the **hinge map**, the **processes** a factory needs (`die_cut`,
  `folder_gluer_crash_lock`, `window_patching`… — the capability-matrix vocabulary for U3.B3),
  and named **presets** of its settings. Geometry is the existing `construct/` builders; a
  module wraps them, it does not redraw them.
- **Sizes and rules are expressions** in a small language (`src/expr.ts`): arithmetic,
  comparisons, `and`/`or`/`not`, `??`, `?:`, the parameters, the body's named sizes (`dims`),
  `t`, `a.panel`…, `C.<constant>` and a fixed list of functions (`min`, `tuckDepthFor`,
  `slotWidth`…). It is hand-parsed — no `eval` — and **three-valued**: a constraint fails only
  when its `require` is definitely false, so a rule over an unset value never fires, exactly as
  the hand-written checks behaved. Constraints keep the issue codes the UI already translates.
  A rule that needs the built geometry (a window inside its panel) stays a coded `check` on the
  module.
- **Order is defined**: the recipe's own constraints, then each module in recipe order (body,
  top, bottom, features) — its data rules, then its coded check; a constraint id is checked once
  (a tuck at both ends).
- **Straight and reverse tuck are pairs of one `tuck` closure** (lid on the back at both ends, or
  on opposite panels), not separate generators. `tube4` and the hexagonal `ngonTube` are presets
  and settings of one `tube` body.
- **Modules not used by any recipe yet are declared `planned`**, with their processes, so
  recipes, the catalogue and coverage reports can name them; building one throws
  `module.not_implemented`. U3.4 implements each before the first recipe that uses it.
- **A recipe maps to its master-file base** (`base: "PK-TE-01"`, `variant: { tuck_top, … }`) —
  informational; public codes and their immutability are the API's (D-184). Reference codes are
  not added: D-211 waits on Prepress.
- **Recipes are checked by `parseRecipe` in the test suite and before any recipe from outside
  is used**, not at package load: the browser would pay for the checker on every page.

## Consequences

- Re-expressing the 30 styles changed **no output**: `fixtures/baseline/<style>.json` pins a hash
  of every build, hinge map, validation and closed size for every preset on every reference board
  and for every single-option change (1,164 cases), written from the hand-written styles before
  the switch; the SVG/DXF snapshots and pattern fixtures are untouched.
- A new variant of an existing construction is a JSON file reviewed by prepress; a new
  construction is a module plus its recipes. The solver (U3.2) reads the same constraints the
  validator runs.
- Recipe data ships with the engine. With 30 recipes it costs the designer route about 7 KB of
  compressed JavaScript over the hand-written styles (PROGRESS U3.1). At U3.4 scale recipes must
  leave the initial bundle — loaded per style when it is opened, or read from the API (U3.B2) —
  before wave 1 lands.
- `noUncheckedIndexedAccess` stays off (ADR-0007); module settings are typed loosely
  (`ModuleConfig` is JSON), so `parseRecipe` is what catches a misspelt setting, label or
  function.
