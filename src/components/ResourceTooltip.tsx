import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { GroupNode } from 'library/groupFrames';
import React, { useMemo } from 'react';
import { HostViewerOptions } from 'types';
import { IndexedFrame } from '../library/dataFrame';
import { ResourceDetails, ResourceDetailsConfig } from './ResourceDetails';

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipAdjust: css({
    margin: theme.spacing(-2, -1),
  }),
});

interface ResourceTooltipProps {
  node: GroupNode;
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
}

export const ResourceTooltip: React.FC<ResourceTooltipProps> = ({
  node,
  frame,
  rowIndex,
  options,
}) => {
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
    <ResourceDetails
      node={node}
      frame={frame}
      rowIndex={rowIndex}
      options={options}
      config={config}
      className={styles.tooltipAdjust}
    />
  );
};
