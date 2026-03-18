import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  Button,
  ComboboxOption,
  Field,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
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
} from '../../types';
import { findFrame } from '../../library/dataFrame';
import { FieldCombobox } from './FieldCombobox';
import { JoinEditor } from './JoinEditor';
import { SeverityOverridesEditor } from './SeverityOverridesEditor';
import { SuggestionsFromEditorContext } from './TemplatePatternEditor';

const JOIN_OPTION_VALUE = '__join__';
const SECTION_OPTION_VALUE = '__section__';

const getStyles = (theme: GrafanaTheme2) => ({
  dragHandle: css({
    cursor: 'grab',
    color: theme.colors.text.secondary,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  entryRow: css({
    alignItems: 'center',
  }),
  entryLabelSecondary: css({
    color: theme.colors.text.secondary,
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
}

export const DisplayEntriesEditor: React.FC<DisplayEntriesEditorProps> = ({
  value,
  onChange,
  allFrames,
  primaryFieldOptions,
}) => {
  const fieldComboboxOptions = useMemo((): Array<ComboboxOption<string>> => {
    return [
      ...primaryFieldOptions,
      {
        value: JOIN_OPTION_VALUE,
        label: 'Join from another frame',
        description: 'Join data from a secondary data frame',
      },
      {
        value: SECTION_OPTION_VALUE,
        label: 'Section heading',
        description: 'Visual separator between entry groups',
      },
    ];
  }, [primaryFieldOptions]);

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
                        allFrames={allFrames}
                        primaryFieldOptions={primaryFieldOptions}
                        fieldComboboxOptions={fieldComboboxOptions}
                        hiddenValues={hiddenValues}
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
          <Button
            variant={value.length === 0 ? 'primary' : 'secondary'}
            icon={value.length === 0 ? undefined : 'plus'}
            aria-label="Add entry"
            title="Add entry"
            onClick={() =>
              onChange([
                ...value,
                {
                  id: crypto.randomUUID(),
                  type: 'field',
                  field: '',
                  overridesBorderColor: false,
                } satisfies FieldDisplayEntry,
              ])
            }
          >
            {value.length === 0 ? 'Add entry' : null}
          </Button>
        </InlineField>
      </InlineFieldRow>
    </>
  );
};

interface EntryEditorRowProps {
  value: DisplayEntry;
  allFrames: DataFrame[];
  primaryFieldOptions: Array<ComboboxOption<string>>;
  fieldComboboxOptions: Array<ComboboxOption<string>>;
  hiddenValues: string[];
  onChange: (entry: DisplayEntry) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement> | null;
}

const EntryEditorRow: React.FC<EntryEditorRowProps> = ({
  value,
  allFrames,
  primaryFieldOptions,
  fieldComboboxOptions,
  hiddenValues,
  onChange,
  onDelete,
  dragHandleProps,
}) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(value.type === 'join' ? !value.sourceFrame : false);

  const comboboxValue =
    value.type === 'heading'
      ? SECTION_OPTION_VALUE
      : value.type === 'field'
        ? value.field || null
        : JOIN_OPTION_VALUE;

  const handleComboboxChange = (selected: string | null) => {
    if (selected === SECTION_OPTION_VALUE) {
      onChange({
        id: value.id,
        type: 'heading',
        title: '',
      } satisfies HeadingDisplayEntry);
      setIsOpen(false);
    } else if (selected === JOIN_OPTION_VALUE) {
      onChange({
        id: value.id,
        type: 'join',
        sourceFrame: '',
        sourceField: '',
        keys: [],
        overridesBorderColor: value.type !== 'heading' ? value.overridesBorderColor : false,
      } satisfies JoinDisplayEntry);
      setIsOpen(true);
    } else {
      onChange({
        id: value.id,
        type: 'field',
        field: selected ?? '',
        overridesBorderColor: value.type !== 'heading' ? value.overridesBorderColor : false,
      } satisfies FieldDisplayEntry);
    }
  };

  return (
    <div>
      <InlineFieldRow style={{ flexWrap: 'nowrap' }} className={styles.entryRow}>
        <InlineField {...dragHandleProps}>
          <Icon name="draggabledots" className={styles.dragHandle} />
        </InlineField>
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
        <InlineField grow={true} shrink={true}>
          <FieldCombobox
            options={fieldComboboxOptions}
            hiddenValues={hiddenValues}
            value={comboboxValue}
            onChange={handleComboboxChange}
            isClearable={true}
            placeholder="Select a field or join"
            autoFocus={true}
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
      {isOpen && (
        <div className={styles.entryBody}>
          {value.type === 'heading' ? (
            <Field label="Heading text" description="Leave empty to render a horizontal ruler">
              <Input
                value={value.title}
                onChange={(e) =>
                  onChange({ ...value, title: e.currentTarget.value } satisfies HeadingDisplayEntry)
                }
                placeholder="Section title"
              />
            </Field>
          ) : value.type === 'field' ? (
            <FieldEntrySettings value={value} onChange={onChange} />
          ) : (
            <JoinEditor<JoinDisplayEntry>
              value={value}
              onChange={onChange}
              allFrames={allFrames}
              primaryFieldOptions={primaryFieldOptions}
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
