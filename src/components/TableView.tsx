import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, useTheme2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { HostViewerOptions } from 'types';
import { useOverrideColor } from '../library/criticality';
import { IndexedFrame } from '../library/dataFrame';
import { ResourceDetails, ResourceDetailsConfig } from './ResourceDetails';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
  wrapperExpanded: css({
    overflow: 'visible',
    zIndex: 3,
    filter: `drop-shadow(${theme.shadows.z2})`,
  }),
  card: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'start',
    alignContent: 'start',
    columnGap: theme.spacing(0.5),
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
  moreEntries: css({
    display: 'contents',
  }),
  moreEntriesCollapsed: css({
    display: 'contents',
    visibility: 'hidden',
    '& > *': {
      height: '0 !important',
      overflow: 'hidden !important',
      paddingTop: '0 !important',
      paddingBottom: '0 !important',
      marginTop: '0 !important',
      marginBottom: '0 !important',
      borderTopWidth: '0 !important',
      borderBottomWidth: '0 !important',
      lineHeight: '0 !important',
    },
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
  const [wrapperHeight, setWrapperHeight] = useState<number | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const moreEntriesId = useId();

  const allEntries = options.displayEntries;
  const entries = useMemo(() => allEntries.filter((e) => !e.hidden), [allEntries]);
  const splitIndex = entries.findIndex((e) => e.type === 'heading' || e.type === 'separator');
  const mainEntries = useMemo(
    () => (splitIndex >= 0 ? entries.slice(0, splitIndex) : entries),
    [entries, splitIndex]
  );
  const moreEntries = useMemo(
    () => (splitIndex >= 0 ? entries.slice(splitIndex + 1) : []),
    [entries, splitIndex]
  );
  const hasMoreEntries = moreEntries.length > 0;

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      if (!prev && cardRef.current) {
        setWrapperHeight(cardRef.current.offsetHeight);
      } else {
        setWrapperHeight(undefined);
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (wrapperRef.current?.contains(target)) {
        return;
      }
      if (target.closest?.('[role="menu"]')) {
        return;
      }

      setExpanded(false);
      setWrapperHeight(undefined);
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
      titleField: options.titleField,
      titlePattern: options.titlePattern,
      entries: mainEntries,
    }),
    [options.titleField, options.titlePattern, mainEntries]
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
      className={cx(styles.wrapper, expanded && styles.wrapperExpanded)}
      style={wrapperHeight !== undefined ? { height: wrapperHeight } : undefined}
    >
      <div ref={cardRef} className={styles.card} style={{ borderColor }}>
        <ResourceDetails
          frame={frame}
          rowIndex={rowIndex}
          options={options}
          config={config}
          inline={true}
          showStatus={true}
        />
        {hasMoreEntries && (
          <button
            className={styles.showMoreButton}
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={moreEntriesId}
          >
            <Icon
              name={expanded ? 'angle-down' : 'angle-right'}
              size="sm"
              className={styles.showMoreIcon}
            />
            {expanded ? 'show less' : 'show more'}
          </button>
        )}
        {hasMoreEntries && (
          <div
            id={moreEntriesId}
            role="region"
            aria-hidden={!expanded}
            className={cx(expanded ? styles.moreEntries : styles.moreEntriesCollapsed)}
          >
            <ResourceDetails
              frame={frame}
              rowIndex={rowIndex}
              options={options}
              config={moreConfig}
              inline={true}
              showStatus={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
