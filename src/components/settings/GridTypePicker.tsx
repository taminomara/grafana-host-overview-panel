import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { GridType } from 'types';

export const GRID_TYPE_OPTIONS = [
  { label: 'Horizontal', value: GridType.Horizontal, icon: 'arrows-h' as const },
  { label: 'Vertical', value: GridType.Vertical, icon: 'arrows-v' as const },
  { label: 'Flow', value: GridType.Flow, icon: 'wrap-text' as const },
  { label: 'Grid', value: GridType.Grid, icon: 'gf-grid' as const },
];

export const GridTypePicker: React.FC<{
  value: GridType;
  onChange: (value: GridType) => void;
  size?: 'sm' | 'md';
}> = ({ value, onChange, size = 'md' }) => {
  return (
    <RadioButtonGroup options={GRID_TYPE_OPTIONS} value={value} onChange={onChange} size={size} />
  );
};
