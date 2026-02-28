import React, { useCallback } from 'react';
import { Combobox, ComboboxOption } from '@grafana/ui';

interface FieldComboboxBaseProps {
  options: Array<ComboboxOption<string>>;
  hiddenValues?: string[];
  value: string | null;
  autoFocus?: boolean;
  placeholder?: string;
  onBlur?: () => void;
}

interface ClearableFieldComboboxProps extends FieldComboboxBaseProps {
  isClearable: true;
  onChange: (value: string | null) => void;
}

interface NotClearableFieldComboboxProps extends FieldComboboxBaseProps {
  isClearable?: false;
  onChange: (value: string) => void;
}

type FieldComboboxProps = ClearableFieldComboboxProps | NotClearableFieldComboboxProps;

export const FieldCombobox: React.FC<FieldComboboxProps> = (props) => {
  const {
    options,
    hiddenValues,
    value,
    autoFocus,
    placeholder = 'Select a field',
    onBlur,
    isClearable,
    onChange,
  } = props;

  const getOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      if (!hiddenValues || hiddenValues.length === 0) {
        return options;
      }

      const hiddenSet = new Set(hiddenValues);
      const query = inputValue.toLowerCase();

      return options.filter((option) => {
        if (query) {
          return option.label!.toLowerCase().includes(query);
        }
        return !hiddenSet.has(option.value);
      });
    },
    [options, hiddenValues]
  );

  if (isClearable) {
    return (
      <Combobox
        options={getOptions}
        value={value}
        onChange={(option) => onChange(option?.value ?? null)}
        isClearable={true}
        autoFocus={autoFocus}
        createCustomValue={true}
        placeholder={placeholder}
        onBlur={onBlur}
      />
    );
  }

  return (
    <Combobox
      options={getOptions}
      value={value}
      onChange={(option) => (onChange as (value: string) => void)(option.value)}
      autoFocus={autoFocus}
      createCustomValue={true}
      placeholder={placeholder}
      onBlur={onBlur}
    />
  );
};
