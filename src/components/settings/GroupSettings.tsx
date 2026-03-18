import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { ComboboxOption, Field, Input, Switch, useStyles2 } from '@grafana/ui';
import { GridType, Group, SortMode } from 'types';
import { ClearableColorPicker } from './ClearableColorPicker';
import { DisplayEntriesEditor } from './DisplayEntriesEditor';
import { KnownIdsJoinEditor } from './JoinEditor';
import { FieldCombobox } from './FieldCombobox';
import { GridTypePicker } from './GridTypePicker';
import { SortModeCombobox, SortPatternInput } from './SortEditor';
import { TemplatePatternInput } from './TemplatePatternEditor';

interface GroupSettingsProps {
  value: Group;
  nonGroupableFields: string[];
  parentGroupKeys: string[];
  fieldOptions: Array<ComboboxOption<string>>;
  allFrames: DataFrame[];
  onChange: (group: Group) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  popup: css({
    width: 400,
    maxHeight: 'calc(100vh - 20px)',
    overflowY: 'auto',
    margin: theme.spacing(-3, -2),
    padding: theme.spacing(3, 2),
    scrollbarWidth: 'thin',
  }),
  title: css({
    fontWeight: theme.typography.fontWeightBold,
    marginBottom: theme.spacing(1),
  }),
  hint: css({
    marginTop: theme.spacing(2),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});

export const GroupSettings: React.FC<GroupSettingsProps> = ({
  value,
  nonGroupableFields,
  parentGroupKeys,
  fieldOptions,
  allFrames,
  onChange,
}) => {
  const styles = useStyles2(getStyles);

  const hiddenGroupKeyFields = useMemo(
    () => [...nonGroupableFields, ...parentGroupKeys],
    [nonGroupableFields, parentGroupKeys]
  );

  const hiddenKeyFields = useMemo(() => {
    const parentSet = new Set(parentGroupKeys);
    if (value.groupKey) {
      parentSet.add(value.groupKey);
    }
    return fieldOptions.filter((o) => !parentSet.has(o.value)).map((o) => o.value);
  }, [fieldOptions, parentGroupKeys, value.groupKey]);

  return (
    <div className={styles.popup}>
      <div className={styles.title}>Settings for {value.groupKey || 'New Group'}</div>
      <Field label="Group Key">
        <FieldCombobox
          options={fieldOptions}
          hiddenValues={hiddenGroupKeyFields}
          value={value.groupKey}
          onChange={(key) => onChange({ ...value, groupKey: key.trim() })}
        />
      </Field>
      <Field
        label="Disabled"
        description="Temporarily disable this grouping level"
        horizontal={true}
      >
        <Switch
          value={value.disabled ?? false}
          onChange={(updatedValue) =>
            onChange({ ...value, disabled: updatedValue.currentTarget.checked })
          }
        />
      </Field>
      <Field label="Show Group Title" horizontal={true}>
        <Switch
          value={value.showTitle}
          onChange={(updatedValue) =>
            onChange({ ...value, showTitle: updatedValue.currentTarget.checked })
          }
        />
      </Field>
      {value.showTitle ? (
        <>
          <Field label="Show Field Name in Title" horizontal={true}>
            <Switch
              value={value.showKeyName}
              onChange={(updatedValue) =>
                onChange({ ...value, showKeyName: updatedValue.currentTarget.checked })
              }
            />
          </Field>
          <Field
            label="Title Override"
            description="Override the title using template variables. Leave empty to use the default."
          >
            <TemplatePatternInput
              value={value.titlePattern ?? ''}
              onChange={(newValue) => onChange({ ...value, titlePattern: newValue || undefined })}
            />
          </Field>
        </>
      ) : null}
      <Field label="Sort">
        <SortModeCombobox
          value={value.sortMode}
          onChange={(sortMode) => onChange({ ...value, sortMode })}
        />
      </Field>
      {value.sortMode === SortMode.Custom && (
        <Field
          label="Sort Pattern"
          description="Named groups: n1, sa2, etc. (n=numeric, s=string, i=case-insensitive, a=ascending, d=descending, number=priority)"
        >
          <SortPatternInput
            value={value.sortPattern ?? ''}
            onChange={(sortPattern) => onChange({ ...value, sortPattern })}
          />
        </Field>
      )}
      <Field label="Draw Border" horizontal={true}>
        <Switch
          value={value.drawBorder}
          onChange={(updatedValue) =>
            onChange({ ...value, drawBorder: updatedValue.currentTarget.checked })
          }
        />
      </Field>
      {value.drawBorder && (
        <>
          <Field label="Border Color" horizontal={true}>
            <ClearableColorPicker
              value={value.borderColor}
              onChange={(color) => onChange({ ...value, borderColor: color })}
              placeholder="Override default"
            />
          </Field>
          <Field label="Transparent Background" horizontal={true}>
            <Switch
              value={value.transparentBackground}
              onChange={(updatedValue) =>
                onChange({ ...value, transparentBackground: updatedValue.currentTarget.checked })
              }
            />
          </Field>
        </>
      )}
      <Field label="Layout" description="How to arrange items within this group">
        <GridTypePicker
          value={value.gridType}
          onChange={(gridType) => onChange({ ...value, gridType })}
          size="sm"
        />
      </Field>
      {value.gridType === GridType.Grid && (
        <Field
          label="Grid Columns"
          invalid={
            value.gridColumns !== undefined && Math.floor(value.gridColumns) !== value.gridColumns
          }
        >
          <Input
            value={value.gridColumns}
            onChange={(e) => onChange({ ...value, gridColumns: e.currentTarget.valueAsNumber })}
            type="number"
            min={1}
            step={1}
            defaultValue={2}
          />
        </Field>
      )}
      <Field
        label="Known IDs"
        description="List of IDs that will be shown even if datasource returns no data for them"
      >
        <Input
          value={value.knownIds}
          onChange={(e) => onChange({ ...value, knownIds: e.currentTarget.value })}
          placeholder="id1, id2, ..."
        />
      </Field>
      <KnownIdsJoinEditor
        value={value.knownIdsJoin}
        onChange={(knownIdsJoin) => onChange({ ...value, knownIdsJoin })}
        allFrames={allFrames}
        primaryFieldOptions={fieldOptions}
        hiddenKeyFields={hiddenKeyFields}
      />
      <Field label="Fields and joins" description="Additional data to display for this group">
        <DisplayEntriesEditor
          value={value.entries ?? []}
          onChange={(entries) => onChange({ ...value, entries })}
          allFrames={allFrames}
          primaryFieldOptions={fieldOptions}
          hiddenKeyFields={hiddenKeyFields}
        />
      </Field>
      <div className={styles.hint}>
        To configure links, actions, or value mappings for this group field, add a field override in
        the main settings panel.
      </div>
    </div>
  );
};
