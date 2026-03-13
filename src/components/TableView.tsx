import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HostViewerOptions } from 'types';
import { useOverrideColor } from '../library/criticality';
import { IndexedFrame } from '../library/dataFrame';
import { ResourceDetails, ResourceDetailsConfig } from './ResourceDetails';

const getStyles = (theme: GrafanaTheme2) => ({
  cardWrapper: css({
    position: 'relative',
  }),
  cardWrapperExpanded: css({
    zIndex: 2,
    boxShadow: theme.shadows.z2,
  }),
  card: css({
    position: 'relative',
    zIndex: 1,
    padding: theme.spacing(0.5),
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.primary,
    '--row-hover-bg': theme.colors.background.primary,
  }),
  showMoreButton: css({
    gridColumn: '1 / -1',
    background: 'none',
    border: 'none',
    padding: theme.spacing(0.25, 0),
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
    width: '100%',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  showMoreIcon: css({
    marginLeft: -6,
  }),
  cardExpanded: css({
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomStyle: 'none',
  }),
  tooltip: css({
    padding: theme.spacing(0.5),
    paddingTop: 0,
    marginTop: theme.spacing(-0.5),
    backgroundColor: theme.colors.background.primary,
    '--row-hover-bg': theme.colors.background.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    borderStyle: 'solid',
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: theme.shape.radius.default,
    borderBottomRightRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
  }),
  tooltipCollapsed: css({
    visibility: 'hidden',
  }),
});

interface TableViewProps {
  node: GroupNode;
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
}

export const TableView: React.FC<TableViewProps> = ({ node, frame, rowIndex, options }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const tooltipId = useId();

  const entries = options.displayEntries;
  const splitIndex = entries.findIndex((e) => e.type === 'heading');
  const mainEntries = useMemo(
    () => (splitIndex >= 0 ? entries.slice(0, splitIndex) : entries),
    [entries, splitIndex]
  );
  const moreEntries = useMemo(
    () => (splitIndex >= 0 ? entries.slice(splitIndex + 1) : []),
    [entries, splitIndex]
  );
  const hasMoreEntries = moreEntries.length > 0;

  const updateHeight = useCallback(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, []);

  useLayoutEffect(() => {
    updateHeight();

    const el = tooltipRef.current;
    if (!el) {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateHeight]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const statusField = frame.fieldByName.get(options.statusField);
  const displayValue =
    statusField && statusField.display
      ? statusField.display(statusField.values[rowIndex])
      : undefined;

  const overrideColor = useOverrideColor(entries, frame, rowIndex);

  const borderColor =
    overrideColor ??
    (displayValue?.color
      ? theme.visualization.getColorByName(displayValue.color)
      : theme.colors.border.medium);

  const config = useMemo(
    (): ResourceDetailsConfig => ({
      titleField: options.cellTextField,
      titlePattern: options.cellTextPattern,
      entries: mainEntries,
    }),
    [options.cellTextField, options.cellTextPattern, mainEntries]
  );

  const moreConfig = useMemo(
    (): ResourceDetailsConfig => ({
      titleField: false,
      titlePattern: '',
      entries: moreEntries,
    }),
    [moreEntries]
  );

  return (
    <div
      ref={wrapperRef}
      className={cx(styles.cardWrapper, expanded && styles.cardWrapperExpanded)}
    >
      <div className={cx(styles.card, expanded && styles.cardExpanded)} style={{ borderColor }}>
        <ResourceDetails
          frame={frame}
          rowIndex={rowIndex}
          options={options}
          config={config}
          showStatus={true}
        />
        {hasMoreEntries && (
          <button
            className={styles.showMoreButton}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={tooltipId}
          >
            <Icon
              name={expanded ? 'angle-down' : 'angle-right'}
              size="sm"
              className={styles.showMoreIcon}
            />
            {expanded ? 'show less' : 'show more'}
          </button>
        )}
      </div>
      {hasMoreEntries && (
        <div
          id={tooltipId}
          ref={tooltipRef}
          role="region"
          aria-hidden={!expanded}
          className={cx(styles.tooltip, expanded ? null : styles.tooltipCollapsed)}
          style={{ borderColor, marginBottom: -tooltipHeight }}
        >
          <ResourceDetails
            frame={frame}
            rowIndex={rowIndex}
            options={options}
            config={moreConfig}
            showStatus={false}
          />
        </div>
      )}
    </div>
  );
};
