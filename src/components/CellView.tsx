import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Toggletip, useStyles2, useTheme2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React, { useRef, useState } from 'react';
import { ResourceDisplayMode, HostViewerOptions } from 'types';
import { getCellSizeTier } from '../library/cellSize';
import { useOverrideColor } from '../library/criticality';
import { IndexedFrame } from '../library/dataFrame';
import { interpolateWithDataContext } from '../library/interpolate';
import { ResourceTooltip } from './ResourceTooltip';
import { useHostViewerPanelContext } from './PanelContext';
import { formatFieldValue } from './FieldRow';

let _TooltipsOpened = 0;

function getStyles(theme: GrafanaTheme2, cellSize: number) {
  const tier = getCellSizeTier(cellSize);
  return {
    cellWrapper: css({
      cursor: 'pointer',
    }),
    cellWrapperSelected: css({
      outlineStyle: 'auto',
      zIndex: 2,
    }),
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
  const [tooltipOpened, setTooltipVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const idField = frame.fieldByName.get(options.idField);
  const statusField = frame.fieldByName.get(options.statusField);
  const displayValue =
    statusField && statusField.display
      ? statusField.display(statusField.values[rowIndex])
      : undefined;

  const cellColor = displayValue?.color ?? theme.colors.background.elevated;
  const overrideColor =
    useOverrideColor(options.tooltipEntries ?? [], frame, rowIndex) ?? cellColor;

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
    <div
      onMouseEnter={() => {
        if (_TooltipsOpened === 0) {
          setHovering(true);
        }
      }}
      onMouseLeave={() => {
        setHovering(false);
      }}
      onClickCapture={(e) => {
        if (e.target !== nodeRef.current) {
          return;
        }

        if (tooltipOpened) {
          _TooltipsOpened -= 1;
          setTooltipVisible(false);
          setHovering(false);
        } else {
          _TooltipsOpened += 1;
          setTooltipVisible(true);
        }
        e.stopPropagation();
      }}
      className={cx(styles.cellWrapper, tooltipOpened ? styles.cellWrapperSelected : null)}
      data-testid="resource-cell"
      ref={nodeRef}
    >
      <div
        style={{
          pointerEvents: tooltipOpened ? undefined : 'none',
          cursor: tooltipOpened ? 'auto' : undefined,
        }}
      >
        <Toggletip
          content={() => (
            <ResourceTooltip node={node} frame={frame} rowIndex={rowIndex} options={options} />
          )}
          show={tooltipOpened || hovering}
          onOpen={() => {
            if (!tooltipOpened) {
              _TooltipsOpened += 1;
            }
            setTooltipVisible(true);
          }}
          onClose={() => {
            if (tooltipOpened) {
              _TooltipsOpened -= 1;
            }
            setTooltipVisible(false);
          }}
          closeButton={false}
          fitContent={true}
        >
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
        </Toggletip>
      </div>
    </div>
  );
};
