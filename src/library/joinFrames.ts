import { DataFrame, Field, InterpolateFunction } from '@grafana/data';
import { IndexedFrame, indexFrame } from './dataFrame';
import { HostViewerOptions, Join } from '../types';

export const KEY_SEPARATOR = '\0';

export interface JoinIndex {
  config: Join;
  frame: IndexedFrame;
  getKeyMap: () => Map<string, number[]>;
}

function createLazyKeyMap(
  frame: IndexedFrame,
  config: Join
): () => Map<string, number[]> {
  let cached: Map<string, number[]> | null = null;
  return () => {
    if (cached) {
      return cached;
    }

    const map = new Map<string, number[]>();
    const fields = config.keys.map((key) => frame.fieldByName.get(key.foreignField));

    for (let i = 0; i < frame.length; i++) {
      const parts: string[] = [];
      for (const field of fields) {
        parts.push(String(field?.values[i] ?? ''));
      }
      const compositeKey = parts.join(KEY_SEPARATOR);
      let indices = map.get(compositeKey);
      if (!indices) {
        indices = [];
        map.set(compositeKey, indices);
      }
      indices.push(i);
    }

    cached = map;
    return map;
  };
}

export function buildJoinIndices(allFrames: DataFrame[], joins: Join[]): JoinIndex[] {
  const result: JoinIndex[] = [];

  for (const join of joins) {
    if (!join.foreignFrame) {
      continue;
    }
    const secondaryFrame = allFrames.find((f) => f.refId === join.foreignFrame);
    if (!secondaryFrame) {
      continue;
    }
    const indexed = indexFrame(secondaryFrame);
    const foreignFields = join.keys.map((k) => k.foreignField);
    if (foreignFields.some((name) => !indexed.fieldByName.has(name))) {
      continue;
    }

    result.push({
      config: join,
      frame: indexed,
      getKeyMap: createLazyKeyMap(indexed, join),
    });
  }

  return result;
}

export interface ResolvedJoinSection {
  joinConfig: Join;
  index: JoinIndex;
  /** Row indices in index.frame that matched. Empty array means no match. */
  matchedRows: number[];
  foreignField: Field;
}

/**
 * Resolves a list of Join configs against a primary frame row, returning one
 * ResolvedJoinSection per join that has a valid foreignField. Sections where no
 * rows matched are included with matchedRows = []; callers can filter them out
 * if they don't want to show placeholders.
 */
export function resolveJoinSections(
  joins: Join[],
  frame: IndexedFrame,
  rowIndex: number,
  joinIndices: Map<string, JoinIndex>,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[]
): ResolvedJoinSection[] {
  return joins.flatMap((joinConfig) => {
    const index = joinIndices.get(joinConfig.id);
    if (!index || !joinConfig.foreignField) {
      return [];
    }
    const matchedRows = lookupJoinedRows(index, frame, rowIndex, replaceVariables, allData) ?? [];
    const foreignField = index.frame.fieldByName.get(joinConfig.foreignField);
    if (!foreignField) {
      return [];
    }
    return [{ joinConfig, index, matchedRows, foreignField }];
  });
}

export function lookupJoinedRows(
  index: JoinIndex,
  primaryFrame: IndexedFrame,
  rowIndex: number,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[]
): number[] | undefined {
  const parts: string[] = [];

  for (const pair of index.config.keys) {
    const isTemplate = pair.primaryKey === '__template__';
    const field = isTemplate
      ? primaryFrame.fieldByName.get(index.config.foreignField)
      : primaryFrame.fieldByName.get(pair.primaryKey);
    if (!field && !isTemplate) {
      parts.push('');
    } else if (isTemplate) {
      parts.push(
        replaceVariables(pair.primaryKeyTemplate, {
          __dataContext: {
            value: {
              data: allData,
              frame: primaryFrame,
              field: field!,
              rowIndex,
            },
          },
        })
      );
    } else {
      parts.push(String(field!.values[rowIndex]));
    }
  }

  const compositeKey = parts.join(KEY_SEPARATOR);
  return index.getKeyMap().get(compositeKey);
}

export interface ResolvedStatusField {
  field: Field;
  frame: IndexedFrame;
  rowIndex: number;
}

/**
 * Resolves the status field for a primary row. When `statusField` is
 * `'__join__'`, looks up the value via `statusJoin`; otherwise resolves the
 * named field directly from the primary frame.
 */
export function resolveStatusField(
  options: HostViewerOptions,
  frame: IndexedFrame,
  rowIndex: number,
  joinIndices: Map<string, JoinIndex>,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[]
): ResolvedStatusField | undefined {
  if (options.statusField === '__join__') {
    return options.statusJoin
      ? resolveStatusFromJoin(options.statusJoin, frame, rowIndex, joinIndices, replaceVariables, allData)
      : undefined;
  }
  const field = frame.fieldByName.get(options.statusField);
  return field ? { field, frame, rowIndex } : undefined;
}

/**
 * Resolves a status field from a join. Returns the foreign field and the first
 * matched row, or undefined if the join cannot be resolved.
 */
export function resolveStatusFromJoin(
  statusJoin: Join,
  frame: IndexedFrame,
  rowIndex: number,
  joinIndices: Map<string, JoinIndex>,
  replaceVariables: InterpolateFunction,
  allData: DataFrame[]
): ResolvedStatusField | undefined {
  const index = joinIndices.get(statusJoin.id);
  if (!index || !statusJoin.foreignField) {
    return undefined;
  }

  const matchedRows = lookupJoinedRows(index, frame, rowIndex, replaceVariables, allData);
  if (!matchedRows || matchedRows.length === 0) {
    return undefined;
  }

  const foreignField = index.frame.fieldByName.get(statusJoin.foreignField);
  if (!foreignField) {
    return undefined;
  }

  return { field: foreignField, frame: index.frame, rowIndex: matchedRows[0] };
}
