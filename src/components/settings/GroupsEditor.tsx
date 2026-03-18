import { css } from '@emotion/css';
import { DataFrame, FieldType, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  Button,
  ComboboxOption,
  Icon,
  InlineField,
  InlineFieldRow,
  Toggletip,
  useStyles2,
} from '@grafana/ui';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import React, { useMemo, useState } from 'react';
import { GridType, Group, HostViewerOptions, SortMode } from 'types';
import { findFrame } from '../../library/dataFrame';
import { FieldCombobox } from './FieldCombobox';
import { GroupSettings } from './GroupSettings';
import { SuggestionsFromEditorContext } from './TemplatePatternEditor';

const getStyles = (theme: GrafanaTheme2) => ({
  dragHandle: css({
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    marginRight: theme.spacing(0.5),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
});

export const GroupsEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<Group[], any, HostViewerOptions>) => {
  const primaryFrame = useMemo(
    () => findFrame(context.data ?? [], context.options?.dataFrame),
    [context.data, context.options?.dataFrame]
  );

  const fieldOptions = useMemo(() => {
    if (!primaryFrame) {
      return [];
    }
    return primaryFrame.fields.map((field) => ({
      label: field.name,
      value: field.name,
      description: field.type,
    }));
  }, [primaryFrame]);

  const nonGroupableFields = useMemo(() => {
    if (!primaryFrame) {
      return [];
    }
    return primaryFrame.fields
      .filter(
        (field) =>
          ![FieldType.string, FieldType.boolean, FieldType.enum, FieldType.number].includes(
            field.type
          )
      )
      .map((field) => field.name);
  }, [primaryFrame]);

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
    <SuggestionsFromEditorContext context={context}>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="groups" direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {value.map((group, i) => (
                <Draggable key={group.id} draggableId={group.id} index={i}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <GroupEditor
                        value={group}
                        fieldOptions={fieldOptions}
                        nonGroupableFields={nonGroupableFields}
                        parentGroupKeys={value
                          .slice(0, i)
                          .map((g) => g.groupKey)
                          .filter((k) => k)}
                        allFrames={context.data ?? []}
                        onChange={(updatedGroup) =>
                          onChange(value.map((group, j) => (i === j ? updatedGroup : group)))
                        }
                        onDelete={() => onChange(value.filter((_, j) => i !== j))}
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
            aria-label="Add Group"
            title="Add Group"
            onClick={() =>
              onChange([
                ...value,
                {
                  id: crypto.randomUUID(),
                  groupKey: '',
                  gridType: GridType.Flow,
                  sortMode: SortMode.Disabled,
                  showTitle: true,
                  showKeyName: false,
                  drawBorder: true,
                  transparentBackground: false,
                  gridColumns: 5,
                  knownIds: '',
                  knownIdsJoin: {
                    id: crypto.randomUUID(),
                    foreignFrame: '',
                    foreignField: '',
                    keys: [],
                  },
                  entries: [],
                },
              ])
            }
          >
            {value.length === 0 ? 'Add new grouping rule' : null}
          </Button>
        </InlineField>
      </InlineFieldRow>
    </SuggestionsFromEditorContext>
  );
};

export const GroupEditor = ({
  value,
  nonGroupableFields,
  parentGroupKeys,
  fieldOptions,
  allFrames,
  onChange,
  onDelete,
  dragHandleProps,
}: {
  value: Group;
  nonGroupableFields: string[];
  parentGroupKeys: string[];
  fieldOptions: Array<ComboboxOption<string>>;
  allFrames: DataFrame[];
  onChange: (group: Group) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement> | null;
}) => {
  const styles = useStyles2(getStyles);
  const [lostFocusOnce, setLostFocusOnce] = useState(false);

  const hiddenGroupKeyFields = useMemo(
    () => [...nonGroupableFields, ...parentGroupKeys],
    [nonGroupableFields, parentGroupKeys]
  );

  // This is a state of the button, so don't use `isGroupDisabled` here.
  const disabled = value.disabled;
  const error = lostFocusOnce && !value.groupKey.trim();

  return (
    <InlineFieldRow style={{ flexWrap: 'nowrap' }}>
      <div className={styles.dragHandle} {...dragHandleProps}>
        <Icon name="draggabledots" size="lg" />
      </div>
      <InlineField
        shrink={true}
        grow={true}
        invalid={error}
        onBlur={() => setLostFocusOnce(true)}
        title="Group key"
      >
        <FieldCombobox
          options={fieldOptions}
          hiddenValues={hiddenGroupKeyFields}
          value={value.groupKey}
          onChange={(key) => onChange({ ...value, groupKey: key.trim() })}
          autoFocus={true}
          onBlur={() => setLostFocusOnce(true)}
        />
      </InlineField>
      <InlineField>
        <Button
          variant={disabled ? 'destructive' : 'secondary'}
          icon={disabled ? 'eye-slash' : 'eye'}
          aria-label={disabled ? 'Enable Group' : 'Disable Group'}
          title={disabled ? 'Enable Group' : 'Disable Group'}
          onClick={() => onChange({ ...value, disabled: !value.disabled })}
        />
      </InlineField>
      <InlineField>
        <Toggletip
          content={
            <GroupSettings
              value={value}
              nonGroupableFields={nonGroupableFields}
              parentGroupKeys={parentGroupKeys}
              fieldOptions={fieldOptions}
              allFrames={allFrames}
              onChange={onChange}
            />
          }
          placement="left"
          closeButton={true}
          fitContent={true}
        >
          <Button variant="secondary" icon="cog" aria-label="Settings" title="Settings" />
        </Toggletip>
      </InlineField>
      <InlineField>
        <Button
          variant="secondary"
          icon="trash-alt"
          aria-label="Delete Group"
          title="Delete Group"
          onClick={onDelete}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
