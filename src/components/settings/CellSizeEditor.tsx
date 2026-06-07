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
  if (current === 'free') {
    return 'locked';
  }
  if (current === 'locked') {
    return allowFit ? 'fit' : 'free';
  }
  return 'free';
}

function modeIcon(mode: CellSizeMode): IconName {
  if (mode === 'free') {
    return 'unlock';
  }
  if (mode === 'locked') {
    return 'lock';
  }
  return 'arrows-h';
}

function currentStateLabel(mode: CellSizeMode): string {
  if (mode === 'free') {
    return 'Width and height are independent';
  }
  if (mode === 'locked') {
    return 'Width is locked to height';
  }
  return 'Width is fitted to cell text';
}

function nextActionLabel(current: CellSizeMode, allowFit: boolean): string {
  const next = nextMode(current, allowFit);
  if (next === 'locked') {
    return 'lock cell width to height';
  }
  if (next === 'fit') {
    return 'fit cell width to text';
  }
  return 'allow different width and height';
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
    if (value.mode !== 'free') {
      return;
    }
    const width = clampSize(raw);
    if (width === null) {
      return;
    }
    onChange({ ...value, width });
  };

  const handleHeightChange = (raw: number) => {
    const height = clampSize(raw);
    if (height === null) {
      return;
    }
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
    value.mode === 'free' ? value.width : value.mode === 'locked' ? value.height : 'auto';
  const widthEditable = value.mode === 'free';
  const buttonTooltip = `${currentStateLabel(value.mode)}. Click to ${nextActionLabel(value.mode, allowFit)}.`;

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
        tooltip={buttonTooltip}
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
