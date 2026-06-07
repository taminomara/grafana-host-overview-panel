# Rectangular Cells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent width and height for resource cells in the Host Overview panel, with a lock toggle that keeps them equal.

**Architecture:** The single `cellSize: number` option becomes a `CellSize` object `{ width, height, locked }` stored on the same path. A new `CellSizeEditor` custom editor renders a width × height input pair with a lock `IconButton`. `CellView` and `GroupView` use width/height directly for sizing and `min(width, height)` for tier and sidecar padding. Old configs migrate to `{ width: cellSize, height: cellSize, locked: true }`, preserving every existing dashboard's appearance.

**Tech Stack:** TypeScript, React, `@grafana/ui` (`Input`, `IconButton`, `useStyles2`), `@emotion/css`, Jest + `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-06-07-rectangular-cells-design.md`

---

## Task 1: Add `CellSize` type to `src/types.ts`

**Files:**
- Modify: `src/types.ts:54-77` (HostViewerOptions interface)

- [ ] **Step 1: Add `CellSize` interface and update `HostViewerOptions.cellSize` type**

In `src/types.ts`, just above `export interface HostViewerOptions`, add:

```ts
export interface CellSize {
  width: number;
  height: number;
  locked: boolean;
}
```

Then in `HostViewerOptions` (the field is currently `cellSize: number;` on line 60), change it to:

```ts
cellSize: CellSize;
```

- [ ] **Step 2: Run typecheck to discover all the call sites that now fail**

Run: `npm run typecheck`
Expected: FAIL with errors in `src/components/CellView.tsx`, `src/components/GroupView.tsx`, `src/library/testHelpers.ts`, `src/module.ts`. Leave them — later tasks fix each one.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "types: introduce CellSize object for cell width/height/locked"
```

---

## Task 2: Update test helpers default

**Files:**
- Modify: `src/library/testHelpers.ts:46` (current `cellSize: 20`)

- [ ] **Step 1: Change the default in `makeOptions`**

In `src/library/testHelpers.ts`, replace:

```ts
    cellSize: 20,
```

with:

```ts
    cellSize: { width: 20, height: 20, locked: true },
```

- [ ] **Step 2: Run typecheck to confirm `testHelpers.ts` now compiles**

Run: `npm run typecheck`
Expected: Errors are now only in `CellView.tsx`, `GroupView.tsx`, `module.ts`. `testHelpers.ts` is clean.

- [ ] **Step 3: Commit**

```bash
git add src/library/testHelpers.ts
git commit -m "test: update makeOptions for CellSize object"
```

---

## Task 3: Migration handler — write the failing test

**Files:**
- Create: `src/migrationHandler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/migrationHandler.test.ts` with this exact content:

```ts
import { PanelModel } from '@grafana/data';
import { migrationHandler } from './migrationHandler';
import { HostViewerOptions } from './types';

function runMigration(options: Record<string, unknown>): HostViewerOptions {
  const panel = { options } as unknown as PanelModel<Partial<HostViewerOptions>>;
  return migrationHandler(panel) as HostViewerOptions;
}

describe('migrationHandler — cellSize', () => {
  it('migrates a number cellSize to a CellSize object', () => {
    const out = runMigration({ cellSize: 25 });
    expect(out.cellSize).toEqual({ width: 25, height: 25, locked: true });
  });

  it('seeds default cellSize when missing', () => {
    const out = runMigration({});
    expect(out.cellSize).toEqual({ width: 20, height: 20, locked: true });
  });

  it('leaves an existing CellSize object untouched', () => {
    const existing = { width: 32, height: 18, locked: false };
    const out = runMigration({ cellSize: existing });
    expect(out.cellSize).toEqual(existing);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/migrationHandler.test.ts`
Expected: FAIL — the migration currently doesn't touch `cellSize`, so the number→object case will fail (`out.cellSize === 25` not the object), and the missing-case will fail (`out.cellSize === undefined`).

- [ ] **Step 3: Commit the failing test**

```bash
git add src/migrationHandler.test.ts
git commit -m "test: add failing cellSize migration cases"
```

---

## Task 4: Migration handler — implement the migration

**Files:**
- Modify: `src/migrationHandler.ts`

- [ ] **Step 1: Add the migration logic**

In `src/migrationHandler.ts`, locate the block right before `return options;` (currently around lines 91-102 that loops over groups). Right before the existing `for (const group of options.groups ?? [])` loop, add:

```ts
  const cellSize = (options as Record<string, unknown>).cellSize;
  if (typeof cellSize === 'number') {
    options.cellSize = { width: cellSize, height: cellSize, locked: true };
  } else if (
    cellSize === undefined ||
    cellSize === null ||
    typeof cellSize !== 'object'
  ) {
    options.cellSize = { width: 20, height: 20, locked: true };
  }
```

- [ ] **Step 2: Run the tests to confirm they pass**

Run: `npx jest src/migrationHandler.test.ts`
Expected: PASS — all three cases.

- [ ] **Step 3: Run the full test suite**

Run: `npx jest --passWithNoTests`
Expected: PASS — existing tests still green.

- [ ] **Step 4: Commit**

```bash
git add src/migrationHandler.ts
git commit -m "feat: migrate cellSize number to CellSize object"
```

---

## Task 5: Update `GroupView` to read width/height

**Files:**
- Modify: `src/components/GroupView.tsx:113`

- [ ] **Step 1: Replace the `getCellSizeTier` call**

In `src/components/GroupView.tsx`, find line 113:

```ts
  const cellTier = getCellSizeTier(options.cellSize ?? 20);
```

Replace with:

```ts
  const cellTier = getCellSizeTier(Math.min(options.cellSize.width, options.cellSize.height));
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: `GroupView.tsx` no longer in the error list. Errors remain only in `CellView.tsx` and `module.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/GroupView.tsx
git commit -m "feat(GroupView): use min(width, height) for cell tier"
```

---

## Task 6: Update `CellView` to render width × height

**Files:**
- Modify: `src/components/CellView.tsx:16-60` (getStyles), `src/components/CellView.tsx:71` (useStyles2 call)

- [ ] **Step 1: Rewrite `getStyles` to take width and height**

In `src/components/CellView.tsx`, replace the entire `getStyles` function (lines 16-60) with:

```ts
function getStyles(theme: GrafanaTheme2, width: number, height: number) {
  const minSize = Math.min(width, height);
  const tier = getCellSizeTier(minSize);
  const sidecarPad = Math.max(2, Math.min(10, Math.round(minSize * 0.15)));
  const innerWidth = width - sidecarPad * 2;
  const innerHeight = height - sidecarPad * 2;
  const borderRadius = String(tier === 'cellS' ? 0 : theme.shape.radius.sm);
  const innerRadius = parseFloat(borderRadius) / 2;

  return {
    cell: css({
      cursor: 'pointer',
      outlineStyle: 'none',
      width,
      height,
      borderRadius: borderRadius,
      display: 'flex',
    }),
    cellSidecarOuter: css({
      border: `1px solid ${theme.colors.border.strong}`,
      padding: sidecarPad - 1,
      boxSizing: 'border-box',
      borderRadius: borderRadius,
    }),
    cellSidecarInner: css({
      width: '100%',
      height: '100%',
      borderRadius: innerRadius,
      display: 'flex',
    }),
    cellText: css({
      width: `calc(${width}px - ${theme.spacing(1)})`,
      height: `calc(${height}px - ${theme.spacing(1)})`,
      textAlign: 'center',
      wordBreak: 'break-all',
      overflow: 'hidden',
      margin: theme.spacing(0.5),
      lineHeight: `calc(${height}px - ${theme.spacing(1)} + 1px)`,
      textTransform: 'uppercase',
    }),
    cellTextSidecar: css({
      width: `calc(${innerWidth}px - ${theme.spacing(1)})`,
      height: `calc(${innerHeight}px - ${theme.spacing(1)})`,
      lineHeight: `calc(${innerHeight}px - ${theme.spacing(1)} + 1px)`,
    }),
  };
}
```

- [ ] **Step 2: Update the `useStyles2` call**

In the same file, find line 71:

```ts
  const styles = useStyles2(getStyles, options.cellSize ?? 20);
```

Replace with:

```ts
  const styles = useStyles2(getStyles, options.cellSize.width, options.cellSize.height);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: Only `module.ts` still has errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/CellView.tsx
git commit -m "feat(CellView): render rectangular cells using width and height"
```

---

## Task 7: Create the `CellSizeEditor` component skeleton

**Files:**
- Create: `src/components/settings/CellSizeEditor.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/settings/CellSizeEditor.tsx`:

```tsx
import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { IconButton, Input, useStyles2 } from '@grafana/ui';
import { CellSize, HostViewerOptions } from '../../types';

const MIN_SIZE = 4;
const MAX_SIZE = 100;

function clampSize(raw: number): number | null {
  if (!Number.isFinite(raw)) {
    return null;
  }
  const rounded = Math.round(raw);
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, rounded));
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  input: css({
    width: '6rem',
  }),
  separator: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});

interface CellSizeInputProps {
  value: CellSize;
  onChange: (value: CellSize) => void;
}

export const CellSizeInput: React.FC<CellSizeInputProps> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);

  const handleWidthChange = (raw: number) => {
    const width = clampSize(raw);
    if (width === null) {
      return;
    }
    if (value.locked) {
      onChange({ width, height: width, locked: true });
    } else {
      onChange({ ...value, width });
    }
  };

  const handleHeightChange = (raw: number) => {
    if (value.locked) {
      return;
    }
    const height = clampSize(raw);
    if (height === null) {
      return;
    }
    onChange({ ...value, height });
  };

  const handleToggleLock = () => {
    if (value.locked) {
      onChange({ ...value, locked: false });
    } else {
      onChange({ width: value.width, height: value.width, locked: true });
    }
  };

  const lockLabel = value.locked
    ? 'Allow different width and height'
    : 'Keep width and height equal';

  return (
    <div className={styles.wrapper}>
      <Input
        className={styles.input}
        type="number"
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={1}
        value={value.width}
        aria-label="Cell width"
        onChange={(e) => handleWidthChange(e.currentTarget.valueAsNumber)}
      />
      <span className={styles.separator}>×</span>
      <Input
        className={styles.input}
        type="number"
        min={MIN_SIZE}
        max={MAX_SIZE}
        step={1}
        value={value.locked ? value.width : value.height}
        disabled={value.locked}
        aria-label="Cell height"
        onChange={(e) => handleHeightChange(e.currentTarget.valueAsNumber)}
      />
      <IconButton
        name={value.locked ? 'lock' : 'unlock'}
        aria-label={lockLabel}
        tooltip={lockLabel}
        onClick={handleToggleLock}
      />
    </div>
  );
};

export const CellSizeEditor = ({
  value,
  onChange,
}: StandardEditorProps<CellSize, unknown, HostViewerOptions>) => {
  const safeValue: CellSize = value ?? { width: 20, height: 20, locked: true };
  return <CellSizeInput value={safeValue} onChange={onChange} />;
};
```

- [ ] **Step 2: Run typecheck on the new component**

Run: `npm run typecheck`
Expected: `CellSizeEditor.tsx` compiles. `module.ts` still has the cellSize error.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.tsx
git commit -m "feat: add CellSizeEditor component for rectangular cells"
```

---

## Task 8: Wire `CellSizeEditor` into `module.ts`

**Files:**
- Modify: `src/module.ts:1-24` (imports), `src/module.ts:246-262` (cellSize editor)

- [ ] **Step 1: Add imports**

In `src/module.ts`, add to the editor imports block (just below the other `./components/settings/...` imports, alphabetical-ish — line 2 area is fine):

```ts
import { CellSizeEditor } from './components/settings/CellSizeEditor';
```

And add `CellSize` to the type imports from `./types`:

```ts
import {
  ResourceDisplayMode,
  FieldDisplayMode,
  GridType,
  HostViewerFieldConfig,
  HostViewerOptions,
  SortMode,
  Join,
  CellSize,
} from './types';
```

- [ ] **Step 2: Replace the `addNumberInput` for `cellSize`**

In `src/module.ts`, find the block (lines 246-262):

```ts
      .addNumberInput({
        path: 'cellSize',
        name: 'Cell size',
        description: 'Size of each resource cell in pixels',
        defaultValue: 20,
        category: ['Resource content'],
        settings: {
          min: 4,
          max: 100,
          step: 1,
          integer: true,
        },
        showIf: (options) =>
          [ResourceDisplayMode.Cell, ResourceDisplayMode.CellWithText].includes(
            options.resourceDisplayMode
          ),
      })
```

Replace with:

```ts
      .addCustomEditor({
        id: 'cellSize',
        path: 'cellSize',
        name: 'Cell size',
        description: 'Width × height of each resource cell in pixels',
        editor: CellSizeEditor,
        defaultValue: { width: 20, height: 20, locked: true } satisfies CellSize,
        category: ['Resource content'],
        showIf: (options) =>
          [ResourceDisplayMode.Cell, ResourceDisplayMode.CellWithText].includes(
            options.resourceDisplayMode
          ),
      })
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Run the test suite**

Run: `npx jest --passWithNoTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/module.ts
git commit -m "feat(module): use CellSizeEditor for the cellSize option"
```

---

## Task 9: Editor tests — locked width change updates both

**Files:**
- Create: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/CellSizeEditor.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CellSizeInput } from './CellSizeEditor';
import { CellSize } from '../../types';

function setup(initial: CellSize) {
  const onChange = jest.fn();
  render(<CellSizeInput value={initial} onChange={onChange} />);
  return { onChange };
}

describe('CellSizeInput', () => {
  it('locked + width change → emits both width and height equal to new value', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: true });

    fireEvent.change(screen.getByLabelText('Cell width'), { target: { value: '35' } });

    expect(onChange).toHaveBeenCalledWith({ width: 35, height: 35, locked: true });
  });
});
```

- [ ] **Step 2: Run and confirm pass**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): locked width change updates height"
```

---

## Task 10: Editor tests — unlocked height change preserves width

**Files:**
- Modify: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Add the test case inside the existing `describe` block**

In `src/components/settings/CellSizeEditor.test.tsx`, add this test case below the existing one (still inside the `describe('CellSizeInput', ...)` block):

```tsx
  it('unlocked + height change → emits only height changed', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: false });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 40, locked: false });
  });
```

- [ ] **Step 2: Run and confirm pass**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS — both tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): unlocked height change preserves width"
```

---

## Task 11: Editor tests — lock engage snaps height to width

**Files:**
- Modify: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Add the test case inside the existing `describe` block**

Add below the previous test:

```tsx
  it('lock engage → snaps height to width and sets locked true', () => {
    const { onChange } = setup({ width: 20, height: 40, locked: false });

    fireEvent.click(screen.getByLabelText('Keep width and height equal'));

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 20, locked: true });
  });
```

- [ ] **Step 2: Run and confirm pass**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS — three tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): lock engage snaps height to width"
```

---

## Task 12: Editor tests — lock release sets locked false

**Files:**
- Modify: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Add the test case inside the existing `describe` block**

Add below the previous test:

```tsx
  it('lock release → sets locked false, width and height unchanged', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: true });

    fireEvent.click(screen.getByLabelText('Allow different width and height'));

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 20, locked: false });
  });
```

- [ ] **Step 2: Run and confirm pass**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS — four tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): lock release sets locked false"
```

---

## Task 13: Editor tests — height input disabled when locked

**Files:**
- Modify: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Add the test case inside the existing `describe` block**

Add below the previous test:

```tsx
  it('disables the height input when locked and shows width value', () => {
    const onChange = jest.fn();
    render(<CellSizeInput value={{ width: 27, height: 99, locked: true }} onChange={onChange} />);

    const heightInput = screen.getByLabelText('Cell height') as HTMLInputElement;
    expect(heightInput).toBeDisabled();
    expect(heightInput.value).toBe('27');
  });
```

- [ ] **Step 2: Run and confirm pass**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS — five tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): height input disabled when locked"
```

---

## Task 14: Final whole-project verification

**Files:**
- (no files modified)

- [ ] **Step 1: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 2: Run full test suite**

Run: `npm run test:ci`
Expected: PASS, no failures.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: webpack build succeeds with no errors.

- [ ] **Step 5: If everything is green, no commit needed (verification only)**

If lint or build produces fixes that need to land (e.g. prettier formatting), commit them as:

```bash
git add -A
git commit -m "chore: post-implementation lint/format fixes"
```
