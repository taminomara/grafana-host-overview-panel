import {
  DataFrame,
  DataFrameWithValue,
  Field,
  FieldType,
  getActiveThreshold,
  InterpolateFunction,
  ThresholdsMode,
} from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { useMemo } from 'react';
import { useHostViewerPanelContext } from '../components/PanelContext';
import { DisplayEntry } from '../types';
import { IndexedFrame } from './dataFrame';
import { JoinIndex, resolveJoinSections } from './joinFrames';

export function getCriticalityScore(field: Field, rawValue: unknown): [number, string | undefined] {
  if (!field.display) {
    return [0, undefined];
  }
  let value: number | null | undefined =
    field.type === FieldType.frame
      ? (rawValue as DataFrameWithValue).value
      : typeof rawValue === 'number'
        ? rawValue
        : undefined;
  if (value === undefined || value === null) {
    return [0, undefined];
  }
  const steps = field.config.thresholds?.steps ?? [];
  if (steps.length === 0) {
    return [0, undefined];
  }
  if (field.config.thresholds?.mode === ThresholdsMode.Percentage) {
    value = field.display(value).percent;
    if (value === undefined) {
      return [0, undefined];
    }
    value *= 100;
  }
  const threshold = getActiveThreshold(value, steps);
  const score = (steps.indexOf(threshold) ?? 0) / steps.length;
  return [score, threshold.color];
}

export function getMostCriticalColor(
  entries: DisplayEntry[],
  frame: IndexedFrame,
  rowIndex: number,
  joinIndices: Map<string, JoinIndex>,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[]
): string | undefined {
  let bestScore = 0;
  let bestColor: string | undefined;

  for (const entry of entries) {
    if (!entry.overridesBorderColor) {
      continue;
    }
    if (entry.type === 'field') {
      const field = frame.fieldByName.get(entry.field);
      if (!field) {
        continue;
      }
      const [score, color] = getCriticalityScore(field, field.values[rowIndex]);
      if (score > bestScore && color) {
        bestScore = score;
        bestColor = color;
      }
    } else {
      const sections = resolveJoinSections(
        [entry],
        frame,
        rowIndex,
        joinIndices,
        replaceVariables,
        allData
      );
      for (const section of sections) {
        for (const joinedRow of section.matchedRows) {
          const [score, color] = getCriticalityScore(
            section.sourceField,
            section.sourceField.values[joinedRow]
          );
          if (score > bestScore && color) {
            bestScore = score;
            bestColor = color;
          }
        }
      }
    }
  }

  return bestColor;
}

export function useOverrideColor(
  entries: DisplayEntry[],
  frame: IndexedFrame,
  rowIndex: number
): string | undefined {
  const context = useHostViewerPanelContext();
  const theme = useTheme2();
  return useMemo(() => {
    const colorEntries = entries.filter((e) => e.overridesBorderColor);
    if (colorEntries.length === 0) {
      return undefined;
    }
    const color = getMostCriticalColor(
      colorEntries,
      frame,
      rowIndex,
      context.joinIndices,
      context.replaceVariables,
      context.data
    );
    return color ? theme.visualization.getColorByName(color) : undefined;
  }, [entries, frame, rowIndex, context, theme]);
}
