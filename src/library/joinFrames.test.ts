import { FieldType } from '@grafana/data';
import { indexFrame } from './dataFrame';
import { buildJoinIndices, JoinIndex, lookupJoinedRows, resolveJoinSections } from './joinFrames';
import { makeField, makeFrame } from './testHelpers';
import { Join } from '../types';

let nextJoinId = 0;

function makeJoin(
  overrides: Partial<Join> & Pick<Join, 'sourceFrame' | 'keys'>
): Join {
  return {
    id: `join-${nextJoinId++}`,
    sourceField: '',
    ...overrides,
  };
}

// -- buildJoinIndices ---------------------------------------------------------

describe('buildJoinIndices', () => {
  it('returns empty array for empty joins', () => {
    const frames = [makeFrame([makeField('a', FieldType.string, ['x'])])];
    expect(buildJoinIndices(frames, [])).toEqual([]);
  });

  it('returns empty array for empty frames', () => {
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    expect(buildJoinIndices([], [join])).toEqual([]);
  });

  it('builds index for cross-join (no keys)', () => {
    const frames = [makeFrame([makeField('a', FieldType.string, ['x', 'y', 'z'])], 'B')];
    const join = makeJoin({ sourceFrame: 'B', keys: [] });
    const indices = buildJoinIndices(frames, [join]);

    expect(indices).toHaveLength(1);
    expect(indices[0].config).toBe(join);
    const map = indices[0].getKeyMap();
    expect(map.size).toBe(1);
    expect(map.get('')).toEqual([0, 1, 2]);
  });

  it('skips joins referencing missing sourceFrame', () => {
    const frames = [makeFrame([makeField('a', FieldType.string, ['x'])], 'A')];
    const join = makeJoin({
      sourceFrame: 'missing',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'a' }],
    });
    expect(buildJoinIndices(frames, [join])).toEqual([]);
  });

  it('skips joins where foreign field does not exist', () => {
    const frames = [makeFrame([makeField('a', FieldType.string, ['x'])], 'B')];
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'nonexistent' }],
    });
    expect(buildJoinIndices(frames, [join])).toEqual([]);
  });

  it('builds a valid JoinIndex for a correct join config', () => {
    const secondaryFrame = makeFrame(
      [
        makeField('fk', FieldType.string, ['a', 'b', 'a']),
        makeField('metric', FieldType.number, [10, 20, 30]),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indices = buildJoinIndices([secondaryFrame], [join]);

    expect(indices).toHaveLength(1);
    expect(indices[0].config).toBe(join);
    expect(indices[0].frame.fieldByName.has('fk')).toBe(true);
    expect(indices[0].frame.fieldByName.has('metric')).toBe(true);
  });

  it('builds indices for multiple valid joins', () => {
    const frameB = makeFrame([makeField('fk', FieldType.string, ['x'])], 'B');
    const frameC = makeFrame([makeField('fk2', FieldType.string, ['y'])], 'C');
    const joins = [
      makeJoin({
        sourceFrame: 'B',
        keys: [{ primaryKey: 'a', primaryKeyTemplate: '', foreignField: 'fk' }],
      }),
      makeJoin({
        sourceFrame: 'C',
        keys: [{ primaryKey: 'b', primaryKeyTemplate: '', foreignField: 'fk2' }],
      }),
    ];
    const indices = buildJoinIndices([frameB, frameC], joins);
    expect(indices).toHaveLength(2);
  });
});

// -- getKeyMap (lazy caching) -------------------------------------------------

describe('getKeyMap', () => {
  it('returns cached instance on second call', () => {
    const secondaryFrame = makeFrame([makeField('fk', FieldType.string, ['a', 'b'])], 'B');
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondaryFrame], [join]);

    const map1 = index.getKeyMap();
    const map2 = index.getKeyMap();
    expect(map1).toBe(map2);
  });

  it('maps distinct keys to their row indices', () => {
    const secondaryFrame = makeFrame([makeField('fk', FieldType.string, ['a', 'b', 'c'])], 'B');
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondaryFrame], [join]);
    const map = index.getKeyMap();

    expect(map.get('a')).toEqual([0]);
    expect(map.get('b')).toEqual([1]);
    expect(map.get('c')).toEqual([2]);
  });

  it('collects multiple row indices for duplicate keys', () => {
    const secondaryFrame = makeFrame(
      [makeField('fk', FieldType.string, ['a', 'b', 'a', 'a'])],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondaryFrame], [join]);
    const map = index.getKeyMap();

    expect(map.get('a')).toEqual([0, 2, 3]);
    expect(map.get('b')).toEqual([1]);
  });

  it('builds composite keys from multiple foreign fields', () => {
    const secondaryFrame = makeFrame(
      [
        makeField('fk1', FieldType.string, ['a', 'a', 'b']),
        makeField('fk2', FieldType.string, ['x', 'y', 'x']),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [
        { primaryKey: 'k1', primaryKeyTemplate: '', foreignField: 'fk1' },
        { primaryKey: 'k2', primaryKeyTemplate: '', foreignField: 'fk2' },
      ],
    });
    const [index] = buildJoinIndices([secondaryFrame], [join]);
    const map = index.getKeyMap();

    expect(map.size).toBe(3);
    expect(map.get('a\0x')).toEqual([0]);
    expect(map.get('a\0y')).toEqual([1]);
    expect(map.get('b\0x')).toEqual([2]);
  });
});

// -- lookupJoinedRows ---------------------------------------------------------

describe('lookupJoinedRows', () => {
  it('looks up rows by field value', () => {
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a', 'b', 'c'])]));
    const secondary = makeFrame(
      [
        makeField('fk', FieldType.string, ['b', 'a', 'c', 'a']),
        makeField('val', FieldType.number, [10, 20, 30, 40]),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondary], [join]);
    const replaceVariables = jest.fn((v: string) => v);

    expect(lookupJoinedRows(index, primary, 0, replaceVariables, [])).toEqual([1, 3]);
    expect(lookupJoinedRows(index, primary, 1, replaceVariables, [])).toEqual([0]);
    expect(lookupJoinedRows(index, primary, 2, replaceVariables, [])).toEqual([2]);
  });

  it('returns undefined when no match found', () => {
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['missing'])]));
    const secondary = makeFrame([makeField('fk', FieldType.string, ['a', 'b'])], 'B');
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondary], [join]);
    const replaceVariables = jest.fn((v: string) => v);

    expect(lookupJoinedRows(index, primary, 0, replaceVariables, [])).toBeUndefined();
  });

  it('looks up by composite key (multiple key pairs)', () => {
    const primary = indexFrame(
      makeFrame([
        makeField('k1', FieldType.string, ['a', 'a']),
        makeField('k2', FieldType.string, ['x', 'y']),
      ])
    );
    const secondary = makeFrame(
      [
        makeField('fk1', FieldType.string, ['a', 'a']),
        makeField('fk2', FieldType.string, ['y', 'x']),
        makeField('val', FieldType.number, [10, 20]),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [
        { primaryKey: 'k1', primaryKeyTemplate: '', foreignField: 'fk1' },
        { primaryKey: 'k2', primaryKeyTemplate: '', foreignField: 'fk2' },
      ],
    });
    const [index] = buildJoinIndices([secondary], [join]);
    const replaceVariables = jest.fn((v: string) => v);

    // row 0: k1=a, k2=x -> matches secondary row 1 (fk1=a, fk2=x)
    expect(lookupJoinedRows(index, primary, 0, replaceVariables, [])).toEqual([1]);
    // row 1: k1=a, k2=y -> matches secondary row 0 (fk1=a, fk2=y)
    expect(lookupJoinedRows(index, primary, 1, replaceVariables, [])).toEqual([0]);
  });

  it('calls replaceVariables for template-based primary keys', () => {
    const primary = indexFrame(
      makeFrame([makeField('node', FieldType.string, ['host-1', 'host-2'])])
    );
    const secondary = makeFrame(
      [
        makeField('fk', FieldType.string, ['host-1', 'host-2']),
        makeField('val', FieldType.number, [10, 20]),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: 'node',
      keys: [
        {
          primaryKey: '__template__',
          primaryKeyTemplate: '${__data.fields.node}',
          foreignField: 'fk',
        },
      ],
    });
    const [index] = buildJoinIndices([secondary], [join]);

    const replaceVariables = jest.fn((v: string) => {
      if (v === '${__data.fields.node}') {
        return 'host-1';
      }
      return v;
    });

    const result = lookupJoinedRows(index, primary, 0, replaceVariables, []);
    expect(replaceVariables).toHaveBeenCalled();
    expect(result).toEqual([0]);
  });

  it('pushes empty string when primary field does not exist', () => {
    const primary = indexFrame(makeFrame([makeField('other', FieldType.string, ['x'])]));
    const secondary = makeFrame(
      [makeField('fk', FieldType.string, ['', 'x']), makeField('val', FieldType.number, [10, 20])],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      keys: [{ primaryKey: 'nonexistent', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const [index] = buildJoinIndices([secondary], [join]);
    const replaceVariables = jest.fn((v: string) => v);

    // When field is missing, '' is pushed as key, which matches '' in secondary
    expect(lookupJoinedRows(index, primary, 0, replaceVariables, [])).toEqual([0]);
  });
});

// -- resolveJoinSections ------------------------------------------------------

describe('resolveJoinSections', () => {
  const replaceVariables = jest.fn((v: string) => v);

  function buildIndicesMap(
    frames: Array<ReturnType<typeof makeFrame>>,
    joins: Join[]
  ): Map<string, JoinIndex> {
    const indices = buildJoinIndices(frames, joins);
    return new Map(indices.map((idx) => [idx.config.id, idx]));
  }

  it('returns empty array when join ID is not in joinIndices map', () => {
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: 'val',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });

    const result = resolveJoinSections([join], primary, 0, new Map(), replaceVariables, []);
    expect(result).toEqual([]);
  });

  it('returns empty array when join has no sourceField', () => {
    const secondary = makeFrame(
      [makeField('fk', FieldType.string, ['a']), makeField('val', FieldType.number, [10])],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: '',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indicesMap = buildIndicesMap([secondary], [join]);
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));

    const result = resolveJoinSections([join], primary, 0, indicesMap, replaceVariables, []);
    expect(result).toEqual([]);
  });

  it('returns empty array when sourceField does not exist in joined frame', () => {
    const secondary = makeFrame([makeField('fk', FieldType.string, ['a'])], 'B');
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: 'nonexistent',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indicesMap = buildIndicesMap([secondary], [join]);
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));

    const result = resolveJoinSections([join], primary, 0, indicesMap, replaceVariables, []);
    expect(result).toEqual([]);
  });

  it('returns section with empty matchedRows when no rows match', () => {
    const secondary = makeFrame(
      [makeField('fk', FieldType.string, ['x', 'y']), makeField('val', FieldType.number, [10, 20])],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: 'val',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indicesMap = buildIndicesMap([secondary], [join]);
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['no-match'])]));

    const result = resolveJoinSections([join], primary, 0, indicesMap, replaceVariables, []);
    expect(result).toHaveLength(1);
    expect(result[0].matchedRows).toEqual([]);
    expect(result[0].joinConfig).toBe(join);
    expect(result[0].sourceField.name).toBe('val');
  });

  it('returns section with correct matchedRows for a matching join', () => {
    const secondary = makeFrame(
      [
        makeField('fk', FieldType.string, ['a', 'b', 'a']),
        makeField('val', FieldType.number, [10, 20, 30]),
      ],
      'B'
    );
    const join = makeJoin({
      sourceFrame: 'B',
      sourceField: 'val',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indicesMap = buildIndicesMap([secondary], [join]);
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));

    const result = resolveJoinSections([join], primary, 0, indicesMap, replaceVariables, []);
    expect(result).toHaveLength(1);
    expect(result[0].matchedRows).toEqual([0, 2]);
    expect(result[0].sourceField.name).toBe('val');
  });

  it('resolves multiple joins, one section per valid join', () => {
    const frameB = makeFrame(
      [makeField('fk', FieldType.string, ['a']), makeField('metric1', FieldType.number, [100])],
      'B'
    );
    const frameC = makeFrame(
      [makeField('fk', FieldType.string, ['a']), makeField('metric2', FieldType.number, [200])],
      'C'
    );
    const join1 = makeJoin({
      sourceFrame: 'B',
      sourceField: 'metric1',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const join2 = makeJoin({
      sourceFrame: 'C',
      sourceField: 'metric2',
      keys: [{ primaryKey: 'id', primaryKeyTemplate: '', foreignField: 'fk' }],
    });
    const indicesMap = buildIndicesMap([frameB, frameC], [join1, join2]);
    const primary = indexFrame(makeFrame([makeField('id', FieldType.string, ['a'])]));

    const result = resolveJoinSections(
      [join1, join2],
      primary,
      0,
      indicesMap,
      replaceVariables,
      []
    );
    expect(result).toHaveLength(2);
    expect(result[0].sourceField.name).toBe('metric1');
    expect(result[0].matchedRows).toEqual([0]);
    expect(result[1].sourceField.name).toBe('metric2');
    expect(result[1].matchedRows).toEqual([0]);
  });
});
