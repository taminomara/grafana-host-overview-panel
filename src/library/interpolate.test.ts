import { FieldType } from '@grafana/data';
import { indexFrame } from './dataFrame';
import { interpolateWithDataContext } from './interpolate';
import { makeField, makeFrame } from './testHelpers';

describe('interpolateWithDataContext', () => {
  it('calls replaceVariables with correct __dataContext and returns its result', () => {
    const frame = indexFrame(makeFrame([makeField('host', FieldType.string, ['h1', 'h2'])]));
    const field = frame.fields[0];
    const data = [frame];

    const replaceVariables = jest.fn(() => 'interpolated-result');

    const result = interpolateWithDataContext(
      replaceVariables,
      '${__data.fields.host}',
      data,
      frame,
      field,
      1
    );

    expect(result).toBe('interpolated-result');
    expect(replaceVariables).toHaveBeenCalledTimes(1);
    expect(replaceVariables).toHaveBeenCalledWith('${__data.fields.host}', {
      __dataContext: {
        value: {
          data,
          frame,
          field,
          rowIndex: 1,
        },
      },
    });
  });
});
