import React, { useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { HostViewerOptions } from 'types';
import { findFrame } from '../../library/dataFrame';
import { FieldCombobox } from './FieldCombobox';

export const ValueFieldEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, any, HostViewerOptions>) => {
  const additionalOptions = item.settings?.additionalOptions;

  const fieldOptions = useMemo(() => {
    const frame = findFrame(context.data ?? [], context.options?.dataFrame);
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
  }, [context.data, context.options?.dataFrame, additionalOptions]);

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
