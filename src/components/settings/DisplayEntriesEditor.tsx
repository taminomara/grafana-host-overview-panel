import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  Button,
  ComboboxOption,
  Dropdown,
  Field,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
  Menu,
  MenuItem,
  Switch,
  useStyles2,
} from '@grafana/ui';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import React, { useMemo, useState } from 'react';
import {
  DisplayEntry,
  FieldDisplayEntry,
  HeadingDisplayEntry,
  HostViewerOptions,
  JoinDisplayEntry,
  SeparatorDisplayEntry,
} from '../../types';
import { findFrame } from '../../library/dataFrame';
import { FieldCombobox } from './FieldCombobox';
import { JoinEditor } from './JoinEditor';
import { SeverityOverridesEditor } from './SeverityOverridesEditor';
import { SuggestionsFromEditorContext } from './TemplatePatternEditor';

const getStyles = (theme: GrafanaTheme2) => ({
  dragHandle: css({
    cursor: 'grab',
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  entryRow: css({
    alignItems: 'baseline',
  }),
  entryLabelWrapper: css({
    flex: '1 1 0',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    margin: theme.spacing(0, 0.5),
  }),
  entryLabelSecondary: css({
    color: theme.colors.text.secondary,
  }),
  separatorWrapper: css({
    flex: '1 1 0',
    display: 'flex',
    alignItems: 'baseline',
    margin: theme.spacing(0, 0.5),
  }),
  separatorLine: css({
    borderBottom: `1px solid ${theme.colors.border.medium}`,
    marginLeft: theme.spacing(4.5),
    width: 100,
  }),
  entryBody: css({
    padding: theme.spacing(1, 0, 1, 2),
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.colors.border.weak,
  }),
});

interface DisplayEntriesEditorProps {
  value: DisplayEntry[];
  onChange: (entries: DisplayEntry[]) => void;
  allFrames: DataFrame[];
  primaryFieldOptions: Array<ComboboxOption<string>>;
  hiddenKeyFields?: string[];
}

export const DisplayEntriesEditor: React.FC<DisplayEntriesEditorProps> = ({
  value,
  onChange,
  allFrames,
  primaryFieldOptions,
  hiddenKeyFields,
}) => {
  const hiddenValues = useMemo(
    () => value.filter((e): e is FieldDisplayEntry => e.type === 'field').map((e) => e.field),
    [value]
  );

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const update = [...value];
    const [moved] = update.splice(result.source.index, 1);
    update.splice(result.destination.index, 0, moved);
    onChange(update);
  };

  const addEntry = (entry: DisplayEntry) => {
    onChange([...value, entry]);
  };

  const menu = (
    <Menu>
      <MenuItem
        label="Field"
        icon="text-fields"
        description="Display a field from the primary frame"
        onClick={() =>
          addEntry({
            id: crypto.randomUUID(),
            type: 'field',
            field: '',
            overridesBorderColor: false,
          } satisfies FieldDisplayEntry)
        }
      />
      <MenuItem
        label="Join"
        icon="link"
        description="Join data from another frame"
        onClick={() =>
          addEntry({
            id: crypto.randomUUID(),
            type: 'join',
            foreignFrame: '',
            foreignField: '',
            keys: [],
            overridesBorderColor: false,
          } satisfies JoinDisplayEntry)
        }
      />
      <MenuItem
        label="Heading"
        icon="paragraph"
        description="Section heading text"
        onClick={() =>
          addEntry({
            id: crypto.randomUUID(),
            type: 'heading',
            title: '',
          } satisfies HeadingDisplayEntry)
        }
      />
      <MenuItem
        label="Separator"
        icon="minus"
        description="Horizontal rule"
        onClick={() =>
          addEntry({
            id: crypto.randomUUID(),
            type: 'separator',
          } satisfies SeparatorDisplayEntry)
        }
      />
    </Menu>
  );

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="entries" direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {value.map((entry, i) => (
                <Draggable key={entry.id} draggableId={entry.id} index={i}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <EntryEditorRow
                        value={entry}
                        isLast={i === value.length - 1}
                        allFrames={allFrames}
                        primaryFieldOptions={primaryFieldOptions}
                        hiddenValues={hiddenValues}
                        hiddenKeyFields={hiddenKeyFields}
                        onChange={(updated) =>
                          onChange(value.map((e, k) => (k === i ? updated : e)))
                        }
                        onDelete={() => onChange(value.filter((_, k) => k !== i))}
                        dragHandleProps={provided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <InlineFieldRow style={value.length === 0 ? undefined : { flexFlow: 'row-reverse' }}>
        <InlineField>
          <Dropdown overlay={menu}>
            <Button
              variant={value.length === 0 ? 'primary' : 'secondary'}
              icon={value.length === 0 ? undefined : 'plus'}
              aria-label="Add entry"
              title="Add entry"
            >
              {value.length === 0 ? 'Add entry' : null}
            </Button>
          </Dropdown>
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

interface EntryEditorRowProps {
  value: DisplayEntry;
  isLast: boolean;
  allFrames: DataFrame[];
  primaryFieldOptions: Array<ComboboxOption<string>>;
  hiddenValues: string[];
  hiddenKeyFields?: string[];
  onChange: (entry: DisplayEntry) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement> | null;
}

const EntryEditorRow: React.FC<EntryEditorRowProps> = ({
  value,
  isLast,
  allFrames,
  primaryFieldOptions,
  hiddenValues,
  hiddenKeyFields,
  onChange,
  onDelete,
  dragHandleProps,
}) => {
  const styles = useStyles2(getStyles);

  const isUnconfigured =
    (value.type === 'field' && !value.field) ||
    (value.type === 'join' && !value.foreignFrame) ||
    (value.type === 'heading' && !value.title);

  const [isOpen, setIsOpen] = useState(isLast && isUnconfigured);

  const isSeparator = value.type === 'separator';

  return (
    <div>
      <InlineFieldRow style={{ flexWrap: 'nowrap' }} className={styles.entryRow}>
        <InlineField {...dragHandleProps}>
          <Icon name="draggabledots" className={styles.dragHandle} />
        </InlineField>
        {!isSeparator && (
          <InlineField>
            <Button
              variant="secondary"
              fill="text"
              icon={isOpen ? 'angle-down' : 'angle-right'}
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              title={isOpen ? 'Collapse' : 'Expand'}
            />
          </InlineField>
        )}
        <EntryLabel
          value={value}
          onClick={isSeparator ? undefined : () => setIsOpen(!isOpen)}
        />
        <InlineField>
          <Button
            variant={value.hidden ? 'destructive' : 'secondary'}
            icon={value.hidden ? 'eye-slash' : 'eye'}
            aria-label={value.hidden ? 'Show entry' : 'Hide entry'}
            title={value.hidden ? 'Show entry' : 'Hide entry'}
            onClick={() => onChange({ ...value, hidden: !value.hidden })}
          />
        </InlineField>
        <InlineField>
          <Button
            variant="secondary"
            icon="trash-alt"
            aria-label="Delete entry"
            title="Delete entry"
            onClick={onDelete}
          />
        </InlineField>
      </InlineFieldRow>
      {isOpen && !isSeparator && (
        <div className={styles.entryBody}>
          {value.type === 'heading' ? (
            <Field label="Heading text">
              <Input
                value={value.title}
                onChange={(e) =>
                  onChange({ ...value, title: e.currentTarget.value } satisfies HeadingDisplayEntry)
                }
                placeholder="Section title"
              />
            </Field>
          ) : value.type === 'field' ? (
            <>
              <Field label="Field">
                <FieldCombobox
                  options={primaryFieldOptions}
                  hiddenValues={hiddenValues}
                  value={value.field || null}
                  onChange={(v) => onChange({ ...value, field: v ?? '' })}
                  isClearable={true}
                  placeholder="Select a field"
                />
              </Field>
              <FieldEntrySettings value={value} onChange={onChange} />
            </>
          ) : (
            <JoinEditor<JoinDisplayEntry>
              value={value}
              onChange={onChange}
              allFrames={allFrames}
              primaryFieldOptions={primaryFieldOptions}
              hiddenKeyFields={hiddenKeyFields}
            >
              <Field
                label="Overrides border color"
                description="Allow thresholds of the joined value to override border color"
                horizontal={true}
              >
                <Switch
                  value={value.overridesBorderColor}
                  onChange={(v) =>
                    onChange({ ...value, overridesBorderColor: v.currentTarget.checked })
                  }
                />
              </Field>
              {value.overridesBorderColor && (
                <Field
                  label="Severity overrides"
                  description="Custom severity scores for threshold colors"
                >
                  <SeverityOverridesEditor
                    value={value.severityOverrides ?? []}
                    onChange={(severityOverrides) => onChange({ ...value, severityOverrides })}
                  />
                </Field>
              )}
            </JoinEditor>
          )}
        </div>
      )}
    </div>
  );
};

interface EntryLabelProps {
  value: DisplayEntry;
  onClick?: () => void;
}

const EntryLabel: React.FC<EntryLabelProps> = ({ value, onClick }) => {
  const styles = useStyles2(getStyles);

  if (value.type === 'separator') {
    return (
      <div className={styles.separatorWrapper}>
        <div className={styles.separatorLine} />
      </div>
    );
  }

  let label: React.ReactNode;
  let title: string | undefined;

  if (value.type === 'heading') {
    title = value.title || undefined;
    label = value.title ? value.title : <span className={styles.entryLabelSecondary}>(empty heading)</span>;
  } else if (value.type === 'field') {
    title = value.field || undefined;
    label = value.field ? value.field : <span className={styles.entryLabelSecondary}>(no field selected)</span>;
  } else {
    title = value.foreignField || undefined;
    label = value.foreignField ? value.foreignField : <span className={styles.entryLabelSecondary}>(not configured)</span>;
  }

  return (
    <div className={styles.entryLabelWrapper} onClick={onClick} title={title}>
      {label}
    </div>
  );
};

interface FieldEntrySettingsProps {
  value: FieldDisplayEntry;
  onChange: (entry: DisplayEntry) => void;
}

const FieldEntrySettings: React.FC<FieldEntrySettingsProps> = ({ value, onChange }) => {
  return (
    <>
      <Field
        label="Overrides border color"
        description="Allow thresholds of this field to override border color"
        horizontal={true}
      >
        <Switch
          value={value.overridesBorderColor}
          onChange={(v) => onChange({ ...value, overridesBorderColor: v.currentTarget.checked })}
        />
      </Field>
      {value.overridesBorderColor && (
        <Field label="Severity overrides" description="Custom severity scores for threshold colors">
          <SeverityOverridesEditor
            value={value.severityOverrides ?? []}
            onChange={(severityOverrides) => onChange({ ...value, severityOverrides })}
          />
        </Field>
      )}
    </>
  );
};

export const DisplayEntriesEditorWrapper = ({
  value,
  onChange,
  context,
}: StandardEditorProps<DisplayEntry[], unknown, HostViewerOptions>) => {
  const allFrames = context.data ?? [];
  const primaryFrame = findFrame(allFrames, context.options?.dataFrame);

  const primaryFieldOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      primaryFrame
        ? primaryFrame.fields.map((f) => ({ label: f.name, value: f.name, description: f.type }))
        : [],
    [primaryFrame]
  );

  return (
    <SuggestionsFromEditorContext context={context}>
      <DisplayEntriesEditor
        value={value ?? []}
        onChange={onChange}
        allFrames={allFrames}
        primaryFieldOptions={primaryFieldOptions}
      />
    </SuggestionsFromEditorContext>
  );
};
