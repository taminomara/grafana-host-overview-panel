import { DataFrame, Field, InterpolateFunction } from '@grafana/data';
import { IndexedFrame, indexFrame } from './dataFrame';
import { Join } from '../types';

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
    if (!join.sourceFrame) {
      continue;
    }
    const secondaryFrame = allFrames.find((f) => f.refId === join.sourceFrame);
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
  sourceField: Field;
}

/**
 * Resolves a list of Join configs against a primary frame row, returning one
 * ResolvedJoinSection per join that has a valid sourceField. Sections where no
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
    if (!index || !joinConfig.sourceField) {
      return [];
    }
    const matchedRows = lookupJoinedRows(index, frame, rowIndex, replaceVariables, allData) ?? [];
    const sourceField = index.frame.fieldByName.get(joinConfig.sourceField);
    if (!sourceField) {
      return [];
    }
    return [{ joinConfig, index, matchedRows, sourceField }];
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
      ? primaryFrame.fieldByName.get(index.config.sourceField)
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
