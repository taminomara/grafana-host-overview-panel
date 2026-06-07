import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { IconButton, Input, useStyles2 } from '@grafana/ui';
import { CellSize, HostViewerOptions } from '../../types';
import { CELL_SIZE_MAX, CELL_SIZE_MIN, DEFAULT_CELL_SIZE } from '../../library/cellSize';

function clampSize(raw: number): number | null {
  if (!Number.isFinite(raw)) {
    return null;
  }
  const rounded = Math.round(raw);
  return Math.max(CELL_SIZE_MIN, Math.min(CELL_SIZE_MAX, rounded));
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
        min={CELL_SIZE_MIN}
        max={CELL_SIZE_MAX}
        step={1}
        value={value.width}
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
  const safeValue: CellSize = value ?? DEFAULT_CELL_SIZE;
  return <CellSizeInput value={safeValue} onChange={onChange} />;
};
