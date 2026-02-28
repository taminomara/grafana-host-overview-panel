import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Combobox, ComboboxOption, Input, useStyles2 } from '@grafana/ui';
import { HostViewerOptions, SortMode } from '../../types';
import { parseCustomSortPattern } from '../../library/groupFrames';

export const SORT_MODE_OPTIONS: Array<ComboboxOption<SortMode>> = [
  {
    label: 'Disabled',
    value: SortMode.Disabled,
    description: 'Disable sorting and use order returned by data source',
  },
  {
    label: 'Default',
    value: SortMode.Default,
    description: 'Type-aware: numeric for numbers, lexicographic for strings',
  },
  { label: 'Lexicographic', value: SortMode.Lexicographic },
  { label: 'Lexicographic (case-insensitive)', value: SortMode.LexicographicInsensitive },
  { label: 'Numeric', value: SortMode.Numeric },
  { label: 'Custom', value: SortMode.Custom, description: 'Sort by regex capture groups' },
];

interface SortModeComboboxProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

export const SortModeCombobox: React.FC<SortModeComboboxProps> = ({ value, onChange }) => {
  return (
    <Combobox
      options={SORT_MODE_OPTIONS}
      value={value}
      onChange={(selected) => onChange(selected.value)}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(0.5),
  }),
});

interface SortPatternInputProps {
  value: string;
  onChange: (pattern: string) => void;
}

export const SortPatternInput: React.FC<SortPatternInputProps> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);
  const [error, setError] = useState<string | undefined>();

  const validate = useCallback((pattern: string) => {
    if (!pattern) {
      setError(undefined);
      return;
    }
    try {
      parseCustomSortPattern(pattern);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <>
      <Input
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={(e) => validate(e.currentTarget.value)}
        placeholder="e.g. rack-(?<n1>\d+)-shelf-(?<n2>\d+)"
      />
      {error && <div className={styles.error}>{error}</div>}
    </>
  );
};

export const SortModeEditor = ({
  value,
  onChange,
}: StandardEditorProps<SortMode, unknown, HostViewerOptions>) => {
  return <SortModeCombobox value={value ?? SortMode.Default} onChange={onChange} />;
};

export const SortPatternEditor = ({
  value,
  onChange,
}: StandardEditorProps<string, unknown, HostViewerOptions>) => {
  return <SortPatternInput value={value ?? ''} onChange={onChange} />;
};
