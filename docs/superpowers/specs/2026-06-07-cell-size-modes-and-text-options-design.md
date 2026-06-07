# Cell size modes & text options — design

Two related additions to the resource cell rendering:

1. A toggle that controls whether cell text is capitalized in the Cell-with-text display mode.
2. A new cell-size mode that auto-fits cell width to the text content. The existing two-state lock (`free`/`locked`) becomes a tri-state (`free`/`locked`/`fit`), and the lock semantics are inverted: the height drives both dimensions in `locked` mode (was: width drives both).

## Goals

- Users can disable the default upper-case styling of cell text.
- Users can pick a "fit to text" cell mode (Cell-with-text only) so each cell is sized to its label.
- The lock control still uses a single `IconButton`; clicking it cycles through the available states.
- Existing dashboards keep their visual appearance.

## Non-goals

- Animating transitions between cell modes.
- A "fit to height" or inverse-fit option.
- Capitalize toggle for surfaces other than the cell text (rich table, tooltips don't change).

## Data model

`HostViewerOptions` (`src/types.ts`):

```ts
export type CellSizeMode = 'free' | 'locked' | 'fit';

export interface CellSize {
  width: number;
  height: number;
  mode: CellSizeMode;        // replaces `locked: boolean`
}

// in HostViewerOptions
cellSize: CellSize;
capitalizeCellText: boolean; // default true
```

`DEFAULT_CELL_SIZE` in `src/library/cellSize.ts` becomes `{ width: 20, height: 20, mode: 'locked' }`.

## Migration

`src/migrationHandler.ts` handles:

1. `cellSize` is a number: `{ width: n, height: n, mode: 'locked' }`.
2. `cellSize` is an object that already has a `mode`: leave alone.
3. `cellSize` is an object with `locked: true` (and no `mode`): set `mode: 'locked'`, delete `locked`.
4. `cellSize` is an object with `locked: false` (and no `mode`): set `mode: 'free'`, delete `locked`.
5. `cellSize` is an object with neither `mode` nor `locked` (e.g. corrupt state): set `mode: 'locked'`.
6. `cellSize` is missing, null, or non-object: seed from `DEFAULT_CELL_SIZE`.
7. `capitalizeCellText` is missing: set to `true` (preserves prior behavior).

Existing migration tests for cases 1 and 6 stay; the case-2 test (already-object) is updated to use the new `mode` shape, and new tests cover cases 3, 4, 5, and 7.

## Lock control — tri-state, inverted

The lock semantics flip: in `locked` mode the **height** drives both dimensions (was: width). This makes the width the "computed" dimension in both `locked` and `fit` modes, so the UI behavior of the disabled width field is consistent across both non-free modes.

State behavior:

- **`free`**: both inputs editable. Editing width updates `width`. Editing height updates `height`. Icon: `unlock`.
- **`locked`**: width input disabled, displays `value.height`. Editing height updates both `width` and `height` to the new value. Icon: `lock`.
- **`fit`** (Cell-with-text only): width input disabled, displays the literal text `"auto"`. Editing height updates `height` only. Icon: `arrows-h`.

Cycle on click of the lock button:

- Cell display mode (no `fit` available): `locked ↔ free`.
- Cell-with-text: `free → locked → fit → free`.

`aria-label` / `tooltip` always describes the action the next click performs:
- From `free` (next is `locked`): `"Lock cell width to height"`.
- From `locked` with `fit` available (next is `fit`): `"Fit cell width to text"`.
- From `locked` with `fit` unavailable (next is `free`): `"Allow different width and height"`.
- From `fit` (next is `free`): `"Allow different width and height"`.

Mode persistence across display-mode changes: if the user has `mode: 'fit'` and switches `resourceDisplayMode` to `Cell` (no text), the stored mode stays `fit`. The renderer and the editor's cycle logic both treat `fit` as `locked` when `fit` is not available, so the visual rendering and the button cycle behave as if the mode were `locked` until the user switches back to Cell-with-text.

## Editor (`CellSizeEditor.tsx`)

`CellSizeInput` props gain a flag:

```ts
interface CellSizeInputProps {
  value: CellSize;
  onChange: (value: CellSize) => void;
  allowFit: boolean;
}
```

The Grafana wrapper `CellSizeEditor` reads `context.options.resourceDisplayMode` and passes `allowFit = (displayMode === ResourceDisplayMode.CellWithText)`.

Width input:
- Rendered as `Input` (number) when `mode === 'free'`.
- Rendered as a disabled text-style `Input` showing `value.height` when `mode === 'locked'`.
- Rendered as a disabled text-style `Input` showing `"auto"` when `mode === 'fit'`.
- We use `type="text"` for the disabled variants so the `"auto"` literal renders cleanly; the value is always a string for the controlled render and a number is parsed back via `clampSize` only in the editable path.

Height input: always `Input` (number), always editable, value is `value.height`.

Lock button: `IconButton` whose `name`, `aria-label`, and `tooltip` are computed from `(mode, allowFit)`. Click handler computes the next state:

```ts
function nextMode(current: CellSizeMode, allowFit: boolean): CellSizeMode {
  if (current === 'free') return 'locked';
  if (current === 'locked') return allowFit ? 'fit' : 'free';
  return 'free'; // current === 'fit'
}
```

Transition snapping:
- Entering `locked` from `free`: snap `width` to `value.height`.
- Entering `locked` from `fit`: not reachable in one click (cycle goes fit → free → locked), so no special snap.
- Entering `fit`: leave `width` as-is (ignored at render time).
- Entering `free`: leave both as-is.

Height-change handler:
- `mode === 'free'`: emit `{ ...value, height: clamped }`.
- `mode === 'locked'`: emit `{ width: clamped, height: clamped, mode: 'locked' }`.
- `mode === 'fit'`: emit `{ ...value, height: clamped }`.

Width-change handler:
- `mode === 'free'`: emit `{ ...value, width: clamped }`.
- Other modes: no-op (width input is disabled and not editable).

`CellSizeEditor.tsx` no longer needs the prior `safeValue: CellSize = value ?? DEFAULT_CELL_SIZE` fallback to change shape; we just verify `value.mode` is one of the three known strings and default to `'locked'` if not. (Migration should make this redundant; the fallback covers stale options that haven't gone through migration yet.)

## CellView changes

`getStyles(theme, width, height, mode, allowFit, capitalize)` where `mode` is the stored mode and `allowFit` is derived from display mode (we keep `allowFit` an explicit arg so the rendering function does the coercion itself instead of the caller).

Inside:

```ts
const effectiveMode = mode === 'fit' && !allowFit ? 'locked' : mode;
```

When `effectiveMode === 'fit'`:
- `.cell`: `{ width: 'fit-content', minWidth: height, height }`. Cell never shrinks below a square.
- `.cellText`: `{ width: 'fit-content', minWidth: \`calc(${height}px - ${theme.spacing(1)})\`, height: \`calc(${height}px - ${theme.spacing(1)})\`, lineHeight: \`calc(${height}px - ${theme.spacing(1)} + 1px)\`, paddingLeft: theme.spacing(0.5), paddingRight: theme.spacing(0.5) }`.
- `tier` and `sidecarPad`: derived from `height` (width is unknown until layout).
- `.cellTextSidecar`: same min-width pattern as `.cellText` but using the inner height.

When `effectiveMode !== 'fit'`:
- Behavior identical to current. `.cell` uses fixed `width` and `height`; tier and sidecarPad use `min(width, height)`.

`capitalizeCellText` applies in both branches:
- `.cellText` and `.cellTextSidecar`: `textTransform: capitalize ? 'uppercase' : 'none'`.

Call site:

```ts
const { width, height, mode } = options.cellSize;
const allowFit = options.resourceDisplayMode === ResourceDisplayMode.CellWithText;
const styles = useStyles2(getStyles, width, height, mode, allowFit, options.capitalizeCellText);
```

## GroupView change

`src/components/GroupView.tsx:113` already calls `getCellSizeTier(min(width, height))`. Tweak to use the effective dimension: when `cellSize.mode === 'fit'` and display mode is CellWithText, base tier on `height` only.

```ts
const { width, height, mode } = options.cellSize;
const allowFit = options.resourceDisplayMode === ResourceDisplayMode.CellWithText;
const tierBasis = mode === 'fit' && allowFit ? height : Math.min(width, height);
const cellTier = getCellSizeTier(tierBasis);
```

## module.ts wiring

- `cellSize` `addCustomEditor` block: unchanged (editor reads display mode from context).
- New `addBooleanSwitch`:

```ts
.addBooleanSwitch({
  path: 'capitalizeCellText',
  name: 'Capitalize cell text',
  description: 'Render cell text in upper case',
  defaultValue: true,
  category: ['Resource content'],
  showIf: (options) => options.resourceDisplayMode === ResourceDisplayMode.CellWithText,
})
```

Placement: alongside the other cell-text settings (right after the `cellTextPattern` custom editor).

## Testing

**Unit:**
- Migration: add cases for `locked: true → mode: 'locked'`, `locked: false → mode: 'free'`, no `mode`/`locked` → `'locked'`, missing `capitalizeCellText` → `true`. Existing migration tests update from `locked` → `mode`.
- Editor:
  - Update the existing 5 tests for the inverted lock semantics (editing height in locked mode updates width too; width input is disabled and shows the height value).
  - New: free → locked cycle snaps `width` to `height`.
  - New: cycle in CellWithText (allowFit=true) goes locked → fit; emitted value has `mode: 'fit'`.
  - New: width input shows literal `"auto"` and is disabled when `mode: 'fit'`.
  - New: cycle from fit → free.
  - New: in Cell mode (allowFit=false), cycle is locked ↔ free (no fit state reachable).
- View styles: a small targeted test (Jest, no RTL) on a `getStyles`-equivalent or via a snapshot of the rendered `<CellView>` cell is overkill — instead exercise the visual behavior in e2e.

**E2E:**
- New provisioned panel: CellWithText display, `cellSize: { width: 0, height: 18, mode: 'fit' }`, several distinct labels (short like `a` and longer like `node-a`). Playwright asserts:
  - First cell `boundingBox().height === 18`.
  - First cell `boundingBox().width >= 18` (min-width applied).
  - Two cells with different label lengths have different widths (proves auto-fit).
- New provisioned panel: CellWithText display, `capitalizeCellText: false`. Playwright asserts the rendered text matches the lower-case label (`node-a`, not `NODE-A`).
- Existing panels using the previous `locked: bool` shape are covered by the migration unit tests; no new e2e is required for them.

**testHelpers:** `makeOptions` adds `capitalizeCellText: true` to defaults and updates the cellSize default to use `mode: 'locked'` (already via `DEFAULT_CELL_SIZE`).

## Files touched

- `src/types.ts`
- `src/library/cellSize.ts`
- `src/library/testHelpers.ts`
- `src/migrationHandler.ts`, `src/migrationHandler.test.ts`
- `src/components/CellView.tsx`
- `src/components/GroupView.tsx`
- `src/components/settings/CellSizeEditor.tsx`, `src/components/settings/CellSizeEditor.test.tsx`
- `src/module.ts`
- `provisioning/dashboards/tests/e2e-tests.json`, `tests/panel.spec.ts`

## Out of scope

- Per-group cell size override.
- A general purpose text-transform setting for other surfaces.
- Tweaking the existing rich-table card text styling.
