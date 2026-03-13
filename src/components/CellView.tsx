import { css, cx } from '@emotion/css';
import { DataFrameWithValue, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React from 'react';
import { HostViewerOptions, ResourceDisplayMode } from 'types';
import { getCellSizeTier } from '../library/cellSize';
import { useOverrideColor } from '../library/criticality';
import { IndexedFrame } from '../library/dataFrame';
import { interpolateWithDataContext } from '../library/interpolate';
import { formatFieldValue } from './FieldRow';
import { useHostViewerPanelContext } from './PanelContext';
import { CellTooltip } from './CellTooltip';

function getStyles(theme: GrafanaTheme2, cellSize: number) {
  const tier = getCellSizeTier(cellSize);
  return {
    cell: css({
      cursor: 'pointer',
      outlineStyle: 'none',
      width: cellSize,
      height: cellSize,
      borderRadius: {
        cellS: 0,
        cellM: theme.shape.radius.sm,
        cellL: theme.shape.radius.sm,
      }[tier],
      display: 'flex',
    }),
    cellText: css({
      width: `calc(${cellSize}px - ${theme.spacing(1)})`,
      height: `calc(${cellSize}px - ${theme.spacing(1)})`,
      textAlign: 'center',
      wordBreak: 'break-all',
      overflow: 'hidden',
      margin: theme.spacing(0.5),
      lineHeight: `calc(${cellSize}px - ${theme.spacing(1)})`,
      textTransform: 'uppercase',
    }),
  };
}

interface CellViewProps {
  node: GroupNode;
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
}

export const CellView: React.FC<CellViewProps> = ({ node, frame, rowIndex, options }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles, options.cellSize ?? 20);
  const context = useHostViewerPanelContext();

  const idField = frame.fieldByName.get(options.idField);
  const statusField = frame.fieldByName.get(options.statusField);
  const statusValue = statusField
    ? statusField?.type === 'frame'
      ? (statusField.values[rowIndex] as DataFrameWithValue).value
      : statusField.values[rowIndex]
    : undefined;
  const displayValue =
    statusField && statusField.display ? statusField.display(statusValue) : undefined;

  const cellColor = displayValue?.color ?? theme.colors.background.elevated;
  const overrideColor =
    useOverrideColor(options.displayEntries ?? [], frame, rowIndex) ?? cellColor;

  let cellText = undefined;
  if (options.resourceDisplayMode === ResourceDisplayMode.CellWithText) {
    const cellTextField = frame.fieldByName.get(options.cellTextField);
    if (idField && options.cellTextField === '__use_pattern__' && options.cellTextPattern) {
      cellText = interpolateWithDataContext(
        context.replaceVariables,
        options.cellTextPattern,
        context.data,
        frame,
        idField,
        rowIndex
      );
    } else if (cellTextField && cellTextField.display) {
      cellText = formatFieldValue(cellTextField, cellTextField.values[rowIndex]);
    } else if (idField && idField.display) {
      cellText = formatFieldValue(idField, idField.values[rowIndex]);
    }
  }

  return (
    <CellTooltip node={node} frame={frame} rowIndex={rowIndex} options={options}>
      <div
        className={cx(styles.cell)}
        style={{
          background: `linear-gradient(to bottom right, ${cellColor} 0%, ${cellColor} 50%, ${overrideColor} 50%, ${overrideColor} 100%)`,
        }}
      >
        {cellText ? (
          <div
            className={styles.cellText}
            style={{
              color: theme.colors.getContrastText(cellColor),
            }}
          >
            {cellText}
          </div>
        ) : null}
      </div>
    </CellTooltip>
  );
};
