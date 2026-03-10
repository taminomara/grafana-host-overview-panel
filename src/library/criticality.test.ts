import { Field, FieldType, ThresholdsMode } from '@grafana/data';
import { buildSeverityMap, getCriticalityScore, getMostCriticalColor } from './criticality';
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

  it('returns [0, color] for a single threshold', () => {
    const field = makeThresholdField('x', [42], [{ value: 0, color: 'green' }]);
    const [score, color] = getCriticalityScore(field, 42);
    expect(score).toBe(0);
    expect(color).toBe('green');
  });

  describe('green at start (index 0)', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];

    it('green threshold has score 0', () => {
      const field = makeThresholdField('cpu', [10], steps);
      const [score, color] = getCriticalityScore(field, 10);
      expect(color).toBe('green');
      expect(score).toBeCloseTo(0);
    });

    it('yellow threshold has score 0.5', () => {
      const field = makeThresholdField('cpu', [60], steps);
      const [score, color] = getCriticalityScore(field, 60);
      expect(color).toBe('yellow');
      expect(score).toBeCloseTo(0.5);
    });

    it('red threshold has score 1', () => {
      const field = makeThresholdField('cpu', [90], steps);
      const [score, color] = getCriticalityScore(field, 90);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);
    });
  });

  describe('green at end', () => {
    const steps = [
      { value: 0, color: 'red' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'green' },
    ];

    it('red threshold has score 1', () => {
      const field = makeThresholdField('cpu', [10], steps);
      const [score, color] = getCriticalityScore(field, 10);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);
    });

    it('yellow threshold has score 0.5', () => {
      const field = makeThresholdField('cpu', [60], steps);
      const [score, color] = getCriticalityScore(field, 60);
      expect(color).toBe('yellow');
      expect(score).toBeCloseTo(0.5);
    });

    it('green threshold has score 0', () => {
      const field = makeThresholdField('cpu', [90], steps);
      const [score, color] = getCriticalityScore(field, 90);
      expect(color).toBe('green');
      expect(score).toBeCloseTo(0);
    });
  });

  describe('green in the middle', () => {
    const steps = [
      { value: 0, color: 'blue' },
      { value: 30, color: 'green' },
      { value: 60, color: 'red' },
    ];

    it('blue threshold has score 1', () => {
      const field = makeThresholdField('x', [10], steps);
      const [score, color] = getCriticalityScore(field, 10);
      expect(color).toBe('blue');
      expect(score).toBeCloseTo(1);
    });

    it('green threshold has score 0', () => {
      const field = makeThresholdField('x', [40], steps);
      const [score, color] = getCriticalityScore(field, 40);
      expect(color).toBe('green');
      expect(score).toBeCloseTo(0);
    });

    it('red threshold has score 1', () => {
      const field = makeThresholdField('x', [70], steps);
      const [score, color] = getCriticalityScore(field, 70);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);
    });
  });

  describe('green in the middle (asymmetric)', () => {
    // 5 steps, green at index 1 => l=1, max(1, 3)=3
    const steps = [
      { value: 0, color: 'blue' },
      { value: 20, color: 'green' },
      { value: 40, color: 'yellow' },
      { value: 60, color: 'orange' },
      { value: 80, color: 'red' },
    ];

    it('blue threshold (i=0) has score 1/3', () => {
      const field = makeThresholdField('x', [5], steps);
      const [score, color] = getCriticalityScore(field, 5);
      expect(color).toBe('blue');
      expect(score).toBeCloseTo(1 / 3);
    });

    it('green threshold (i=1) has score 0', () => {
      const field = makeThresholdField('x', [25], steps);
      const [score, color] = getCriticalityScore(field, 25);
      expect(color).toBe('green');
      expect(score).toBeCloseTo(0);
    });

    it('yellow threshold (i=2) has score 1/3', () => {
      const field = makeThresholdField('x', [45], steps);
      const [score, color] = getCriticalityScore(field, 45);
      expect(color).toBe('yellow');
      expect(score).toBeCloseTo(1 / 3);
    });

    it('red threshold (i=4) has score 1', () => {
      const field = makeThresholdField('x', [85], steps);
      const [score, color] = getCriticalityScore(field, 85);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);
    });
  });

  describe('no green threshold, no overrides', () => {
    const steps = [
      { value: 0, color: 'yellow' },
      { value: 50, color: 'orange' },
      { value: 80, color: 'red' },
    ];

    it('first threshold (l=0) has score 0', () => {
      const field = makeThresholdField('x', [10], steps);
      const [score, color] = getCriticalityScore(field, 10);
      expect(color).toBe('yellow');
      expect(score).toBeCloseTo(0);
    });

    it('middle threshold has score 0.5', () => {
      const field = makeThresholdField('x', [60], steps);
      const [score, color] = getCriticalityScore(field, 60);
      expect(color).toBe('orange');
      expect(score).toBeCloseTo(0.5);
    });

    it('last threshold has score 1', () => {
      const field = makeThresholdField('x', [90], steps);
      const [score, color] = getCriticalityScore(field, 90);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);
    });
  });

  describe('custom severity overrides', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const identity = (c: string) => c;

    it('explicit severity-0 override shifts anchor', () => {
      const map = buildSeverityMap([{ color: 'yellow', severity: 0 }], identity);
      const field = makeThresholdField('x', [10], steps);

      // l=1 (yellow has severity 0), max(1,1)=1
      const [scoreGreen] = getCriticalityScore(field, 10, map, identity);
      expect(scoreGreen).toBeCloseTo(1); // abs(1-0)/1 = 1

      const [scoreYellow] = getCriticalityScore(field, 60, map, identity);
      expect(scoreYellow).toBeCloseTo(0); // custom severity = 0

      const [scoreRed] = getCriticalityScore(field, 90, map, identity);
      expect(scoreRed).toBeCloseTo(1); // abs(1-2)/1 = 1
    });

    it('direct severity override takes precedence over distance formula', () => {
      const map = buildSeverityMap([{ color: 'yellow', severity: 1.5 }], identity);
      const field = makeThresholdField('x', [60], steps);

      const [score, color] = getCriticalityScore(field, 60, map, identity);
      expect(color).toBe('yellow');
      expect(score).toBe(1.5);
    });

    it('severity > 1 is allowed', () => {
      const map = buildSeverityMap([{ color: 'red', severity: 2 }], identity);
      const field = makeThresholdField('x', [90], steps);

      const [score, color] = getCriticalityScore(field, 90, map, identity);
      expect(color).toBe('red');
      expect(score).toBe(2);
    });

    it('non-matching override does not affect scoring', () => {
      const map = buildSeverityMap([{ color: 'purple', severity: 0 }], identity);
      const field = makeThresholdField('x', [90], steps);

      // No override matches, green at index 0, l=0, max(0,2)=2
      const [score, color] = getCriticalityScore(field, 90, map, identity);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1); // abs(0-2)/2 = 1
    });

    it('resolves colors before matching overrides to thresholds', () => {
      // Threshold uses named 'yellow', override uses hex '#ffff00'
      const resolver = (c: string) => (c === 'yellow' ? '#ffff00' : c);
      const map = buildSeverityMap([{ color: '#ffff00', severity: 2 }], resolver);
      const field = makeThresholdField('x', [60], steps);

      const [score, color] = getCriticalityScore(field, 60, map, resolver);
      expect(color).toBe('yellow');
      expect(score).toBe(2);
    });

    it('resolves colors when finding severity-0 anchor', () => {
      // No named green, but override marks resolved '#00ff00' as severity 0
      const noGreenSteps = [
        { value: 0, color: '#aa0000' },
        { value: 50, color: '#00ff00' },
        { value: 80, color: '#ff0000' },
      ];
      const resolver = (c: string) => c;
      const map = buildSeverityMap([{ color: '#00ff00', severity: 0 }], resolver);
      const field = makeThresholdField('x', [10], noGreenSteps);

      // l=1 (#00ff00 has severity 0), max(1,1)=1
      const [score] = getCriticalityScore(field, 10, map, resolver);
      expect(score).toBeCloseTo(1); // abs(1-0)/1 = 1

      const [score2] = getCriticalityScore(field, 60, map, resolver);
      expect(score2).toBeCloseTo(0); // direct match, severity 0
    });
  });

  it('handles percentage thresholds', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'red' },
    ];
    const field = makeThresholdField('x', [75], steps, ThresholdsMode.Percentage);

    const [score0, color0] = getCriticalityScore(field, 25);
    expect(color0).toBe('green');
    expect(score0).toBeCloseTo(0);

    const [score1, color1] = getCriticalityScore(field, 75);
    expect(color1).toBe('red');
    expect(score1).toBeCloseTo(1);
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
    expect(score).toBeCloseTo(1);
  });

  it('recognizes green color variants', () => {
    for (const greenColor of [
      'green',
      'semi-dark-green',
      'dark-green',
      'light-green',
      'super-light-green',
    ]) {
      const steps = [
        { value: 0, color: 'red' },
        { value: 50, color: greenColor },
      ];
      const field = makeThresholdField('x', [10], steps);
      const [score, color] = getCriticalityScore(field, 10);
      expect(color).toBe('red');
      expect(score).toBeCloseTo(1);

      const [scoreGreen] = getCriticalityScore(field, 60);
      expect(scoreGreen).toBeCloseTo(0);
    }
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

  it('passes severityOverrides through to getCriticalityScore', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const yellowField = makeThresholdField('cpu', [60], steps);
    const redField = makeThresholdField('mem', [90], steps);
    const frame = indexFrame(makeFrame([yellowField, redField]));

    const entries: FieldDisplayEntry[] = [
      {
        id: '1',
        type: 'field',
        field: 'cpu',
        overridesBorderColor: true,
        severityOverrides: [{ color: 'yellow', severity: 2 }],
      },
      { id: '2', type: 'field', field: 'mem', overridesBorderColor: true },
    ];

    const result = getMostCriticalColor(entries, frame, 0, new Map(), replaceVariables, []);
    expect(result).toBe('yellow');
  });

  it('resolves override colors to match threshold colors', () => {
    const steps = [
      { value: 0, color: 'green' },
      { value: 50, color: 'yellow' },
      { value: 80, color: 'red' },
    ];
    const yellowField = makeThresholdField('cpu', [60], steps);
    const redField = makeThresholdField('mem', [90], steps);
    const frame = indexFrame(makeFrame([yellowField, redField]));

    // Override uses hex '#ffff00' while threshold uses named 'yellow'
    const resolver = (c: string) => {
      const map: Record<string, string> = { yellow: '#ffff00', green: '#00ff00', red: '#ff0000' };
      return map[c] ?? c;
    };

    const entries: FieldDisplayEntry[] = [
      {
        id: '1',
        type: 'field',
        field: 'cpu',
        overridesBorderColor: true,
        severityOverrides: [{ color: '#ffff00', severity: 2 }],
      },
      { id: '2', type: 'field', field: 'mem', overridesBorderColor: true },
    ];

    const result = getMostCriticalColor(
      entries,
      frame,
      0,
      new Map(),
      replaceVariables,
      [],
      resolver
    );
    expect(result).toBe('yellow');
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
