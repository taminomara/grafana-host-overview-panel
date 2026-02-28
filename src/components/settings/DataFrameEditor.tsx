import React, { useMemo } from 'react';
import { getFrameDisplayName, StandardEditorProps } from '@grafana/data';
import { Combobox, ComboboxOption } from '@grafana/ui';
import { HostViewerOptions } from '../../types';

export const DataFrameEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<string, unknown, HostViewerOptions>) => {
  const options = useMemo<Array<ComboboxOption<string>>>(() => {
    if (!context.data || context.data.length === 0) {
      return [];
    }
    return context.data.map((frame) => {
      const name = getFrameDisplayName(frame);
      return { label: name, value: frame.refId ?? name, description: frame.refId };
    });
  }, [context.data]);

  const invalid = !!value && !options.some((o) => o.value === value);

  return (
    <Combobox
      options={options}
      value={value || null}
      onChange={(option) => onChange(option?.value ?? '')}
      isClearable={true}
      invalid={invalid}
      placeholder="First data frame"
    />
  );
};
