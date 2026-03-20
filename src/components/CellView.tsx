import { css, cx } from '@emotion/css';
import { DataFrameWithValue, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { GroupNode, isSidecarRow } from 'library/groupFrames';
import React, { useMemo } from 'react';
import { HostViewerOptions, ResourceDisplayMode } from 'types';
import { getCellSizeTier } from '../library/cellSize';
import { useOverrideColor } from '../library/criticality';
import { IndexedFrame } from '../library/dataFrame';
import { interpolateWithDataContext } from '../library/interpolate';
import { resolveStatusField } from '../library/joinFrames';
import { formatFieldValue } from './FieldRow';
import { useHostViewerPanelContext } from './PanelContext';
import { CellTooltip } from './CellTooltip';

function getStyles(theme: GrafanaTheme2, cellSize: number) {
  const tier = getCellSizeTier(cellSize);
  const sidecarPad = Math.max(2, Math.min(10, Math.round(cellSize * 0.15)));
  const innerSize = cellSize - sidecarPad * 2;
  const borderRadius = String(tier === 'cellS' ? 0 : theme.shape.radius.sm);
  const innerRadius = parseFloat(borderRadius) / 2;

  return {
    cell: css({
      cursor: 'pointer',
      outlineStyle: 'none',
      width: cellSize,
      height: cellSize,
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
      width: `calc(${cellSize}px - ${theme.spacing(1)})`,
      height: `calc(${cellSize}px - ${theme.spacing(1)})`,
      textAlign: 'center',
      wordBreak: 'break-all',
      overflow: 'hidden',
      margin: theme.spacing(0.5),
      lineHeight: `calc(${cellSize}px - ${theme.spacing(1)} + 1px)`,
      textTransform: 'uppercase',
    }),
    cellTextSidecar: css({
      width: `calc(${innerSize}px - ${theme.spacing(1)})`,
      height: `calc(${innerSize}px - ${theme.spacing(1)})`,
      lineHeight: `calc(${innerSize}px - ${theme.spacing(1)} + 1px)`,
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
  const resolvedStatus = useMemo(
    () => resolveStatusField(options, frame, rowIndex, context.joinIndices, context.replaceVariables, context.data),
    [options, frame, rowIndex, context]
  );

  const statusField = resolvedStatus?.field;
  const statusRowIndex = resolvedStatus?.rowIndex ?? rowIndex;
  const statusValue = statusField
    ? statusField?.type === 'frame'
      ? (statusField.values[statusRowIndex] as DataFrameWithValue).value
      : statusField.values[statusRowIndex]
    : undefined;
  const displayValue =
    statusField && statusField.display ? statusField.display(statusValue) : undefined;

  const sidecar = isSidecarRow(frame, rowIndex);

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

  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${cellColor} 0%, ${cellColor} 50%, ${overrideColor} 50%, ${overrideColor} 100%)`,
  };

  const textEl = cellText ? (
    <div
      className={cx(styles.cellText, sidecar && styles.cellTextSidecar)}
      style={{ color: theme.colors.getContrastText(cellColor) }}
    >
      {cellText}
    </div>
  ) : null;

  return (
    <CellTooltip node={node} frame={frame} rowIndex={rowIndex} options={options}>
      {sidecar ? (
        <div className={cx(styles.cell, styles.cellSidecarOuter)}>
          <div className={styles.cellSidecarInner} style={gradientStyle}>
            {textEl}
          </div>
        </div>
      ) : (
        <div className={styles.cell} style={gradientStyle}>
          {textEl}
        </div>
      )}
    </CellTooltip>
  );
};
