import { DataFrame, Field, InterpolateFunction } from '@grafana/data';
import { IndexedFrame } from './dataFrame';

/**
 * Calls replaceVariables with a __dataContext scoped variable populated from
 * the given frame row. This is the standard way to interpolate template
 * variables that reference field values (e.g. data link URLs, title patterns).
 */
export function interpolateWithDataContext(
  replaceVariables: InterpolateFunction,
  pattern: string,
  data: DataFrame[],
  frame: IndexedFrame,
  field: Field,
  rowIndex: number
): string {
  return replaceVariables(pattern, {
    __dataContext: {
      value: {
        data,
        frame,
        field,
        rowIndex,
      },
    },
  });
}
