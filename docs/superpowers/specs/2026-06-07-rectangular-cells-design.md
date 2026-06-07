# Rectangular cells — design

Allow resource cells to have an independent width and height (previously square only), with a lock toggle that keeps the two dimensions tied together. Preserves the appearance of every existing dashboard.

## Goals

- Users can set an independent width and height for resource cells.
- A single lock toggle keeps width and height equal (the common case).
- Old configs migrate to the same visual result they had before.
- Tier-driven styling (`cellS`/`cellM`/`cellL`) continues to switch on the smaller dimension.

## Non-goals

- Per-group overrides for cell size.
- Aspect-ratio drag handles or a visual preview inside the editor.
- Any change to sidecar inner content rendering beyond sizing.

## Data model

`HostViewerOptions` (`src/types.ts`) — change `cellSize: number` to a single object on the same path:

```ts
interface CellSize {
  width: number;   // min 4, max 100, integer
  height: number;  // min 4, max 100, integer
  locked: boolean;
}

// in HostViewerOptions
cellSize: CellSize;  // default { width: 20, height: 20, locked: true }
```

Storing as one object keeps the editor on a single `addCustomEditor` path, matching the pattern already used here for `statusJoin` and `knownIdsJoin`. (Grafana's `StandardEditorProps.onChange` only writes its registered path.)

`testHelpers.makeOptions` updates its default to match.

## Migration

`src/migrationHandler.ts` handles two cases for cell size:

1. Old config with `cellSize` as a number: replace it with `{ width: cellSize, height: cellSize, locked: true }`. Existing dashboards keep their exact rendering.
2. Missing `cellSize` (fresh panel): seed with `{ width: 20, height: 20, locked: true }`.

If `cellSize` is already an object it's left alone (no-op).

The migration handler currently has no dedicated test file; the migration is covered indirectly through the rest of the test suite. We add focused coverage for this case (see Testing).

## CellSizeEditor component

New file: `src/components/settings/CellSizeEditor.tsx`. Registered in `src/module.ts` via a single `addCustomEditor` at path `cellSize` (replacing the existing `addNumberInput`). The editor receives the whole `CellSize` object as `value` and writes the whole object via `onChange`.

Layout, single horizontal row:

```
[ width# ] × [ height# (disabled when locked) ] [ 🔒 / 🔓 ]
```

- Width input: `Input type="number"`, bounds `min: 4, max: 100, step: 1`, integer.
- Separator: a small `×` label, theme-styled secondary text.
- Height input: same bounds as width. Disabled when `value.locked` is true; displays the current width value while disabled.
- Lock toggle: `IconButton` with `lock` icon when engaged, `unlock` icon when released. `aria-label="Keep width and height equal"` when released, `aria-label="Allow different width and height"` when engaged (the label describes the action the click will perform). Same string used as the `tooltip`.

Behaviors (all rewrite the whole object through `onChange`):

- Width change while locked → emit `{ width: new, height: new, locked: true }`.
- Width change while unlocked → emit `{ ...value, width: new }`.
- Height change (only possible when unlocked) → emit `{ ...value, height: new }`.
- Lock toggle engage → emit `{ width: value.width, height: value.width, locked: true }` (snap height to width).
- Lock toggle release → emit `{ ...value, locked: false }`.
- `showIf` for the editor: same as the old `cellSize` field — only the `Cell` and `CellWithText` resource display modes.

Description text on the editor: "Width × height of each resource cell in pixels".

## CellView changes

`src/components/CellView.tsx`:

- `getStyles(theme, width, height)` replaces `getStyles(theme, cellSize)`.
- `const minSize = Math.min(width, height)`.
- `sidecarPad = Math.max(2, Math.min(10, Math.round(minSize * 0.15)))`.
- `innerWidth = width - 2 * sidecarPad`, `innerHeight = height - 2 * sidecarPad`.
- `tier = getCellSizeTier(minSize)` — feeds border-radius decisions exactly as today.
- `.cell`: `width`, `height` set from the args.
- `.cellText`: stretches — `width: calc(${width}px - ${theme.spacing(1)})`, `height: calc(${height}px - ${theme.spacing(1)})`, `lineHeight: calc(${height}px - ${theme.spacing(1)} + 1px)`.
- `.cellTextSidecar`: stretches using `innerWidth` / `innerHeight` with the same spacing pattern.
- Caller: `useStyles2(getStyles, options.cellSize.width, options.cellSize.height)`. Migration guarantees `cellSize` is the object form by the time render happens, so no `??` fallback is needed at the call site.

## GroupView changes

`src/components/GroupView.tsx:113` — replace:

```ts
const cellTier = getCellSizeTier(options.cellSize ?? 20);
```

with:

```ts
const cellTier = getCellSizeTier(Math.min(options.cellSize.width, options.cellSize.height));
```

## cellSize library

`src/library/cellSize.ts` and its test file `cellSize.test.ts` stay as they are. `getCellSizeTier(size: number)` is now called with `min(width, height)` at the call sites.

## module.ts

Replace the existing `addNumberInput({ path: 'cellSize', ... })` block at `src/module.ts:246` with a single `addCustomEditor({ id: 'cellSize', path: 'cellSize', editor: CellSizeEditor, defaultValue: { width: 20, height: 20, locked: true } satisfies CellSize, ... })`. Same category (`Resource content`), same `showIf`.

## Testing

- **Migration:** add a new test file `src/migrationHandler.test.ts` covering: `cellSize: 25 → { width: 25, height: 25, locked: true }`; missing `cellSize` → `{ width: 20, height: 20, locked: true }`; already-object `cellSize` is left as-is.
- **Editor unit tests:** add `src/components/settings/CellSizeEditor.test.tsx` with RTL covering:
  - locked + width change → emitted object has both width and height equal to new value;
  - unlocked + height change → emitted object has only height changed;
  - lock-on (engage) → emitted object has height snapped to width and `locked: true`;
  - lock-off (release) → emitted object has `locked: false`, width/height unchanged;
  - height input is disabled when locked.
- **Helpers:** update `src/library/testHelpers.ts` defaults.
- **E2E:** existing `tests/panel.spec.ts` assertions do not read cell size; no changes required. Adding a dedicated rectangular-cell e2e is out of scope.

## Files touched

- `src/types.ts`
- `src/migrationHandler.ts`
- `src/module.ts`
- `src/components/CellView.tsx`
- `src/components/GroupView.tsx`
- `src/components/settings/CellSizeEditor.tsx` (new)
- `src/components/settings/CellSizeEditor.test.tsx` (new)
- `src/migrationHandler.test.ts` (new or extended)
- `src/library/testHelpers.ts`

## Out of scope

- Per-group cell size overrides.
- Drag handles or visual preview in the editor.
- Restyling of sidecar inner border beyond resizing.
- Changes to the documentation site under `docs/docs/` (not required by the task; can be added later).
