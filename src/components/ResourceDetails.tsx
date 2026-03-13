import { css, cx } from '@emotion/css';
import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { DisplayEntry, HostViewerOptions } from 'types';
import { IndexedFrame } from '../library/dataFrame';
import { interpolateWithDataContext } from '../library/interpolate';
import { resolveJoinSections } from '../library/joinFrames';
import { DataLinksButton } from './DataLinksButton';
import { FieldRow, formatFieldValue } from './FieldRow';
import { useHostViewerPanelContext } from './PanelContext';

export interface ResourceDetailsConfig {
  titleField: string | false;
  titlePattern: string;
  entries: DisplayEntry[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto auto',
    alignItems: 'center',
    columnGap: theme.spacing(0.5),
  }),
  title: css({
    gridColumn: '1 / -1',
    fontWeight: theme.typography.fontWeightBold,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(0.25),
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

interface ResourceDetailsProps {
  frame: IndexedFrame;
  rowIndex: number;
  options: HostViewerOptions;
  config: ResourceDetailsConfig;
  className?: string;
  showStatus: Boolean;
}

export const ResourceDetails: React.FC<ResourceDetailsProps> = ({
  frame,
  rowIndex,
  options,
  config,
  className,
  showStatus,
}) => {
  const styles = useStyles2(getStyles);
  const context = useHostViewerPanelContext();

  const idField = frame.fieldByName.get(options.idField);
  const statusField = showStatus ? frame.fieldByName.get(options.statusField) : undefined;

  let title: string | undefined = undefined;
  let titleField;
  let titleDisplayValue;

  if (config.titleField !== false) {
    titleField = frame.fieldByName.get(config.titleField);
    if (idField && config.titleField === '__use_pattern__' && config.titlePattern) {
      title = interpolateWithDataContext(
        context.replaceVariables,
        config.titlePattern,
        context.data,
        frame,
        idField,
        rowIndex
      );
    } else if (titleField && titleField.display) {
      title = formatFieldValue(titleField, titleField.values[rowIndex]);
      titleDisplayValue = titleField.display(titleField.values[rowIndex]);
    } else if (idField && idField.display) {
      title = formatFieldValue(idField, idField.values[rowIndex]);
      titleDisplayValue = idField.display(idField.values[rowIndex]);
    }
  }

  const links: LinkModel[] = [];
  if (idField?.getLinks) {
    links.push(
      ...idField.getLinks({ calculatedValue: titleDisplayValue, valueRowIndex: rowIndex })
    );
  }
  if (titleField?.getLinks) {
    links.push(
      ...titleField.getLinks({ calculatedValue: titleDisplayValue, valueRowIndex: rowIndex })
    );
  }

  const joinEntries = config.entries.filter(
    (e): e is import('types').JoinDisplayEntry => e.type === 'join'
  );
  const joinSections =
    joinEntries.length > 0
      ? resolveJoinSections(
          joinEntries,
          frame,
          rowIndex,
          context.joinIndices,
          context.replaceVariables,
          context.data
        )
      : [];
  const joinSectionMap = new Map(joinSections.map((s) => [s.joinConfig.id, s]));

  return (
    <div className={cx(styles.container, className)}>
      {title || links.length > 0 ? (
        <div className={styles.title}>
          {title ? <span>{title}</span> : null}
          <DataLinksButton links={links} />
        </div>
      ) : null}
      {statusField ? <FieldRow field={statusField} frame={frame} rowIndex={rowIndex} /> : null}
      {config.entries.map((entry) => {
        if (entry.type === 'heading') {
          return entry.title ? (
            <span key={entry.id} className={styles.headingText}>
              {entry.title}
            </span>
          ) : (
            <hr key={entry.id} className={styles.headingRule} />
          );
        }
        if (entry.type === 'field') {
          const field = frame.fieldByName.get(entry.field);
          if (!field) {
            return null;
          }
          return <FieldRow key={entry.id} field={field} frame={frame} rowIndex={rowIndex} />;
        }
        const section = joinSectionMap.get(entry.id);
        if (!section || section.matchedRows.length === 0) {
          return null;
        }
        return (
          <React.Fragment key={entry.id}>
            {section.matchedRows.map((joinedRowIndex) => (
              <FieldRow
                key={joinedRowIndex}
                field={section.sourceField}
                frame={section.index.frame}
                rowIndex={joinedRowIndex}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
};
