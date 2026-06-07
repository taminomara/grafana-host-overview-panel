# Cell size modes & text options — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "fit to text" cell-size mode (Cell-with-text only) with inverted lock semantics, and a capitalize-cell-text toggle. Preserve existing dashboards via migration.

**Architecture:** The `cellSize.locked: boolean` field becomes `cellSize.mode: 'free' | 'locked' | 'fit'`. In `locked` mode the height drives both dimensions (was: width drove both); in `fit` mode width is rendered as `fit-content` and is shown as the literal `"auto"` in the editor. A new `capitalizeCellText: boolean` controls the `text-transform: uppercase` style on cell text.

**Tech Stack:** TypeScript, React, `@grafana/ui` (`Input`, `IconButton`), `@emotion/css`, Jest + RTL, Playwright (`@grafana/plugin-e2e`).

**Spec:** `docs/superpowers/specs/2026-06-07-cell-size-modes-and-text-options-design.md`

---

## Task 1: Update types and shared defaults

**Files:**
- Modify: `src/types.ts`
- Modify: `src/library/cellSize.ts`
- Modify: `src/library/testHelpers.ts`

- [ ] **Step 1: Add `CellSizeMode`, update `CellSize`, add `capitalizeCellText`**

In `src/types.ts`, replace the existing `CellSize` interface block (it has `locked: boolean`) and update `HostViewerOptions`:

```ts
export type CellSizeMode = 'free' | 'locked' | 'fit';

export interface CellSize {
  width: number;
  height: number;
  mode: CellSizeMode;
}
```

In `HostViewerOptions`, immediately below the existing `cellSize: CellSize;` line, add:

```ts
  capitalizeCellText: boolean;
```

- [ ] **Step 2: Update `DEFAULT_CELL_SIZE`**

In `src/library/cellSize.ts`, replace the `DEFAULT_CELL_SIZE` line with:

```ts
export const DEFAULT_CELL_SIZE: CellSize = { width: 20, height: 20, mode: 'locked' };
```

- [ ] **Step 3: Update `testHelpers.makeOptions`**

In `src/library/testHelpers.ts`, find the `cellSize: { ...DEFAULT_CELL_SIZE },` line in `makeOptions` and add a new entry right after it:

```ts
    capitalizeCellText: true,
```

The `cellSize` line itself is already a spread of `DEFAULT_CELL_SIZE` so it doesn't need changes.

- [ ] **Step 4: Run typecheck — observe expected errors**

Run: `npm run typecheck`
Expected: FAIL with errors in `src/components/CellView.tsx`, `src/components/GroupView.tsx`, `src/components/settings/CellSizeEditor.tsx`, `src/components/settings/CellSizeEditor.test.tsx`, `src/migrationHandler.ts`, `src/migrationHandler.test.ts`. Leave them; later tasks fix each one.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/library/cellSize.ts src/library/testHelpers.ts
git commit -m "types: add CellSizeMode and capitalizeCellText option"
```

---

## Task 2: Update migration tests with failing cases

**Files:**
- Modify: `src/migrationHandler.test.ts`

- [ ] **Step 1: Rewrite the test file to assert the new shape**

Replace the entire contents of `src/migrationHandler.test.ts` with:

```ts
import { PanelModel } from '@grafana/data';
import { migrationHandler } from './migrationHandler';
import { HostViewerOptions } from './types';

function runMigration(options: Record<string, unknown>): HostViewerOptions {
  const panel = { options } as unknown as PanelModel<Partial<HostViewerOptions>>;
  return migrationHandler(panel) as HostViewerOptions;
}

describe('migrationHandler — cellSize', () => {
  it('migrates a number cellSize to a CellSize object with mode=locked', () => {
    const out = runMigration({ cellSize: 25 });
    expect(out.cellSize).toEqual({ width: 25, height: 25, mode: 'locked' });
  });

  it('seeds default cellSize when missing', () => {
    const out = runMigration({});
    expect(out.cellSize).toEqual({ width: 20, height: 20, mode: 'locked' });
  });

  it('migrates an object with locked: true to mode: locked', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18, locked: true } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'locked' });
  });

  it('migrates an object with locked: false to mode: free', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18, locked: false } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'free' });
  });

  it('defaults to mode: locked when object has neither mode nor locked', () => {
    const out = runMigration({ cellSize: { width: 32, height: 18 } });
    expect(out.cellSize).toEqual({ width: 32, height: 18, mode: 'locked' });
  });

  it('leaves an existing object with mode untouched', () => {
    const existing = { width: 32, height: 18, mode: 'fit' as const };
    const out = runMigration({ cellSize: existing });
    expect(out.cellSize).toEqual(existing);
  });
});

describe('migrationHandler — capitalizeCellText', () => {
  it('defaults to true when missing', () => {
    const out = runMigration({});
    expect(out.capitalizeCellText).toBe(true);
  });

  it('preserves an existing false value', () => {
    const out = runMigration({ capitalizeCellText: false });
    expect(out.capitalizeCellText).toBe(false);
  });

  it('preserves an existing true value', () => {
    const out = runMigration({ capitalizeCellText: true });
    expect(out.capitalizeCellText).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests — confirm failures**

Run: `npx jest src/migrationHandler.test.ts`
Expected: FAIL — the migration still produces `locked` (not `mode`) and doesn't touch `capitalizeCellText`. Several tests fail.

- [ ] **Step 3: Commit**

```bash
git add src/migrationHandler.test.ts
git commit -m "test: add failing cellSize mode and capitalizeCellText migration cases"
```

---

## Task 3: Implement the migration

**Files:**
- Modify: `src/migrationHandler.ts`

- [ ] **Step 1: Rewrite the cellSize migration block**

In `src/migrationHandler.ts`, find the existing `cellSize` block (currently lines 91-101, the one starting with `const cellSize = (options as Record<string, unknown>).cellSize;`). Replace the whole block with:

```ts
  const cellSize = (options as Record<string, unknown>).cellSize;
  if (typeof cellSize === 'number') {
    options.cellSize = { width: cellSize, height: cellSize, mode: 'locked' };
  } else if (cellSize && typeof cellSize === 'object') {
    const obj = cellSize as Record<string, unknown>;
    if (obj.mode === 'free' || obj.mode === 'locked' || obj.mode === 'fit') {
      // Already in the new shape — leave alone.
    } else {
      const mode = obj.locked === false ? 'free' : 'locked';
      options.cellSize = {
        width: typeof obj.width === 'number' ? obj.width : DEFAULT_CELL_SIZE.width,
        height: typeof obj.height === 'number' ? obj.height : DEFAULT_CELL_SIZE.height,
        mode,
      };
    }
  } else {
    options.cellSize = { ...DEFAULT_CELL_SIZE };
  }

  if (typeof options.capitalizeCellText !== 'boolean') {
    options.capitalizeCellText = true;
  }
```

- [ ] **Step 2: Run the tests — confirm they pass**

Run: `npx jest src/migrationHandler.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 3: Run the full unit suite**

Run: `npx jest --passWithNoTests`
Expected: All existing migration- and helper-related tests pass. The editor tests still fail (they're rewritten in Task 5); CellView/GroupView are not jest-tested directly so they don't impact this run.

If editor tests cause a compile error that blocks the whole run, that's OK to leave for Task 5 — note it in the report. Typecheck is the source of truth.

- [ ] **Step 4: Commit**

```bash
git add src/migrationHandler.ts
git commit -m "feat: migrate cellSize.locked to cellSize.mode, seed capitalizeCellText"
```

---

## Task 4: Rewrite `CellSizeEditor.tsx` for tri-state + inverted semantics

**Files:**
- Modify: `src/components/settings/CellSizeEditor.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/components/settings/CellSizeEditor.tsx` with:

```tsx
import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { IconButton, IconName, Input, useStyles2 } from '@grafana/ui';
import { CellSize, CellSizeMode, HostViewerOptions, ResourceDisplayMode } from '../../types';
import { CELL_SIZE_MAX, CELL_SIZE_MIN, DEFAULT_CELL_SIZE } from '../../library/cellSize';

function clampSize(raw: number): number | null {
  if (!Number.isFinite(raw)) {
    return null;
  }
  const rounded = Math.round(raw);
  return Math.max(CELL_SIZE_MIN, Math.min(CELL_SIZE_MAX, rounded));
}

function nextMode(current: CellSizeMode, allowFit: boolean): CellSizeMode {
  if (current === 'free') return 'locked';
  if (current === 'locked') return allowFit ? 'fit' : 'free';
  return 'free';
}

function modeIcon(mode: CellSizeMode): IconName {
  if (mode === 'free') return 'unlock';
  if (mode === 'locked') return 'lock';
  return 'arrows-h';
}

function nextActionLabel(current: CellSizeMode, allowFit: boolean): string {
  const next = nextMode(current, allowFit);
  if (next === 'locked') return 'Lock cell width to height';
  if (next === 'fit') return 'Fit cell width to text';
  return 'Allow different width and height';
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
  allowFit: boolean;
}

export const CellSizeInput: React.FC<CellSizeInputProps> = ({ value, onChange, allowFit }) => {
  const styles = useStyles2(getStyles);

  const handleWidthChange = (raw: number) => {
    if (value.mode !== 'free') return;
    const width = clampSize(raw);
    if (width === null) return;
    onChange({ ...value, width });
  };

  const handleHeightChange = (raw: number) => {
    const height = clampSize(raw);
    if (height === null) return;
    if (value.mode === 'locked') {
      onChange({ width: height, height, mode: 'locked' });
    } else {
      onChange({ ...value, height });
    }
  };

  const handleCycleMode = () => {
    const target = nextMode(value.mode, allowFit);
    if (target === 'locked') {
      onChange({ width: value.height, height: value.height, mode: 'locked' });
    } else {
      onChange({ ...value, mode: target });
    }
  };

  const widthDisplay: number | string =
    value.mode === 'free'
      ? value.width
      : value.mode === 'locked'
        ? value.height
        : 'auto';
  const widthEditable = value.mode === 'free';
  const buttonLabel = nextActionLabel(value.mode, allowFit);

  return (
    <div className={styles.wrapper}>
      <Input
        className={styles.input}
        type={widthEditable ? 'number' : 'text'}
        min={widthEditable ? CELL_SIZE_MIN : undefined}
        max={widthEditable ? CELL_SIZE_MAX : undefined}
        step={widthEditable ? 1 : undefined}
        value={widthDisplay}
        disabled={!widthEditable}
        aria-label="Cell width"
        onChange={(e) => handleWidthChange(e.currentTarget.valueAsNumber)}
      />
      <span className={styles.separator}>×</span>
      <Input
        className={styles.input}
        type="number"
        min={CELL_SIZE_MIN}
        max={CELL_SIZE_MAX}
        step={1}
        value={value.height}
        aria-label="Cell height"
        onChange={(e) => handleHeightChange(e.currentTarget.valueAsNumber)}
      />
      <IconButton
        name={modeIcon(value.mode)}
        aria-label={buttonLabel}
        tooltip={buttonLabel}
        onClick={handleCycleMode}
      />
    </div>
  );
};

export const CellSizeEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<CellSize, unknown, HostViewerOptions>) => {
  const safeValue: CellSize = value ?? DEFAULT_CELL_SIZE;
  const allowFit = context.options?.resourceDisplayMode === ResourceDisplayMode.CellWithText;
  return <CellSizeInput value={safeValue} onChange={onChange} allowFit={allowFit} />;
};
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: `CellSizeEditor.tsx` no longer in the error list. Errors remain in `CellView.tsx`, `GroupView.tsx`, `CellSizeEditor.test.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.tsx
git commit -m "feat(CellSizeEditor): tri-state mode (free/locked/fit), inverted lock"
```

---

## Task 5: Rewrite editor tests for the new component

**Files:**
- Modify: `src/components/settings/CellSizeEditor.test.tsx`

- [ ] **Step 1: Replace the entire test file**

Replace `src/components/settings/CellSizeEditor.test.tsx` with:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CellSizeInput } from './CellSizeEditor';
import { CellSize } from '../../types';

function setup(initial: CellSize, allowFit = false) {
  const onChange = jest.fn();
  render(<CellSizeInput value={initial} onChange={onChange} allowFit={allowFit} />);
  return { onChange };
}

describe('CellSizeInput', () => {
  it('free + width change → emits only width changed', () => {
    const { onChange } = setup({ width: 20, height: 30, mode: 'free' });

    fireEvent.change(screen.getByLabelText('Cell width'), { target: { value: '50' } });

    expect(onChange).toHaveBeenCalledWith({ width: 50, height: 30, mode: 'free' });
  });

  it('free + height change → emits only height changed', () => {
    const { onChange } = setup({ width: 20, height: 30, mode: 'free' });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 40, mode: 'free' });
  });

  it('locked + height change → emits width and height equal to new value', () => {
    const { onChange } = setup({ width: 99, height: 20, mode: 'locked' });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '35' } });

    expect(onChange).toHaveBeenCalledWith({ width: 35, height: 35, mode: 'locked' });
  });

  it('locked: width input is disabled and shows the height value', () => {
    const onChange = jest.fn();
    render(
      <CellSizeInput value={{ width: 99, height: 27, mode: 'locked' }} onChange={onChange} allowFit={false} />
    );

    const widthInput = screen.getByLabelText('Cell width') as HTMLInputElement;
    expect(widthInput).toBeDisabled();
    expect(widthInput.value).toBe('27');
  });

  it('fit: width input is disabled and shows the literal "auto"', () => {
    const onChange = jest.fn();
    render(
      <CellSizeInput value={{ width: 99, height: 18, mode: 'fit' }} onChange={onChange} allowFit={true} />
    );

    const widthInput = screen.getByLabelText('Cell width') as HTMLInputElement;
    expect(widthInput).toBeDisabled();
    expect(widthInput.value).toBe('auto');
  });

  it('fit + height change → emits new height, mode stays fit', () => {
    const { onChange } = setup({ width: 99, height: 18, mode: 'fit' }, true);

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '24' } });

    expect(onChange).toHaveBeenCalledWith({ width: 99, height: 24, mode: 'fit' });
  });

  it('cycle from free (allowFit false) → snaps width to height and sets mode locked', () => {
    const { onChange } = setup({ width: 20, height: 40, mode: 'free' });

    fireEvent.click(screen.getByLabelText('Lock cell width to height'));

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'locked' });
  });

  it('cycle from locked (allowFit true) → sets mode fit, width and height unchanged', () => {
    const { onChange } = setup({ width: 40, height: 40, mode: 'locked' }, true);

    fireEvent.click(screen.getByLabelText('Fit cell width to text'));

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'fit' });
  });

  it('cycle from locked (allowFit false) → sets mode free, width and height unchanged', () => {
    const { onChange } = setup({ width: 40, height: 40, mode: 'locked' }, false);

    fireEvent.click(screen.getByLabelText('Allow different width and height'));

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'free' });
  });

  it('cycle from fit → sets mode free, width and height unchanged', () => {
    const { onChange } = setup({ width: 99, height: 18, mode: 'fit' }, true);

    fireEvent.click(screen.getByLabelText('Allow different width and height'));

    expect(onChange).toHaveBeenCalledWith({ width: 99, height: 18, mode: 'free' });
  });
});
```

- [ ] **Step 2: Run jest**

Run: `npx jest src/components/settings/CellSizeEditor.test.tsx`
Expected: PASS — 10 tests.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/CellSizeEditor.test.tsx
git commit -m "test(CellSizeEditor): cover tri-state mode and inverted lock"
```

---

## Task 6: Update `CellView` for mode and capitalize

**Files:**
- Modify: `src/components/CellView.tsx`

- [ ] **Step 1: Replace the `getStyles` function and the call site**

In `src/components/CellView.tsx`, the imports already include `getCellSizeTier`. Add `CellSizeMode` to the `types` import (alongside `HostViewerOptions, ResourceDisplayMode`).

Replace the entire `getStyles` function (currently lines 16-62) with:

```ts
function getStyles(
  theme: GrafanaTheme2,
  width: number,
  height: number,
  mode: CellSizeMode,
  allowFit: boolean,
  capitalize: boolean
) {
  const effectiveMode: CellSizeMode = mode === 'fit' && !allowFit ? 'locked' : mode;
  const fitMode = effectiveMode === 'fit';
  const sizeBasis = fitMode ? height : Math.min(width, height);
  const tier = getCellSizeTier(sizeBasis);
  const sidecarPad = Math.max(2, Math.min(10, Math.round(sizeBasis * 0.15)));
  const innerWidth = width - sidecarPad * 2;
  const innerHeight = height - sidecarPad * 2;
  const borderRadius = String(tier === 'cellS' ? 0 : theme.shape.radius.sm);
  const innerRadius = parseFloat(borderRadius) / 2;
  const textTransform = capitalize ? 'uppercase' : 'none';

  return {
    cell: css({
      cursor: 'pointer',
      outlineStyle: 'none',
      width: fitMode ? 'fit-content' : width,
      minWidth: fitMode ? height : undefined,
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
    cellText: fitMode
      ? css({
          width: 'fit-content',
          minWidth: `calc(${height}px - ${theme.spacing(1)})`,
          height: `calc(${height}px - ${theme.spacing(1)})`,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          margin: theme.spacing(0.5),
          paddingLeft: theme.spacing(0.5),
          paddingRight: theme.spacing(0.5),
          lineHeight: `calc(${height}px - ${theme.spacing(1)} + 1px)`,
          textTransform,
        })
      : css({
          width: `calc(${width}px - ${theme.spacing(1)})`,
          height: `calc(${height}px - ${theme.spacing(1)})`,
          textAlign: 'center',
          wordBreak: 'break-all',
          overflow: 'hidden',
          margin: theme.spacing(0.5),
          lineHeight: `calc(${height}px - ${theme.spacing(1)} + 1px)`,
          textTransform,
        }),
    cellTextSidecar: fitMode
      ? css({
          width: 'fit-content',
          minWidth: `calc(${innerHeight}px - ${theme.spacing(1)})`,
          height: `calc(${innerHeight}px - ${theme.spacing(1)})`,
          lineHeight: `calc(${innerHeight}px - ${theme.spacing(1)} + 1px)`,
        })
      : css({
          width: `calc(${innerWidth}px - ${theme.spacing(1)})`,
          height: `calc(${innerHeight}px - ${theme.spacing(1)})`,
          lineHeight: `calc(${innerHeight}px - ${theme.spacing(1)} + 1px)`,
        }),
  };
}
```

- [ ] **Step 2: Update the `useStyles2` call site**

Find the call (currently at line 73):

```ts
  const styles = useStyles2(getStyles, options.cellSize.width, options.cellSize.height);
```

Replace with:

```ts
  const allowFit = options.resourceDisplayMode === ResourceDisplayMode.CellWithText;
  const styles = useStyles2(
    getStyles,
    options.cellSize.width,
    options.cellSize.height,
    options.cellSize.mode,
    allowFit,
    options.capitalizeCellText
  );
```

- [ ] **Step 3: Update the `types` import**

At the top of the file, the existing import is:
```ts
import { HostViewerOptions, ResourceDisplayMode } from 'types';
```

Change to:
```ts
import { CellSizeMode, HostViewerOptions, ResourceDisplayMode } from 'types';
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: `CellView.tsx` no longer in the error list. Only `GroupView.tsx` should remain.

- [ ] **Step 5: Commit**

```bash
git add src/components/CellView.tsx
git commit -m "feat(CellView): render fit mode and respect capitalizeCellText"
```

---

## Task 7: Update `GroupView` for mode-aware tier

**Files:**
- Modify: `src/components/GroupView.tsx:113`

- [ ] **Step 1: Replace the tier-derivation line**

In `src/components/GroupView.tsx` find line 113:

```ts
  const cellTier = getCellSizeTier(Math.min(options.cellSize.width, options.cellSize.height));
```

Replace with:

```ts
  const allowFit = options.resourceDisplayMode === ResourceDisplayMode.CellWithText;
  const { width, height, mode } = options.cellSize;
  const effectiveMode = mode === 'fit' && !allowFit ? 'locked' : mode;
  const cellTier = getCellSizeTier(effectiveMode === 'fit' ? height : Math.min(width, height));
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS, zero errors.

- [ ] **Step 3: Run the full unit suite**

Run: `npx jest --passWithNoTests`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/GroupView.tsx
git commit -m "feat(GroupView): pick tier from height in fit mode"
```

---

## Task 8: Wire `capitalizeCellText` into `module.ts`

**Files:**
- Modify: `src/module.ts`

- [ ] **Step 1: Add the boolean switch right after `cellTextPattern`**

In `src/module.ts`, locate the `addCustomEditor` block for `cellTextPattern` (currently around lines 281-292, ends with `category: ['Resource content']` and a closing `})`). Immediately after the closing `})` of the cellTextPattern block, add:

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

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run the full unit suite**

Run: `npm run test:ci`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/module.ts
git commit -m "feat(module): expose capitalizeCellText option"
```

---

## Task 9: Add provisioned panels for fit mode and capitalize toggle

**Files:**
- Modify: `provisioning/dashboards/tests/e2e-tests.json`

- [ ] **Step 1: Add two new panels after panel id 26 ("Legacy cellSize number")**

Open `provisioning/dashboards/tests/e2e-tests.json` and find the closing `},` of the panel with `"id": 26` and `"title": "Legacy cellSize number"`. Right after that `},`, insert the following two panel objects (note the leading `{` to open the first new panel; the trailing comma after each `}` must match the format of the other panels in the file):

```json
    {
      "datasource": {
        "type": "grafana-testdata-datasource",
        "uid": "trlxrdZVk"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "custom": {
            "displayMode": "auto"
          },
          "fieldMinMax": true,
          "mappings": [],
          "noValue": "unknown",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "#ff0000",
                "value": 0
              },
              {
                "color": "#00ff00",
                "value": 1
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 4,
        "w": 12,
        "x": 0,
        "y": 100
      },
      "id": 27,
      "options": {
        "cellSize": { "width": 20, "height": 24, "mode": "fit" },
        "cellTextField": "",
        "cellTextPattern": "",
        "capitalizeCellText": true,
        "dataFrame": "",
        "displayEntries": [],
        "gridColumns": 5,
        "gridType": "flow",
        "groups": [],
        "idField": "name",
        "idSortMode": "disabled",
        "idSortPattern": "",
        "knownIds": "",
        "resourceDisplayMode": "cell-with-text",
        "statusField": "status",
        "titleField": "",
        "titlePattern": ""
      },
      "pluginVersion": "1.1.0",
      "targets": [
        {
          "csvContent": "name,status\r\na,1\r\nbb,0\r\nccccccc,1",
          "datasource": {
            "type": "grafana-testdata-datasource",
            "uid": "trlxrdZVk"
          },
          "refId": "A",
          "scenarioId": "csv_content"
        }
      ],
      "title": "Fit cell width to text",
      "type": "taminomara-hostoverview-panel"
    },
    {
      "datasource": {
        "type": "grafana-testdata-datasource",
        "uid": "trlxrdZVk"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "custom": {
            "displayMode": "auto"
          },
          "fieldMinMax": true,
          "mappings": [],
          "noValue": "unknown",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "#ff0000",
                "value": 0
              },
              {
                "color": "#00ff00",
                "value": 1
              }
            ]
          }
        },
        "overrides": []
      },
      "gridPos": {
        "h": 4,
        "w": 12,
        "x": 12,
        "y": 100
      },
      "id": 28,
      "options": {
        "cellSize": { "width": 40, "height": 24, "mode": "free" },
        "cellTextField": "",
        "cellTextPattern": "",
        "capitalizeCellText": false,
        "dataFrame": "",
        "displayEntries": [],
        "gridColumns": 5,
        "gridType": "flow",
        "groups": [],
        "idField": "name",
        "idSortMode": "disabled",
        "idSortPattern": "",
        "knownIds": "",
        "resourceDisplayMode": "cell-with-text",
        "statusField": "status",
        "titleField": "",
        "titlePattern": ""
      },
      "pluginVersion": "1.1.0",
      "targets": [
        {
          "csvContent": "name,status\r\nnode-a,1\r\nnode-b,0",
          "datasource": {
            "type": "grafana-testdata-datasource",
            "uid": "trlxrdZVk"
          },
          "refId": "A",
          "scenarioId": "csv_content"
        }
      ],
      "title": "Capitalize off",
      "type": "taminomara-hostoverview-panel"
    },
```

- [ ] **Step 2: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('provisioning/dashboards/tests/e2e-tests.json', 'utf8')); console.log('JSON valid')"`
Expected: `JSON valid`.

- [ ] **Step 3: Commit**

```bash
git add provisioning/dashboards/tests/e2e-tests.json
git commit -m "test(e2e): add fit-mode and capitalize-off provisioned panels"
```

---

## Task 10: Add e2e tests for fit mode and capitalize toggle

**Files:**
- Modify: `tests/panel.spec.ts`

- [ ] **Step 1: Add the two tests at the end of the existing `cell size` describe block**

In `tests/panel.spec.ts`, find the `cell size` describe block (around line 897). Inside it, after the existing `legacy number cellSize migrates to a square cell` test (around lines 951-967), add these two tests so they sit just before the closing `});` of the describe block:

```ts
  test('fit mode sizes cell width to text content', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '27' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // cellSize.height = 24, mode = 'fit'. Labels: "a", "bb", "ccccccc" — distinct widths.
    const cells = panelEditPage.panel.locator.locator('[data-testid="resource-cell"]');
    await expect(cells.first()).toBeVisible();
    expect(await cells.count()).toBe(3);

    const boxes = await Promise.all(
      [0, 1, 2].map(async (i) => (await cells.nth(i).boundingBox())!)
    );
    // All cells share the configured height.
    for (const box of boxes) {
      expect(box.height).toBe(24);
    }
    // Each cell is at least square (min-width = height).
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(24);
    }
    // Longer labels render wider cells.
    expect(boxes[2].width).toBeGreaterThan(boxes[0].width);
  });

  test('capitalizeCellText: false renders text without uppercase transform', async ({
    gotoPanelEditPage,
    readProvisionedDashboard,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: E2E_DASHBOARD });
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '28' });
    await expect(panelEditPage.panel.locator).not.toContainText('No data');
    // The cell text div is the direct child of the colored cell div (the one
    // styled with linear-gradient). Read its computed textTransform.
    const cellText = panelEditPage.panel.locator
      .locator('div[style*="linear-gradient"]')
      .first()
      .locator('> div')
      .first();
    await expect(cellText).toBeVisible();
    const textTransform = await cellText.evaluate((el) => getComputedStyle(el).textTransform);
    expect(textTransform).toBe('none');
  });
```

- [ ] **Step 2: Rebuild the plugin so Grafana picks up the latest code**

Run: `npm run build`
Expected: webpack compiles successfully (similar output to previous builds).

- [ ] **Step 3: Run the new e2e tests**

Grafana should already be running locally on `http://localhost:3000` (use `docker compose up --build` if it's not — the test fixture relies on it). Provisioned dashboards reload automatically when the JSON changes.

Run: `npx playwright test tests/panel.spec.ts -g "fit mode sizes cell width|capitalizeCellText: false" --reporter=line`
Expected: 2 passed (plus the auth fixture).

- [ ] **Step 4: Commit**

```bash
git add tests/panel.spec.ts
git commit -m "test(e2e): cover fit-mode auto-width and capitalize-off"
```

---

## Task 11: Final whole-project verification

**Files:**
- (no files modified, unless lint/build wants formatting fixes)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 2: Unit tests**

Run: `npm run test:ci`
Expected: PASS, no failures.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings — same baseline as before this feature).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: webpack build succeeds, no errors.

- [ ] **Step 5: Full e2e suite**

Run: `npx playwright test tests/panel.spec.ts --reporter=line`
Expected: all tests pass.

- [ ] **Step 6: Commit any lint/format fixes if produced**

If lint produced an autofixable diff or prettier wants reformatting, stage and commit:

```bash
git add -A
git commit -m "chore: post-implementation lint/format fixes"
```

Otherwise no commit is required.
