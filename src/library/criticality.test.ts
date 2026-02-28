import { Field, FieldType, ThresholdsMode } from '@grafana/data';
import { getCriticalityScore, getMostCriticalColor } from './criticality';
import { indexFrame } from './dataFrame';
import { buildJoinIndices, JoinIndex } from './joinFrames';
import { makeField, makeFrame } from './testHelpers';
import { DisplayEntry, FieldDisplayEntry, JoinDisplayEntry } from '../types';

function makeThresholdField(
  name: string,
  values: number[],
  steps: Array<{ value: number; color: string }>,
  mode: ThresholdsMode = ThresholdsMode.Absolute
): Field {
  return {
    name,
    type: FieldType.number,
    values,
    config: {
      thresholds: { mode, steps },
    },
    display: (v: unknown) => ({
      numeric: v as number,
      text: String(v),
      percent: (v as number) / 100,
    }),
  };
}

// -- getCriticalityScore ------------------------------------------------------

describe('getCriticalityScore', () => {
  it('returns [0, undefined] when field.display is missing', () => {
    const field = makeField('x', FieldType.number, [42]);
    expect(getCriticalityScore(field, 42)).toEqual([0, undefined]);
  });

  it('returns [0, undefined] for non-numeric value', () => {
    const field = makeThresholdField('x', [], [{ value: 0, color: 'green' }]);
    expect(getCriticalityScore(field, 'text')).toEqual([0, undefined]);
  });

  it('returns [0, undefined] for null value', () => {
    const field = makeThresholdField('x', [], [{ value: 0, color: 'green' }]);
    expect(getCriticalityScore(field, null)).toEqual([0, undefined]);
  });

  it('returns [0, undefined] for undefined value', () => {
    const field = makeThresholdField('x', [], [{ value: 0, color: 'green' }]);
    expect(getCriticalityScore(field, undefined)).toEqual([0, undefined]);
  });

  it('returns [0, undefined] when no threshold steps configured', () => {
    const field: Field = {
      name: 'x',
      type: FieldType.number,
      values: [42],
      config: { thresholds: { mode: ThresholdsMode.Absolute, steps: [] } },
      display: (v: unknown) => ({ numeric: v as number, text: String(v) }),
    };
    expect(getCriticalityScore(field, 42)).toEqual([0, undefined]);
  });

  it('returns correct score and color for absolute thresholds', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const field = makeThresholdField('cpu', [10, 60, 90], steps);

    const [score0, color0] = getCriticalityScore(field, 10);
    expect(color0).toBe('green');
    expect(score0).toBeCloseTo(0 / 3);

    const [score1, color1] = getCriticalityScore(field, 60);
    expect(color1).toBe('yellow');
    expect(score1).toBeCloseTo(1 / 3);

    const [score2, color2] = getCriticalityScore(field, 90);
    expect(color2).toBe('red');
    expect(score2).toBeCloseTo(2 / 3);
  });

  it('score is proportional to threshold index', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 25, color: 'yellow' },
      { value: 50, color: 'orange' },
      { value: 75, color: 'red' },
    ];
    const field = makeThresholdField('x', [80], steps);

    const [score, color] = getCriticalityScore(field, 80);
    expect(color).toBe('red');
    expect(score).toBeCloseTo(3 / 4);
  });

  it('handles percentage thresholds', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'red' },
    ];
    const field = makeThresholdField('x', [75], steps, ThresholdsMode.Percentage);

    const [score0, color0] = getCriticalityScore(field, 25);
    expect(color0).toBe('green');
    expect(score0).toBeCloseTo(0 / 2);

    const [score1, color1] = getCriticalityScore(field, 75);
    expect(color1).toBe('red');
    expect(score1).toBeCloseTo(1 / 2);
  });

  it('returns [0, undefined] when percentage display returns undefined percent', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'red' },
    ];
    const field: Field = {
      name: 'x',
      type: FieldType.number,
      values: [42],
      config: { thresholds: { mode: ThresholdsMode.Percentage, steps } },
      display: () => ({ numeric: 42, text: '42', percent: undefined }),
    };

    expect(getCriticalityScore(field, 42)).toEqual([0, undefined]);
  });

  it('handles FieldType.frame by extracting .value from the raw value', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'red' },
    ];
    const field: Field = {
      name: 'spark',
      type: FieldType.frame,
      values: [],
      config: { thresholds: { mode: ThresholdsMode.Absolute, steps } },
      display: (v: unknown) => ({ numeric: v as number, text: String(v) }),
    };

    const frameWithValue = { fields: [], length: 0, value: 75 };
    const [score, color] = getCriticalityScore(field, frameWithValue);
    expect(color).toBe('red');
    expect(score).toBeCloseTo(1 / 2);
  });
});

// -- getMostCriticalColor -----------------------------------------------------

describe('getMostCriticalColor', () => {
  const replaceVariables = jest.fn((v: string) => v);

  it('returns undefined when no entries have overridesBorderColor', () => {
    const frame = indexFrame(makeFrame([makeField('x', FieldType.number, [42])]));
    const entries: DisplayEntry[] = [
      { id: '1', type: 'field', field: 'x', overridesBorderColor: false },
    ];
    const result = getMostCriticalColor(entries, frame, 0, new Map(), replaceVariables, []);
    expect(result).toBeUndefined();
  });

  it('returns undefined when field is missing from frame', () => {
    const frame = indexFrame(makeFrame([makeField('x', FieldType.number, [42])]));
    const entries: DisplayEntry[] = [
      { id: '1', type: 'field', field: 'missing', overridesBorderColor: true },
    ];
    const result = getMostCriticalColor(entries, frame, 0, new Map(), replaceVariables, []);
    expect(result).toBeUndefined();
  });

  it('returns the color of the most critical field entry', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const field = makeThresholdField('cpu', [90], steps);
    const frame = indexFrame(makeFrame([field]));
    const entries: FieldDisplayEntry[] = [
      { id: '1', type: 'field', field: 'cpu', overridesBorderColor: true },
    ];

    const result = getMostCriticalColor(entries, frame, 0, new Map(), replaceVariables, []);
    expect(result).toBe('red');
  });

  it('picks the highest-scoring color among multiple field entries', () => {
    const lowSteps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const highSteps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const lowField = makeThresholdField('mem', [60], lowSteps);
    const highField = makeThresholdField('cpu', [90], highSteps);
    const frame = indexFrame(makeFrame([lowField, highField]));
    const entries: FieldDisplayEntry[] = [
      { id: '1', type: 'field', field: 'mem', overridesBorderColor: true },
      { id: '2', type: 'field', field: 'cpu', overridesBorderColor: true },
    ];

    const result = getMostCriticalColor(entries, frame, 0, new Map(), replaceVariables, []);
    expect(result).toBe('red');
  });

  it('returns the color of the most critical join entry', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 80, color: 'red' },
    ];
    const primaryFrame = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));
    const secondaryFrame = makeFrame(
      [makeField('fk', FieldType.string, ['a']), makeThresholdField('metric', [90], steps)],
      'B'
    );

    const joinEntry: JoinDisplayEntry = {
      id: 'j1',
      type: 'join',
      sourceFrame: 'B',
      sourceField: 'metric',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
      overridesBorderColor: true,
    };

    const indices = buildJoinIndices([secondaryFrame], [joinEntry]);
    const joinIndicesMap = new Map<string, JoinIndex>(indices.map((idx) => [idx.config.id, idx]));

    const result = getMostCriticalColor(
      [joinEntry],
      primaryFrame,
      0,
      joinIndicesMap,
      replaceVariables,
      [secondaryFrame]
    );
    expect(result).toBe('red');
  });

  it('picks highest score when mixing field and join entries', () => {
    const fieldSteps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const joinSteps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];

    const statusField = makeThresholdField('status', [60], fieldSteps);
    const primaryFrame = indexFrame(
      makeFrame([makeField('id', FieldType.string, ['a']), statusField])
    );
    const secondaryFrame = makeFrame(
      [makeField('fk', FieldType.string, ['a']), makeThresholdField('metric', [90], joinSteps)],
      'B'
    );

    const fieldEntry: FieldDisplayEntry = {
      id: 'f1',
      type: 'field',
      field: 'status',
      overridesBorderColor: true,
    };
    const joinEntry: JoinDisplayEntry = {
      id: 'j1',
      type: 'join',
      sourceFrame: 'B',
      sourceField: 'metric',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
      overridesBorderColor: true,
    };

    const indices = buildJoinIndices([secondaryFrame], [joinEntry]);
    const joinIndicesMap = new Map<string, JoinIndex>(indices.map((idx) => [idx.config.id, idx]));

    const result = getMostCriticalColor(
      [fieldEntry, joinEntry],
      primaryFrame,
      0,
      joinIndicesMap,
      replaceVariables,
      [secondaryFrame]
    );
    expect(result).toBe('red');
  });
});
