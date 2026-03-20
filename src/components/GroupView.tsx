import { css, cx } from '@emotion/css';
import { formattedValueToString, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { DataLinksButton } from './DataLinksButton';
import { createFrame } from 'library/dataFrame';
import React, { useMemo } from 'react';
import { getCellSizeTier } from '../library/cellSize';
import { getMostCriticalColor } from '../library/criticality';
import { GroupNode } from '../library/groupFrames';
import { interpolateWithDataContext } from '../library/interpolate';
import { resolveJoinSections } from '../library/joinFrames';
import { GridType, HostViewerOptions, JoinDisplayEntry, ResourceDisplayMode } from '../types';
import { useHostViewerPanelContext } from './PanelContext';
import { FieldRow } from './FieldRow';
import { CellView } from './CellView';
import { TableView } from './TableView';

function getContainerStyles(theme: GrafanaTheme2, gridType: GridType, gridColumns?: number) {
  switch (gridType) {
    case GridType.Horizontal:
      return css({ display: 'flex', flexDirection: 'row' });
    case GridType.Vertical:
      return css({ display: 'flex', flexDirection: 'column' });
    case GridType.Flow:
      return css({ display: 'flex', flexWrap: 'wrap' });
    case GridType.Grid:
      return css({
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns ?? 5}, 1fr)`,
      });
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({}),
  containerWithBorder: css({
    padding: theme.spacing(0.5),
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: theme.shape.radius.default,
  }),
  containerWithTransparentBackground: css({
    backgroundColor: 'transparent',
  }),
  containerWithNonTransparentBackground: css({
    backgroundColor: theme.colors.background.primary,
    '--row-hover-bg': theme.colors.background.primary,
  }),
  heading: css({
    lineHeight: 1,
    marginBottom: theme.spacing(0.5),
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    gap: theme.spacing(0.5),
  }),
  content: css({
    maxWidth: 'max-content',
  }),
  contentWithTitle: css({
    gap: theme.spacing(1),
  }),
  contentGroupGap: css({
    gap: theme.spacing(0.5),
  }),
  cellL: css({
    gap: theme.spacing(0.5),
  }),
  cellM: css({
    gap: theme.spacing(0.25),
  }),
  cellS: css({
    gap: 1,
  }),
  joinedData: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    columnGap: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  headingText: css({
    gridColumn: '1 / -1',
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
  }),
  headingRule: css({
    gridColumn: '1 / -1',
    border: 'none',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(0.5, 0),
  }),
});

interface GroupViewProps {
  node: GroupNode;
  options: HostViewerOptions;
}

export const GroupView: React.FC<GroupViewProps> = ({ node, options }) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const context = useHostViewerPanelContext();

  let border = useMemo(
    () => resolveGroupBorder(node, options, theme.colors.border.medium),
    [node, options, theme]
  );

  const containerClass = useStyles2(getContainerStyles, node.gridType, node.gridColumns);

  const cellTier = getCellSizeTier(options.cellSize ?? 20);
  const isRichMode = options.resourceDisplayMode === ResourceDisplayMode.Rich;

  const title = useMemo(() => {
    if (!node.showTitle) {
      return null;
    }

    const frameWithValues =
      node.frame.length > 0
        ? node.frame
        : createFrame(
            {
              ...node.frame,
              length: node.frame.length + 1,
              fields: node.frame.fields.map((field) => {
                return {
                  ...field,
                  values: [node.groupValues[field.name]],
                };
              }),
            },
            context
          );
    const field = frameWithValues.fieldByName.get(node.groupKey);
    const rawValue = node.groupValues[node.groupKey];
    const displayValue = field?.display ? field.display(rawValue) : undefined;

    let titleText: string;
    if (field && node.titlePattern) {
      titleText = interpolateWithDataContext(
        context.replaceVariables,
        node.titlePattern,
        context.data,
        frameWithValues,
        field,
        0
      );
    } else if (displayValue) {
      const prefix = node.showKeyName ? getFieldDisplayName(field!, frameWithValues) + ' ' : '';
      titleText = prefix + formattedValueToString(displayValue);
    } else {
      titleText = String(rawValue);
    }

    const links =
      field?.getLinks && displayValue
        ? field.getLinks({ calculatedValue: displayValue, valueRowIndex: 0 })
        : [];

    return (
      <div className={styles.heading}>
        <span>{titleText}</span>
        <DataLinksButton links={links} />
      </div>
    );
  }, [node, context, styles]);

  const frameForEntries = useMemo(() => {
    if (node.entries.length === 0) {
      return null;
    }
    return node.frame.length > 0
      ? node.frame
      : createFrame(
          {
            ...node.frame,
            length: node.frame.length + 1,
            fields: node.frame.fields.map((field) => ({
              ...field,
              values: [node.groupValues[field.name]],
            })),
          },
          context
        );
  }, [node.entries, node.frame, node.groupValues, context]);

  const joinEntries = useMemo(
    () => node.entries.filter((e): e is JoinDisplayEntry => e.type === 'join' && !e.hidden),
    [node.entries]
  );
  const joinSections = useMemo(() => {
    if (joinEntries.length === 0 || !frameForEntries) {
      return null;
    }
    const sections = resolveJoinSections(
      joinEntries,
      frameForEntries,
      0,
      context.joinIndices,
      context.replaceVariables,
      context.data
    );
    return sections.length === 0 ? null : sections;
  }, [joinEntries, frameForEntries, context]);
  const joinSectionMap = useMemo(
    () => (joinSections ? new Map(joinSections.map((s) => [s.joinConfig.id, s])) : null),
    [joinSections]
  );

  if (border && node.entries.length > 0 && frameForEntries) {
    const overrideColor = getMostCriticalColor(
      node.entries,
      frameForEntries,
      0,
      context.joinIndices,
      context.replaceVariables,
      context.data,
      theme.visualization.getColorByName
    );
    if (overrideColor) {
      border = { ...border, color: overrideColor };
    }
  }

  return (
    <div
      className={cx(
        styles.container,
        border ? styles.containerWithBorder : null,
        node.transparentBackground
          ? styles.containerWithTransparentBackground
          : styles.containerWithNonTransparentBackground
      )}
      style={border ? { borderColor: theme.visualization.getColorByName(border.color) } : undefined}
    >
      {title}
      {node.entries.length > 0 && frameForEntries ? (
        <div className={styles.joinedData}>
          {node.entries.map((entry) => {
            if (entry.hidden) {
              return null;
            }
            if (entry.type === 'separator') {
              return <hr key={entry.id} className={styles.headingRule} />;
            }
            if (entry.type === 'heading') {
              return (
                <span key={entry.id} className={styles.headingText}>
                  {entry.title}
                </span>
              );
            }
            if (entry.type === 'field') {
              const field = frameForEntries.fieldByName.get(entry.field);
              if (!field) {
                return null;
              }
              return (
                <FieldRow
                  key={entry.id}
                  field={field}
                  frame={frameForEntries}
                  rowIndex={node.frame.length > 0 ? 0 : undefined}
                />
              );
            }
            const section = joinSectionMap?.get(entry.id);
            if (!section) {
              return null;
            }
            if (section.matchedRows.length > 0) {
              return (
                <React.Fragment key={entry.id}>
                  {section.matchedRows.map((joinedRowIndex) => (
                    <FieldRow
                      key={joinedRowIndex}
                      field={section.foreignField}
                      frame={section.index.frame}
                      rowIndex={joinedRowIndex}
                    />
                  ))}
                </React.Fragment>
              );
            }
            return (
              <FieldRow
                key={entry.id}
                field={section.foreignField}
                frame={section.index.frame}
                rowIndex={undefined}
              />
            );
          })}
        </div>
      ) : null}
      <div
        className={cx(
          styles.content,
          containerClass,
          node.children.length > 0 || isRichMode ? styles.contentGroupGap : styles[cellTier],
          node.children.length > 0 && !node.children[0].drawBorder ? styles.contentWithTitle : null
        )}
      >
        {node.children.length > 0
          ? node.children.map((child, i) => <GroupView key={i} node={child} options={options} />)
          : isRichMode
            ? Array(node.frame.length)
                .fill(0)
                .map((_, i) => (
                  <TableView
                    key={i}
                    node={node}
                    frame={node.frame}
                    rowIndex={i}
                    options={options}
                  />
                ))
            : Array(node.frame.length)
                .fill(0)
                .map((_, i) => (
                  <CellView key={i} node={node} frame={node.frame} rowIndex={i} options={options} />
                ))}
      </div>
    </div>
  );
};

interface ResolvedBorder {
  color: string;
}

function resolveGroupBorder(
  node: GroupNode,
  options: HostViewerOptions,
  themeBorderColor: string
): ResolvedBorder | null {
  if (!node.drawBorder) {
    return null;
  }
  return {
    color: node.borderColor || options.borderColor || themeBorderColor,
  };
}
