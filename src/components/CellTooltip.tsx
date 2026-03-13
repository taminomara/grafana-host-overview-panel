import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HostViewerOptions } from 'types';
import { IndexedFrame } from '../library/dataFrame';
import { ResourceDetails, ResourceDetailsConfig } from './ResourceDetails';
import { useTooltipContext } from './TooltipContext';

const getStyles = (theme: GrafanaTheme2) => ({
  cellWrapper: css({
    cursor: 'pointer',
  }),
  cellWrapperSelected: css({
    outlineStyle: 'auto',
    zIndex: 2,
  }),
  tooltipContent: css({
    '--row-hover-bg': theme.components.tooltip.background,
  }),
});

interface CellTooltipProps {
  node: GroupNode;
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
  children: JSX.Element;
}

export const CellTooltip: React.FC<CellTooltipProps> = ({
  node,
  frame,
  rowIndex,
  options,
  children,
}) => {
  const styles = useStyles2(getStyles);
  const { pinnedRef } = useTooltipContext();
  const [tooltipOpened, setTooltipVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipOpened) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (nodeRef.current?.contains(target)) {
        return;
      }
      if (tooltipRef.current?.contains(target)) {
        return;
      }
      if (target.closest?.('[role="menu"]')) {
        return;
      }
      pinnedRef.current = false;
      setTooltipVisible(false);
      setHovering(false);
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tooltipOpened, pinnedRef]);

  return (
    <div
      onMouseEnter={() => {
        if (!pinnedRef.current) {
          setHovering(true);
        }
      }}
      onMouseLeave={() => {
        setHovering(false);
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest?.('[role="menu"]')) {
          return;
        }
        if (tooltipRef.current?.contains(target)) {
          return;
        }
        if (tooltipOpened) {
          pinnedRef.current = false;
          setTooltipVisible(false);
          setHovering(false);
        } else {
          pinnedRef.current = true;
          setTooltipVisible(true);
        }
        e.stopPropagation();
      }}
      className={cx(styles.cellWrapper, tooltipOpened ? styles.cellWrapperSelected : null)}
      data-testid="resource-cell"
      ref={nodeRef}
    >
      <Tooltip
        content={() => (
          <div ref={tooltipRef}>
            <CellTooltipContent
              node={node}
              frame={frame}
              rowIndex={rowIndex}
              options={options}
            />
          </div>
        )}
        show={tooltipOpened || hovering}
        placement="bottom"
      >
        {children}
      </Tooltip>
    </div>
  );
};

const CellTooltipContent: React.FC<{
  node: GroupNode;
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
}> = ({ node, frame, rowIndex, options }) => {
  const styles = useStyles2(getStyles);

  const config = useMemo(
    (): ResourceDetailsConfig => ({
      titleField: options.tooltipTitleField,
      titlePattern: options.tooltipTitlePattern,
      entries: options.displayEntries ?? [],
    }),
    [options.tooltipTitleField, options.tooltipTitlePattern, options.displayEntries]
  );

  return (
    <div data-testid="resource-tooltip" className={styles.tooltipContent}>
      <ResourceDetails
        frame={frame}
        rowIndex={rowIndex}
        options={options}
        config={config}
        showStatus={true}
      />
    </div>
  );
};
