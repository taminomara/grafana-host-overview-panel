import React, { useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { HostViewerOptions } from 'types';
import { FieldCombobox } from './FieldCombobox';

export const ValueFieldEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, any, HostViewerOptions>) => {
  const additionalOptions = item.settings?.additionalOptions;

  const fieldOptions = useMemo(() => {
    const frame = context.data?.[0];
    if (!frame) {
      return [];
    }
    return [
      ...(additionalOptions ?? []),
      ...frame.fields.map((field) => ({
        label: field.name,
        value: field.name,
        description: field.type,
      })),
    ];
  }, [context.data, additionalOptions]);

  const hiddenValues = useMemo(
    () => (context.options?.groups ?? []).map((g) => g.groupKey),
    [context.options?.groups]
  );

  return (
    <FieldCombobox
      options={fieldOptions}
      hiddenValues={hiddenValues}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
      isClearable={true}
      placeholder={item.settings?.placeholder}
    />
  );
};
