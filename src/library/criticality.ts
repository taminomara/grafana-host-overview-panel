import {
  DataFrame,
  DataFrameWithValue,
  Field,
  FieldType,
  getActiveThreshold,
  InterpolateFunction,
  Threshold,
  ThresholdsMode,
} from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { useMemo } from 'react';
import { useHostViewerPanelContext } from '../components/PanelContext';
import { DisplayEntry, SeverityOverride } from '../types';
import { IndexedFrame } from './dataFrame';
import { JoinIndex, resolveJoinSections } from './joinFrames';

const GREEN_COLORS = new Set([
  'green',
  'semi-dark-green',
  'dark-green',
  'light-green',
  'super-light-green',
]);

export type ResolveColor = (color: string) => string;

export function buildSeverityMap(
  overrides: SeverityOverride[] | undefined,
  resolveColor: ResolveColor
): Map<string, number> | undefined {
  if (!overrides || overrides.length === 0) {
    return undefined;
  }
  const map = new Map<string, number>();
  for (const ov of overrides) {
    map.set(resolveColor(ov.color), ov.severity);
  }
  return map;
}

function findSeverityZeroIndex(
  steps: Threshold[],
  severityMap: Map<string, number> | undefined,
  resolveColor: ResolveColor
): number {
  if (severityMap) {
    for (let i = 0; i < steps.length; i++) {
      const sev = severityMap.get(resolveColor(steps[i].color));
      if (sev !== undefined && sev === 0) {
        return i;
      }
    }
  }
  for (let i = 0; i < steps.length; i++) {
    if (GREEN_COLORS.has(steps[i].color)) {
      return i;
    }
  }
  return 0;
}

export function getCriticalityScore(
  field: Field,
  rawValue: unknown,
  severityMap?: Map<string, number>,
  resolveColor: ResolveColor = (c) => c
): [number, string | undefined] {
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
  const i = steps.indexOf(threshold);

  if (severityMap) {
    const sev = severityMap.get(resolveColor(threshold.color));
    if (sev !== undefined) {
      return [sev, threshold.color];
    }
  }

  if (steps.length <= 1) {
    return [0, threshold.color];
  }

  const l = findSeverityZeroIndex(steps, severityMap, resolveColor);
  const maxDist = Math.max(l, steps.length - 1 - l);
  const score = maxDist === 0 ? 0 : Math.abs(l - i) / maxDist;
  return [score, threshold.color];
}

export function getMostCriticalColor(
  entries: DisplayEntry[],
  frame: IndexedFrame,
  rowIndex: number,
  joinIndices: Map<string, JoinIndex>,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[],
  resolveColor: ResolveColor = (c) => c
): string | undefined {
  let bestScore = 0;
  let bestColor: string | undefined;

  for (const entry of entries) {
    if (entry.type === 'heading') {
      continue;
    }
    if (!entry.overridesBorderColor) {
      continue;
    }
    const severityMap = buildSeverityMap(entry.severityOverrides, resolveColor);
    if (entry.type === 'field') {
      const field = frame.fieldByName.get(entry.field);
      if (!field) {
        continue;
      }
      const [score, color] = getCriticalityScore(
        field,
        field.values[rowIndex],
        severityMap,
        resolveColor
      );
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
            section.sourceField.values[joinedRow],
            severityMap,
            resolveColor
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
    const colorEntries = entries.filter((e) => e.type !== 'heading' && e.overridesBorderColor);
    if (colorEntries.length === 0) {
      return undefined;
    }
    const color = getMostCriticalColor(
      colorEntries,
      frame,
      rowIndex,
      context.joinIndices,
      context.replaceVariables,
      context.data,
      theme.visualization.getColorByName
    );
    return color ? theme.visualization.getColorByName(color) : undefined;
  }, [entries, frame, rowIndex, context, theme]);
}
