import { FieldType } from '@grafana/data';
import { indexFrame } from './dataFrame';
import { makeField, makeFrame } from './testHelpers';

describe('indexFrame', () => {
  it('builds fieldByName map from frame fields', () => {
    const nameField = makeField('name', FieldType.string, ['a', 'b']);
    const valueField = makeField('value', FieldType.number, [1, 2]);
    const frame = makeFrame([nameField, valueField]);

    const indexed = indexFrame(frame);

    expect(indexed.fieldByName.get('name')).toBe(indexed.fields[0]);
    expect(indexed.fieldByName.get('value')).toBe(indexed.fields[1]);
    expect(indexed.fieldByName.size).toBe(2);
  });

  it('handles frames with no fields', () => {
    const frame = makeFrame([]);
    const indexed = indexFrame(frame);

    expect(indexed.fieldByName.size).toBe(0);
    expect(indexed.length).toBe(0);
  });

  it('last field wins when names are duplicated', () => {
    const first = makeField('x', FieldType.string, ['a']);
    const second = makeField('x', FieldType.number, [1]);
    const frame = makeFrame([first, second]);

    const indexed = indexFrame(frame);

    expect(indexed.fieldByName.get('x')).toBe(indexed.fields[1]);
    expect(indexed.fieldByName.size).toBe(1);
  });

  it('preserves all original DataFrame properties', () => {
    const frame = makeFrame([makeField('a', FieldType.string, ['x'])], 'refA');
    const indexed = indexFrame(frame);

    expect(indexed.refId).toBe('refA');
    expect(indexed.length).toBe(1);
    expect(indexed.fields).toHaveLength(1);
  });
});
