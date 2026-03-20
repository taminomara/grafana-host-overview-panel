import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { DataFrame, getFrameDisplayName, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import {
  Button,
  Combobox,
  ComboboxOption,
  Field,
  InlineField,
  InlineFieldRow,
  useStyles2,
} from '@grafana/ui';
import { HostViewerOptions, Join, JoinKeyPair } from '../../types';
import { findFrame } from '../../library/dataFrame';
import { FieldCombobox } from './FieldCombobox';
import { TemplatePatternInput } from './TemplatePatternEditor';

const getStyles = (theme: GrafanaTheme2) => ({
  keyPairRow: css({
    alignItems: 'center',
  }),
  arrow: css({
    color: theme.colors.text.secondary,
    userSelect: 'none',
  }),
  groupedBody: css({
    padding: theme.spacing(1, 0, 1, 2),
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: theme.colors.border.weak,
  }),
});

interface JoinEditorProps<T extends Join = Join> {
  value: T;
  onChange: (join: T) => void;
  allFrames: DataFrame[];
  primaryFieldOptions: Array<ComboboxOption<string>>;
  hiddenKeyFields?: string[];
  children?: React.ReactNode;
}

export function JoinEditor<T extends Join = Join>({
  value,
  onChange,
  allFrames,
  primaryFieldOptions,
  hiddenKeyFields,
  children,
}: JoinEditorProps<T>) {
  const frameOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      allFrames.map((frame) => {
        const name = getFrameDisplayName(frame);
        return {
          label: name,
          value: frame.refId ?? name,
          description: frame.refId,
        };
      }),
    [allFrames]
  );

  const foreignFrame = useMemo(
    () => allFrames.find((f) => f.refId === value.foreignFrame),
    [allFrames, value.foreignFrame]
  );

  const foreignFieldOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      foreignFrame
        ? foreignFrame.fields.map((f) => ({ label: f.name, value: f.name, description: f.type }))
        : [],
    [foreignFrame]
  );

  const handleChange = (updates: Partial<Join>) => {
    onChange({ ...value, ...updates } as T);
  };

  return (
    <>
      <Field label="Foreign Frame">
        <Combobox
          options={frameOptions}
          value={value.foreignFrame || null}
          onChange={(option) => handleChange({ foreignFrame: option?.value ?? '' })}
          isClearable={true}
          placeholder="Select a frame"
        />
      </Field>
      <Field label="Foreign Field" description="Field from the foreign frame">
        <FieldCombobox
          options={foreignFieldOptions}
          value={value.foreignField || null}
          onChange={(v) => handleChange({ foreignField: v ?? '' })}
          isClearable={true}
          placeholder="Select a field"
        />
      </Field>
      <Field label="Keys" description="How to match rows between frames">
        <>
          {value.keys.map((pair, i) => (
            <JoinKeyPairRow
              key={i}
              value={pair}
              primaryFieldOptions={primaryFieldOptions}
              foreignFieldOptions={foreignFieldOptions}
              hiddenKeyFields={hiddenKeyFields}
              hiddenForeignFields={value.keys
                .filter((_, j) => j !== i)
                .map((k) => k.foreignField)
                .filter(Boolean)}
              onChange={(updated) =>
                handleChange({ keys: value.keys.map((k, j) => (j === i ? updated : k)) })
              }
              onDelete={() => handleChange({ keys: value.keys.filter((_, j) => j !== i) })}
            />
          ))}
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() =>
              handleChange({
                keys: [
                  ...value.keys,
                  { primaryKey: '', foreignField: '', primaryKeyTemplate: '' },
                ],
              })
            }
          >
            Add key
          </Button>
        </>
      </Field>
      {children}
    </>
  );
}

export interface JoinKeyPairRowProps {
  value: JoinKeyPair;
  primaryFieldOptions: Array<ComboboxOption<string>>;
  foreignFieldOptions: Array<ComboboxOption<string>>;
  hiddenKeyFields?: string[];
  hiddenForeignFields?: string[];
  onChange: (pair: JoinKeyPair) => void;
  onDelete: () => void;
}

export const JoinKeyPairRow: React.FC<JoinKeyPairRowProps> = ({
  value,
  primaryFieldOptions,
  foreignFieldOptions,
  hiddenKeyFields,
  hiddenForeignFields,
  onChange,
  onDelete,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <InlineFieldRow style={{ flexWrap: 'nowrap' }} className={styles.keyPairRow}>
        <InlineField title="Foreign field" grow={true} shrink={true}>
          <FieldCombobox
            options={foreignFieldOptions}
            hiddenValues={hiddenForeignFields}
            value={value.foreignField || null}
            onChange={(v) => onChange({ ...value, foreignField: v ?? '' })}
            isClearable={true}
            placeholder="Foreign field"
          />
        </InlineField>
        <InlineField>
          <span className={styles.arrow}>=</span>
        </InlineField>
        <InlineField title="Value" grow={true} shrink={true}>
          <FieldCombobox
            options={[{ value: '__template__', label: 'Use template' }, ...primaryFieldOptions]}
            hiddenValues={hiddenKeyFields}
            value={value.primaryKey || null}
            onChange={(v) => onChange({ ...value, primaryKey: v ?? '' })}
            isClearable={true}
            placeholder="Value"
          />
        </InlineField>
        <InlineField>
          <Button
            variant="secondary"
            icon="trash-alt"
            aria-label="Delete key pair"
            title="Delete key pair"
            onClick={onDelete}
          />
        </InlineField>
      </InlineFieldRow>
      {value.primaryKey === '__template__' ? (
        <InlineFieldRow style={{ flexWrap: 'nowrap' }} className={styles.keyPairRow}>
          <InlineField grow={true}>
            <TemplatePatternInput
              value={value.primaryKeyTemplate}
              onChange={(v) => onChange({ ...value, primaryKeyTemplate: v })}
              placeholder="e.g. ${__data.fields.id}"
            />
          </InlineField>
        </InlineFieldRow>
      ) : null}
    </>
  );
};

interface KnownIdsJoinEditorProps {
  value: Join;
  onChange: (join: Join) => void;
  allFrames: DataFrame[];
  primaryFieldOptions: Array<ComboboxOption<string>>;
  hiddenKeyFields?: string[];
}

export const KnownIdsJoinEditor: React.FC<KnownIdsJoinEditorProps> = ({
  value,
  onChange,
  allFrames,
  primaryFieldOptions,
  hiddenKeyFields,
}) => {
  return (
    <JoinEditor
      value={value}
      onChange={onChange}
      allFrames={allFrames}
      primaryFieldOptions={primaryFieldOptions}
      hiddenKeyFields={hiddenKeyFields}
    />
  );
};

export const KnownIdsJoinEditorWrapper = ({
  value,
  onChange,
  context,
}: StandardEditorProps<Join, unknown, HostViewerOptions>) => {
  const styles = useStyles2(getStyles);
  const allFrames = context.data ?? [];
  const primaryFrame = findFrame(allFrames, context.options?.dataFrame);

  const primaryFieldOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      primaryFrame
        ? primaryFrame.fields.map((f) => ({ label: f.name, value: f.name, description: f.type }))
        : [],
    [primaryFrame]
  );

  const hiddenKeyFields = useMemo(() => {
    const activeGroupKeys = new Set(
      (context.options?.groups ?? [])
        .filter((g) => !g.disabled && g.groupKey)
        .map((g) => g.groupKey)
    );
    return primaryFieldOptions.filter((o) => !activeGroupKeys.has(o.value)).map((o) => o.value);
  }, [primaryFieldOptions, context.options?.groups]);

  return (
    <div className={styles.groupedBody}>
      <KnownIdsJoinEditor
        value={value}
        onChange={onChange}
        allFrames={allFrames}
        primaryFieldOptions={primaryFieldOptions}
        hiddenKeyFields={hiddenKeyFields}
      />
    </div>
  );
};

export const StatusJoinEditorWrapper = ({
  value,
  onChange,
  context,
}: StandardEditorProps<Join, unknown, HostViewerOptions>) => {
  const styles = useStyles2(getStyles);
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
    <div className={styles.groupedBody}>
      <JoinEditor
        value={value}
        onChange={onChange}
        allFrames={allFrames}
        primaryFieldOptions={primaryFieldOptions}
      />
    </div>
  );
};
