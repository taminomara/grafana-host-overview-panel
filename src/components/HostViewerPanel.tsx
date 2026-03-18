import { css, cx } from '@emotion/css';
import { getFrameDisplayName, GrafanaTheme2, PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';
import React, { useEffect, useMemo, useRef } from 'react';
import { HostViewerOptions, Join } from 'types';
import { findFrame, indexFrame } from '../library/dataFrame';
import { groupFrame } from '../library/groupFrames';
import { buildJoinIndices } from '../library/joinFrames';
import { GroupView } from './GroupView';
import { HostViewerPanelContextProvider } from './PanelContext';
import { TooltipContextProvider } from './TooltipContext';

interface Props extends PanelProps<HostViewerOptions> {}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      position: 'relative',
      overflow: 'auto',
      '--row-hover-bg': theme.colors.background.primary,
    }),
    wrapperTransparent: css({
      '--row-hover-bg': theme.colors.background.canvas,
    }),
    error: css({
      margin: theme.spacing(1),
    }),
  };
};

export const HostViewerPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  replaceVariables,
  timeRange,
  transparent,
}) => {
  const styles = useStyles2(getStyles);

  const duplicateFrameIds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const frame of data.series) {
      const id = frame.refId ?? getFrameDisplayName(frame);
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  }, [data.series]);

  const rawFrame = findFrame(data.series, options.dataFrame);
  const frame = useMemo(() => (rawFrame ? indexFrame(rawFrame) : null), [rawFrame]);

  const allJoins = useMemo(() => {
    const joins: Join[] = [];
    for (const entry of options.displayEntries ?? []) {
      if (entry.type === 'join') {
        joins.push(entry);
      }
    }
    for (const group of options.groups ?? []) {
      for (const entry of group.entries ?? []) {
        if (entry.type === 'join') {
          joins.push(entry);
        }
      }
      if (group.knownIdsJoin) {
        joins.push(group.knownIdsJoin);
      }
    }
    if (options.knownIdsJoin) {
      joins.push(options.knownIdsJoin);
    }
    return joins;
  }, [options.displayEntries, options.groups, options.knownIdsJoin]);

  const joinIndices = useMemo(() => {
    const indices = buildJoinIndices(data.series, allJoins);
    return new Map(indices.map((idx) => [idx.config.id, idx]));
  }, [data.series, allJoins]);

  useEffect(() => {
    for (const idx of joinIndices.values()) {
      idx.getKeyMap();
    }
  }, [joinIndices]);

  const panelContext = useMemo(
    () => ({ data: data.series, replaceVariables, joinIndices, timeRange }),
    [replaceVariables, data.series, joinIndices, timeRange]
  );

  const tooltipPinnedRef = useRef(false);
  const tooltipContext = useMemo(() => ({ pinnedRef: tooltipPinnedRef }), []);

  const rootNode = useMemo(
    () => (frame ? groupFrame(frame, options, panelContext) : null),
    [frame, options, panelContext]
  );

  if (duplicateFrameIds.length > 0) {
    return (
      <div className={styles.error}>
        <Alert title="Duplicate data frame IDs" severity="error">
          The following data frames share the same ID: {duplicateFrameIds.join(', ')}. Use a
          &ldquo;Merge series/tables&rdquo; transform to combine them into a single frame.
        </Alert>
      </div>
    );
  }

  if (options.dataFrame && !rawFrame) {
    return (
      <div className={styles.error}>
        <Alert title="Data frame not found" severity="error">
          Data frame &ldquo;{options.dataFrame}&rdquo; was not found. Available data frames:{' '}
          {data.series.map((f) => f.refId ?? getFrameDisplayName(f)).join(', ') || 'none'}.
        </Alert>
      </div>
    );
  }

  if (!rootNode) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} />;
  }

  return (
    <HostViewerPanelContextProvider value={panelContext}>
      <TooltipContextProvider value={tooltipContext}>
        <div
          className={cx(
            styles.wrapper,
            transparent && styles.wrapperTransparent,
            css({ width: width, height: height })
          )}
        >
          <GroupView node={rootNode} options={options} />
        </div>
      </TooltipContextProvider>
    </HostViewerPanelContextProvider>
  );
};
